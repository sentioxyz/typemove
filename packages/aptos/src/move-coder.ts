import { AbstractMoveCoder, InternalMoveModule, parseMoveType, TypeDescriptor } from '@typemove/move'
import { TypedEventInstance, TypedFunctionPayload, TypedMoveResource } from './models.js'
import { AptosChainAdapter } from './aptos-chain-adapter.js'
import { toInternalModule } from './to-internal.js'
import {
  Aptos,
  AptosConfig,
  EntryFunctionPayloadResponse,
  Event,
  MoveModuleBytecode,
  MoveResource,
  MoveValue
} from '@aptos-labs/ts-sdk'

export class MoveCoder extends AbstractMoveCoder<MoveModuleBytecode, Event | MoveResource> {
  constructor(
    client: Aptos,
    readonly ignoreObjectInnerField: boolean = false
  ) {
    super(new AptosChainAdapter(client))
  }

  load(module: MoveModuleBytecode, address: string): InternalMoveModule {
    if (!module.abi) {
      throw Error('Module without abi')
    }
    let m = this.moduleMapping.get(module.abi.address + '::' + module.abi.name)
    // if (this.contains(module.abi.address, module.abi.name)) {
    //   return
    // }
    if (m) {
      return m
    }
    this.accounts.add(module.abi.address)
    m = toInternalModule(module)
    this.loadInternal(m, address)
    return m
  }

  decodeEvent<T>(event: Event): Promise<TypedEventInstance<T> | undefined> {
    // TODO fix type
    return this.decodedStruct(event)
  }
  filterAndDecodeEvents<T>(type: string | TypeDescriptor<T>, resources: Event[]): Promise<TypedEventInstance<T>[]> {
    if (typeof type === 'string') {
      type = parseMoveType(type)
    }
    // TODO fix type
    return this.filterAndDecodeStruct(type, resources)
  }
  decodeResource<T>(res: MoveResource): Promise<TypedMoveResource<T> | undefined> {
    return this.decodedStruct(res)
  }

  protected async decode(data: any, type: TypeDescriptor): Promise<any> {
    switch (type.qname) {
      case '0x1::object::Object':
        if (this.ignoreObjectInnerField && typeof data === 'string') {
          return data
        }
        if (typeof data === 'object' && data?.inner !== undefined && typeof data?.inner === 'string') {
          return data.inner
        }
    }
    return super.decode(data, type)
  }

  filterAndDecodeResources<T>(
    type: string | TypeDescriptor<T>,
    resources: MoveResource[]
  ): Promise<TypedMoveResource<T>[]> {
    if (typeof type === 'string') {
      type = parseMoveType(type)
    }
    return this.filterAndDecodeStruct(type, resources)
  }

  async decodeFunctionPayload<T extends Array<any>>(
    payload: EntryFunctionPayloadResponse
  ): Promise<TypedFunctionPayload<T>> {
    const func = await this.getMoveFunction(payload.function)
    const params = this.adapter.getMeaningfulFunctionParams(func.params)
    const argumentsDecoded = await this.decodeArray(payload.arguments, params)

    return {
      ...payload,
      arguments_decoded: argumentsDecoded
    } as TypedFunctionPayload<T>
  }

  toMoveValue(value: any): MoveValue {
    switch (typeof value) {
      case 'boolean':
        return value
      case 'number':
        return value
      case 'bigint':
        return value.toString()
      case 'object':
        if (Array.isArray(value)) {
          return value.map(this.toMoveValue)
        }
        return value
      default:
        return value.toString()
    }
  }
}

// const MOVE_CODER = new MoveCoder(AptosNetwork.MAIN_NET)
// const TESTNET_MOVE_CODER = new MoveCoder(AptosNetwork.TEST_NET)
//
// export function defaultMoveCoder(network: AptosNetwork = AptosNetwork.MAIN_NET): MoveCoder {
//   if (network == AptosNetwork.MAIN_NET) {
//     return MOVE_CODER
//   }
//   return TESTNET_MOVE_CODER
// }

const DEFAULT_ENDPOINT = 'https://mainnet.aptoslabs.com/v1'
const CODER_MAP = new Map<string, MoveCoder>()

export function defaultMoveCoder(endpoint: string = DEFAULT_ENDPOINT): MoveCoder {
  let coder = CODER_MAP.get(endpoint)
  if (!coder) {
    const config = new AptosConfig({ fullnode: endpoint })
    coder = new MoveCoder(new Aptos(config))
    CODER_MAP.set(endpoint, coder)
  }
  return coder
}
