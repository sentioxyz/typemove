import { TypedDevInspectResults, TypedEventInstance, TypedFunctionPayload } from './models.js'
import {
  AbstractMoveCoder,
  ANY_TYPE,
  DecodedStruct,
  parseMoveType,
  SPLITTER,
  TypeDescriptor,
  InternalMoveModule
} from '@typemove/move'
import {
  MoveCallSuiTransaction,
  SuiCallArg,
  SuiEvent,
  SuiMoveNormalizedModule,
  SuiMoveObject,
  DevInspectResults,
  SuiClient
} from '@mysten/sui.js/client'
import { toInternalModule } from './to-internal.js'
import { SuiChainAdapter } from './sui-chain-adapter.js'
import { dynamic_field } from './builtin/0x2.js'
import { BCS, getSuiMoveConfig, StructTypeDefinition } from '@mysten/bcs'

// import { Encoding } from '@mysten/bcs/types', this doesn't get exported correctly
export type Encoding = 'base58' | 'base64' | 'hex'

import { normalizeSuiObjectId, normalizeSuiAddress } from '@mysten/sui.js/utils'

export class MoveCoder extends AbstractMoveCoder<
  // SuiNetwork,
  SuiMoveNormalizedModule,
  SuiEvent | SuiMoveObject
> {
  bcs = new BCS(getSuiMoveConfig())

  constructor(client: SuiClient) {
    super(new SuiChainAdapter(client))
  }

  load(module: SuiMoveNormalizedModule, address: string): InternalMoveModule {
    let m = this.moduleMapping.get(module.address + '::' + module.name)
    const mDeclared = this.moduleMapping.get(address + '::' + module.name)
    if (m && mDeclared) {
      return m
    }
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

  private async _registerBCSType(qname: string): Promise<void> {
    if (this.bcs.hasType(qname)) {
      return
    }
    const moveStruct = await this.getMoveStruct(qname)
    const structDef: StructTypeDefinition = {}

    for (const field of moveStruct.fields) {
      structDef[field.name] = field.type.getNormalizedSignature()
    }
    let typeName = qname
    const generics = moveStruct.typeParams.map((p, idx) => 'T' + idx).join(', ')
    if (generics) {
      typeName = typeName + '<' + generics + '>'
    }

    this.bcs.registerStructType(typeName, structDef)

    for (const field of moveStruct.fields) {
      await this.registerBCSTypes(field.type)
    }
  }

  private bcsRegistered = new Set<string>()

  async registerBCSTypes(type: TypeDescriptor): Promise<void> {
    const sig = type.getNormalizedSignature()
    if (this.bcsRegistered.has(sig)) {
      return
    }
    this.bcsRegistered.add(sig)

    await this._registerBCSType('0x1::string::String')

    for (const typeArg of type.dependedTypes()) {
      await this._registerBCSType(typeArg)
    }
  }

  async decodeBCS(type: TypeDescriptor, data: Uint8Array | string, encoding?: Encoding): Promise<any> {
    await this.registerBCSTypes(type)
    return this.bcs.de(type.getNormalizedSignature(), data, encoding)
  }

  async decodeDevInspectResult<T extends any[]>(inspectRes: DevInspectResults): Promise<TypedDevInspectResults<T>> {
    const returnValues = []
    if (inspectRes.results != null) {
      for (const r of inspectRes.results) {
        if (r.returnValues) {
          for (const returnValue of r.returnValues) {
            const type = parseMoveType(returnValue[1])
            const bcsDecoded = await this.decodeBCS(type, new Uint8Array(returnValue[0]))
            const decoded = await this.decodedType(bcsDecoded, type)
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

const DEFAULT_ENDPOINT = 'https://fullnode.mainnet.sui.io/'
const CODER_MAP = new Map<string, MoveCoder>()
const CHAIN_ID_CODER_MAP = new Map<string, MoveCoder>()

export function defaultMoveCoder(endpoint: string = DEFAULT_ENDPOINT): MoveCoder {
  let coder = CODER_MAP.get(endpoint)
  if (!coder) {
    coder = new MoveCoder(new SuiClient({ url: DEFAULT_ENDPOINT }))
    CODER_MAP.set(endpoint, coder)
  }
  return coder
}

const PROVIDER_CODER_MAP = new Map<SuiClient, MoveCoder>()

let DEFAULT_CHAIN_ID: string | undefined

export async function getMoveCoder(client: SuiClient): Promise<MoveCoder> {
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
