import { TypedDevInspectResults, TypedEventInstance, TypedFunctionPayload } from './models.js'
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
import {
  MoveCallIotaTransaction,
  IotaCallArg,
  IotaEvent,
  IotaMoveNormalizedModule,
  IotaMoveObject,
  DevInspectResults,
  IotaClient
} from '@iota/iota-sdk/client'
import { toInternalModule } from './to-internal.js'
import { IotaChainAdapter } from './sui-chain-adapter.js'
import { dynamic_field } from './builtin/0x2.js'
import { BcsType, bcs } from '@iota/iota-sdk/bcs'

// import { Encoding } from '@mysten/bcs/types', this doesn't get exported correctly
export type Encoding = 'base58' | 'base64' | 'hex'

import { normalizeIotaObjectId, normalizeIotaAddress } from '@iota/iota-sdk/utils'

export class MoveCoder extends AbstractMoveCoder<
  // IotaNetwork,
  IotaMoveNormalizedModule,
  IotaEvent | IotaMoveObject
> {
  constructor(client: IotaClient) {
    super(new IotaChainAdapter(client))
  }

  load(module: IotaMoveNormalizedModule, address: string): InternalMoveModule {
    address = accountTypeString(address)
    let m = this.moduleMapping.get(module.address + '::' + module.name)
    const mDeclared = this.moduleMapping.get(address + '::' + module.name)
    if (m && mDeclared) {
      return m
    }
    this.accounts.add(module.address)
    m = toInternalModule(module)
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
          return normalizeIotaObjectId(bytes)
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
        return normalizeIotaAddress(str)
      case '0x1::string::String':
        if (typeof data !== 'string') {
          // bcs
          return new TextDecoder().decode(new Uint8Array(data.bytes))
        }
      default:
        return super.decode(data, type)
    }
  }

  decodeEvent<T>(event: IotaEvent): Promise<TypedEventInstance<T> | undefined> {
    return this.decodedStruct(event)
  }
  filterAndDecodeEvents<T>(type: TypeDescriptor<T> | string, resources: IotaEvent[]): Promise<TypedEventInstance<T>[]> {
    if (typeof type === 'string') {
      type = parseMoveType(type)
    }
    return this.filterAndDecodeStruct(type, resources)
  }

  async getDynamicFields<T1, T2>(
    objects: IotaMoveObject[],
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
    objects: IotaMoveObject[]
  ): Promise<DecodedStruct<IotaMoveObject, T>[]> {
    return this.filterAndDecodeStruct(type, objects)
  }

  async decodeFunctionPayload(
    payload: MoveCallIotaTransaction,
    inputs: IotaCallArg[]
  ): Promise<MoveCallIotaTransaction> {
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
      data = new Uint8Array(buf, buf.byteOffset, buf.byteLength)
    }
    const bcsType = this.bcsRegistry.get(type.getNormalizedSignature())
    return bcsType?.parse(data)
  }

  async decodeDevInspectResult<T extends any[]>(inspectRes: DevInspectResults): Promise<TypedDevInspectResults<T>> {
    const returnValues = []
    if (inspectRes.results != null) {
      for (const r of inspectRes.results) {
        if (r.returnValues) {
          for (const returnValue of r.returnValues) {
            const type = parseMoveType(returnValue[1])
            const bcsDecoded = await this.decodeBCS(type, new Uint8Array(returnValue[0]))
            const decoded = await this.decodeType(bcsDecoded, type)
            returnValues.push(decoded)
          }
        } else {
          returnValues.push(null)
        }
      }
    }
    return { ...inspectRes, results_decoded: returnValues as any }
  }
}

const DEFAULT_ENDPOINT = 'https://api.mainnet.iota.cafe/'
const CODER_MAP = new Map<string, MoveCoder>()
const CHAIN_ID_CODER_MAP = new Map<string, MoveCoder>()

export function defaultMoveCoder(endpoint: string = DEFAULT_ENDPOINT): MoveCoder {
  let coder = CODER_MAP.get(endpoint)
  if (!coder) {
    coder = new MoveCoder(new IotaClient({ url: endpoint }))
    CODER_MAP.set(endpoint, coder)
  }
  return coder
}

const PROVIDER_CODER_MAP = new Map<IotaClient, MoveCoder>()

let DEFAULT_CHAIN_ID: string | undefined

export async function getMoveCoder(client: IotaClient): Promise<MoveCoder> {
  let coder = PROVIDER_CODER_MAP.get(client)
  if (!coder) {
    coder = new MoveCoder(client)
    // TODO how to dedup
    const id = await client.getChainIdentifier()
    const defaultCoder = defaultMoveCoder()
    if (!DEFAULT_CHAIN_ID) {
      DEFAULT_CHAIN_ID = await defaultCoder.adapter.getChainId()
    }
    if (id === DEFAULT_CHAIN_ID) {
      coder = defaultCoder
    }

    PROVIDER_CODER_MAP.set(client, coder)
  }
  return coder
}
