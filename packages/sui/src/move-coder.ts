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
import type { MoveCallSuiTransaction, SuiCallArg, SuiEvent, SuiMoveObject } from '@mysten/sui/jsonRpc'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { SuiChainAdapter, ModuleWithAddress, getGrpcClient } from './sui-chain-adapter.js'
import { toInternalModule } from './to-internal.js'
import { dynamic_field } from './builtin/0x2.js'
import { BcsType, bcs } from '@mysten/sui/bcs'

// import { Encoding } from '@mysten/bcs/types', this doesn't get exported correctly
export type Encoding = 'base58' | 'base64' | 'hex'

import { normalizeSuiObjectId, normalizeSuiAddress } from '@mysten/sui/utils'

export class MoveCoder extends AbstractMoveCoder<ModuleWithAddress, SuiEvent | SuiMoveObject> {
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

  decodeEvent<T>(event: SuiEvent): Promise<TypedEventInstance<T> | undefined> {
    return this.decodedStruct(event)
  }
  filterAndDecodeEvents<T>(type: TypeDescriptor<T> | string, resources: SuiEvent[]): Promise<TypedEventInstance<T>[]> {
    if (typeof type === 'string') {
      type = parseMoveType(type)
    }
    return this.filterAndDecodeStruct(type, resources)
  }

  async getDynamicFields<T1, T2>(
    objects: SuiMoveObject[],
    keyType: TypeDescriptor<T1> = ANY_TYPE,
    valueType: TypeDescriptor<T2> = ANY_TYPE
  ): Promise<dynamic_field.Field<T1, T2>[]> {
    // const type = dynamic_field.Field.TYPE
    // Not using the code above to avoid cycle initialize failed
    const type = new TypeDescriptor<dynamic_field.Field<T1, T2>>('0x2::dynamic_field::Field')
    type.typeArgs = [keyType, valueType]
    const res = await this.filterAndDecodeObjects(type, objects)
    return res.map((o) => o.data_decoded)
  }

  filterAndDecodeObjects<T>(
    type: TypeDescriptor<T>,
    objects: SuiMoveObject[]
  ): Promise<DecodedStruct<SuiMoveObject, T>[]> {
    return this.filterAndDecodeStruct(type, objects)
  }

  async decodeFunctionPayload(payload: MoveCallSuiTransaction, inputs: SuiCallArg[]): Promise<MoveCallSuiTransaction> {
    const functionType = [payload.package, payload.module, payload.function].join(SPLITTER)
    const func = await this.getMoveFunction(functionType)
    const params = this.adapter.getMeaningfulFunctionParams(func.params)
    const args = []
    for (const value of payload.arguments || []) {
      const argValue = value as any
      if ('Input' in (argValue as any)) {
        const idx = argValue.Input
        const arg = inputs[idx]
        if (arg.type === 'pure') {
          args.push(arg.value)
        } else if (arg.type === 'object') {
          // object is not there
          args.push(undefined)
        } else {
          console.error('unexpected function arg value')
          args.push(undefined)
        }
        // args.push(arg) // TODO check why ts not work using arg.push(arg)
      } else {
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
    returnTypeSignatures: string[]
  ): Promise<TypedSimulateResults<T>> {
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
            const type = parseMoveType(sig)
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

const DEFAULT_ENDPOINT = 'https://fullnode.mainnet.sui.io/'
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
