import { AbstractMoveCoder, InternalMoveModule, parseMoveType, TypeDescriptor } from '@typemove/move'
import { Event, MoveModuleBytecode, MoveResource, TransactionPayload_EntryFunctionPayload } from './move-types.js'
import { TypedEventInstance, TypedFunctionPayload, TypedMoveResource } from './models.js'
import { AptosChainAdapter } from './aptos-chain-adapter.js'
import { toInternalModule } from './to-internal.js'
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'

export class MoveCoder extends AbstractMoveCoder<MoveModuleBytecode, Event | MoveResource> {
  constructor(client: Aptos) {
    super(new AptosChainAdapter(client))
  }

  load(module: MoveModuleBytecode): InternalMoveModule {
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
    m = toInternalModule(module)
    this.loadInternal(m)
    return m
  }

  decodeEvent<T>(event: Event): Promise<TypedEventInstance<T> | undefined> {
    return this.decodedStruct(event)
  }
  filterAndDecodeEvents<T>(type: string | TypeDescriptor<T>, resources: Event[]): Promise<TypedEventInstance<T>[]> {
    if (typeof type === 'string') {
      type = parseMoveType(type)
    }
    return this.filterAndDecodeStruct(type, resources)
  }
  decodeResource<T>(res: MoveResource): Promise<TypedMoveResource<T> | undefined> {
    return this.decodedStruct(res)
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

  async decodeFunctionPayload(
    payload: TransactionPayload_EntryFunctionPayload
  ): Promise<TransactionPayload_EntryFunctionPayload> {
    const func = await this.getMoveFunction(payload.function)
    const params = this.adapter.getMeaningfulFunctionParams(func.params)
    const argumentsDecoded = await this.decodeArray(payload.arguments, params)

    return {
      ...payload,
      arguments_decoded: argumentsDecoded
    } as TypedFunctionPayload<any>
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

const DEFAULT_ENDPOINT = 'https://mainnet.aptoslabs.com/'
const CODER_MAP = new Map<string, MoveCoder>()

export function defaultMoveCoder(endpoint: string = DEFAULT_ENDPOINT): MoveCoder {
  let coder = CODER_MAP.get(endpoint)
  if (!coder) {
    const config = new AptosConfig({ network: Network.LOCAL, fullnode: endpoint })
    coder = new MoveCoder(new Aptos(config))
    CODER_MAP.set(endpoint, coder)
  }
  return coder
}
