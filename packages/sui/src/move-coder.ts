import { TypedSimulateResults, TypedEventInstance, TypedFunctionPayload } from './models.js'
import {
  AbstractMoveCoder,
  ANY_TYPE,
  DecodedStruct,
  accountTypeString,
  parseMoveType,
  SPLITTER,
  TypeDescriptor,
  InternalMoveModule
} from '@typemove/move'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import type { GrpcTypes } from '@mysten/sui/grpc'
import {
  SuiChainAdapter,
  ModuleWithAddress,
  getGrpcClient,
  getGrpcFullnodeUrl,
  SuiEventInput,
  SuiMoveObjectInput
} from './sui-chain-adapter.js'
import { toInternalModule } from './to-internal.js'
import { dynamic_field } from './builtin/0x2.js'
import { BcsType, bcs } from '@mysten/sui/bcs'

// import { Encoding } from '@mysten/bcs/types', this doesn't get exported correctly
export type Encoding = 'base58' | 'base64' | 'hex'

import { normalizeSuiObjectId, normalizeSuiAddress } from '@mysten/sui/utils'

export class MoveCoder extends AbstractMoveCoder<ModuleWithAddress, SuiEventInput | SuiMoveObjectInput> {
  constructor(client: SuiGrpcClient) {
    super(new SuiChainAdapter(client))
  }

  load(entry: ModuleWithAddress, address: string): InternalMoveModule {
    address = accountTypeString(address)
    const { address: moduleAddress, module } = entry
    let m = this.moduleMapping.get(moduleAddress + '::' + module.name)
    const mDeclared = this.moduleMapping.get(address + '::' + module.name)
    if (m && mDeclared) {
      return m
    }
    this.accounts.add(moduleAddress)
    m = toInternalModule(module, moduleAddress)
    this.loadInternal(m, address)
    return m
  }

  protected async decode(data: any, type: TypeDescriptor): Promise<any> {
    // UID handled before the switch to avoid the existing fall-through chain
    // (case '0x2::url::Url' / '0x2::coin::Coin' bodies fire on non-string
    // inputs and corrupt UID output). gRPC's unified Object.json flattens UID
    // to a bare address string — re-wrap to `{ id: '0x<32-byte>' }` so
    // downstream `.id.id`-style accessors keep working. The BCS-shaped path
    // (`{ id: { bytes: Uint8Array(32) } }`) is delegated to super.decode,
    // which then hits the inner ID case.
    if (type.qname === '0x2::object::UID') {
      if (typeof data === 'string') {
        return { id: normalizeSuiObjectId(data) } as any
      }
      return super.decode(data, type)
    }
    switch (type.qname) {
      case '0x1::ascii::Char':
        if (data !== undefined && typeof data !== 'string') {
          // bcs
          const byte = (await super.decode(data, type)).byte as number
          return String.fromCharCode(byte)
        }
      case '0x1::ascii::String':
        if (data !== undefined && typeof data !== 'string') {
          // bcs verified
          const bytes = (await super.decode(data, type)).bytes as number[]
          return new TextDecoder().decode(new Uint8Array(bytes))
        }
      case '0x2::object::ID':
        if (data !== undefined && typeof data !== 'string') {
          // bcs verified
          const bytes = (await super.decode(data, type)).bytes as string
          return normalizeSuiObjectId(bytes)
        }
      case '0x2::url::Url':
        if (data !== undefined && typeof data !== 'string') {
          // bcs
          return (await super.decode(data, type)).url
        }
      case '0x2::coin::Coin':
        if (data !== undefined && typeof data !== 'string') {
          // bcs
          const bytes = (await super.decode(data, type)).id.id.bytes as number[]
          return new TextDecoder().decode(new Uint8Array(bytes))
        }
        return data
      case '0x2::balance::Balance':
        if (data.value) {
          // bcs verfied
          const balance = await super.decode(data, type)
          return balance.value
        }
        return BigInt(data)
      case '0x1::option::Option':
        if (data === null) {
          return data
        }
        if (data.vec) {
          // bcs verifed
          let vec = await super.decode(data, type)
          vec = vec.vec
          if (vec.length === 0) {
            return null
          }
          return vec[0]
        }
        return this.decode(data, type.typeArgs[0])
      case 'Address':
        const str = data as string
        return normalizeSuiAddress(str)
      case '0x1::string::String':
        if (typeof data !== 'string') {
          // bcs
          return new TextDecoder().decode(new Uint8Array(data.bytes))
        }
      default:
        return super.decode(data, type)
    }
  }

  decodeEvent<T>(event: SuiEventInput): Promise<TypedEventInstance<T> | undefined> {
    return this.decodedStruct(event)
  }
  filterAndDecodeEvents<T>(
    type: TypeDescriptor<T> | string,
    resources: SuiEventInput[]
  ): Promise<TypedEventInstance<T>[]> {
    if (typeof type === 'string') {
      type = parseMoveType(type)
    }
    return this.filterAndDecodeStruct(type, resources)
  }

  async getDynamicFields<T1, T2>(
    objects: SuiMoveObjectInput[],
    keyType: TypeDescriptor<T1> = ANY_TYPE,
    valueType: TypeDescriptor<T2> = ANY_TYPE
  ): Promise<dynamic_field.Field<T1, T2>[]> {
    const type = new TypeDescriptor<dynamic_field.Field<T1, T2>>('0x2::dynamic_field::Field')
    type.typeArgs = [keyType, valueType]
    const res = await this.filterAndDecodeObjects(type, objects)
    return res.map((o) => o.data_decoded)
  }

  filterAndDecodeObjects<T>(
    type: TypeDescriptor<T>,
    objects: SuiMoveObjectInput[]
  ): Promise<DecodedStruct<SuiMoveObjectInput, T>[]> {
    return this.filterAndDecodeStruct(type, objects)
  }

  // Decodes a parsed Move call payload against the loaded module ABI.
  // Inputs are gRPC `Input[]`: kind=PURE carries a Uint8Array of BCS bytes
  // that we decode using the corresponding parameter's Move type;
  // object inputs (IMMUTABLE_OR_OWNED / SHARED / receiving) are surfaced as
  // undefined since their on-chain values aren't part of the payload.
  async decodeFunctionPayload(payload: GrpcTypes.MoveCall, inputs: GrpcTypes.Input[]): Promise<any> {
    const functionType = [payload.package, payload.module, payload.function].join(SPLITTER)
    const func = await this.getMoveFunction(functionType)
    const params = this.adapter.getMeaningfulFunctionParams(func.params)
    const args: any[] = []
    for (const value of payload.arguments ?? []) {
      const av = value as any
      const idx: number | undefined = av?.input
      if (idx == null || idx < 0 || idx >= inputs.length) {
        args.push(undefined)
        continue
      }
      const arg = inputs[idx]
      if (arg?.pure) {
        const paramType: TypeDescriptor | undefined = params[args.length]
        try {
          const bytes = arg.pure instanceof Uint8Array ? arg.pure : new Uint8Array(arg.pure)
          const decoded: any = paramType ? await this.decodeBCS(paramType, bytes) : bytes
          args.push(decoded)
        } catch {
          args.push(undefined)
        }
      } else {
        // Object inputs (and unknown kinds) — value isn't carried in the payload.
        args.push(undefined)
      }
    }

    const argumentsTyped = await this.decodeArray(args, params, false)
    return {
      ...payload,
      arguments_decoded: argumentsTyped
    } as TypedFunctionPayload<any>
  }

  private bcsRegistered = new Set<string>()
  private bcsRegistry = new Map<string, BcsType<any>>()

  private async getBCSTypeWithArgs(type: TypeDescriptor, args: BcsType<any>[] = []): Promise<BcsType<any>> {
    const qname = type.qname
    const sig = type.getNormalizedSignature()
    const cached = this.bcsRegistry.get(sig)
    if (cached) {
      return cached
    }
    const lowerQname = qname.toLowerCase()
    switch (lowerQname) {
      case 'u8':
      case 'u16':
      case 'u32':
      case 'u64':
      case 'u128':
      case 'u256':
      case 'bool':
        return bcs[lowerQname]()
      case 'address':
        return bcs.Address
      case 'vector':
        return bcs.vector(args[0])
      default:
        if (!qname.includes('::')) {
          throw `Unimplemented builtin type ${qname}`
        }
    }
    let moveStruct
    try {
      moveStruct = await this.getMoveStruct(qname)
    } catch (e) {
      console.error('Invalid move address', qname)
      throw e
    }
    const structDef: Record<string, any> = {}
    for (const field of moveStruct.fields) {
      if (field.type.qname.startsWith('T') && args.length) {
        const index = +field.type.qname.slice(1)
        structDef[field.name] = args[index]
      } else if (field.type.typeArgs.length && args.length) {
        structDef[field.name] = await this.getBCSTypeWithArgs(field.type, args)
      } else {
        structDef[field.name] = await this.getBCSType(field.type)
      }
    }
    return bcs.struct(qname, structDef)
  }

  async getBCSType(type: TypeDescriptor): Promise<BcsType<any>> {
    const args = await Promise.all(type.typeArgs.map((x) => this.getBCSType(x)))
    const bcsType = await this.getBCSTypeWithArgs(type, args)
    this.bcsRegistry.set(type.getNormalizedSignature(), bcsType)
    return bcsType
  }

  async registerBCSTypes(type: TypeDescriptor): Promise<void> {
    const sig = type.getNormalizedSignature()
    if (this.bcsRegistered.has(sig)) {
      return
    }
    this.bcsRegistered.add(sig)

    const bcsType = await this.getBCSType(type)
    this.bcsRegistry.set(type.getNormalizedSignature(), bcsType)
  }

  async decodeBCS(type: TypeDescriptor, data: Uint8Array | string, encoding?: Encoding): Promise<any> {
    await this.registerBCSTypes(type)
    if (typeof data == 'string') {
      const buf = Buffer.from(data, encoding as any)
      data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    }
    const bcsType = this.bcsRegistry.get(type.getNormalizedSignature())
    return bcsType?.parse(data)
  }

  // Replaces decodeDevInspectResult. gRPC simulateTransaction returns
  // `commandResults: CommandResult[]` where each CommandResult.returnValues is
  // `CommandOutput[]` of raw `{ bcs: Uint8Array }` — there is no per-return
  // type string the way devInspect carried one. The caller must therefore pass
  // the Move return-type signatures explicitly (codegen emits them next to
  // each generated view helper).
  async decodeSimulateResult<T extends any[]>(
    simulateRes: any,
    returnTypeSignatures: string[],
    typeArguments?: (string | TypeDescriptor)[]
  ): Promise<TypedSimulateResults<T>> {
    // Generic view helpers embed return signatures like "T0" / "vector<T1>"
    // at codegen time, but the caller supplies concrete type arguments only
    // at runtime. Substitute them in before BCS decoding — otherwise the BCS
    // type registry sees the bare type-parameter qname and rejects it as an
    // unimplemented builtin.
    const ctx = new Map<string, TypeDescriptor>()
    if (typeArguments && typeArguments.length > 0) {
      typeArguments.forEach((t, i) => {
        ctx.set('T' + i, typeof t === 'string' ? parseMoveType(t) : t)
      })
    }

    const returnValues: any[] = []
    const commandResults = simulateRes?.commandResults
    if (Array.isArray(commandResults)) {
      let typeIdx = 0
      for (const r of commandResults) {
        const rvs = r?.returnValues
        if (Array.isArray(rvs) && rvs.length > 0) {
          for (const rv of rvs) {
            const sig = returnTypeSignatures[typeIdx++]
            if (!sig) {
              returnValues.push(null)
              continue
            }
            let type = parseMoveType(sig)
            if (ctx.size > 0) {
              type = type.applyTypeArgs(ctx)
            }
            const bcsBytes = rv?.bcs instanceof Uint8Array ? rv.bcs : new Uint8Array(rv?.bcs ?? [])
            const bcsDecoded = await this.decodeBCS(type, bcsBytes)
            const decoded = await this.decodeType(bcsDecoded, type)
            returnValues.push(decoded)
          }
        } else {
          returnValues.push(null)
        }
      }
    }
    return { ...simulateRes, results_decoded: returnValues as any }
  }
}

const DEFAULT_ENDPOINT = getGrpcFullnodeUrl('mainnet')
const CODER_MAP = new Map<string, MoveCoder>()

export function defaultMoveCoder(endpoint: string = DEFAULT_ENDPOINT): MoveCoder {
  let coder = CODER_MAP.get(endpoint)
  if (!coder) {
    coder = new MoveCoder(getGrpcClient(endpoint))
    CODER_MAP.set(endpoint, coder)
  }
  return coder
}

const PROVIDER_CODER_MAP = new Map<SuiGrpcClient, MoveCoder>()

let DEFAULT_CHAIN_ID: string | undefined

export async function getMoveCoder(client: SuiGrpcClient): Promise<MoveCoder> {
  let coder = PROVIDER_CODER_MAP.get(client)
  if (!coder) {
    coder = new MoveCoder(client)
    const { chainIdentifier } = await client.core.getChainIdentifier()
    const defaultCoder = defaultMoveCoder()
    if (!DEFAULT_CHAIN_ID) {
      DEFAULT_CHAIN_ID = await defaultCoder.adapter.getChainId()
    }
    if (chainIdentifier === DEFAULT_CHAIN_ID) {
      coder = defaultCoder
    }

    PROVIDER_CODER_MAP.set(client, coder)
  }
  return coder
}
