import { toInternalModule } from './to-internal.js'
import {
  InternalMoveModule,
  InternalMoveStruct,
  ChainAdapter,
  moduleQname,
  SPLITTER,
  TypeDescriptor
} from '@typemove/move'

import { SuiMoveNormalizedModule, SuiEvent, SuiMoveObject, SuiJsonRpcClient } from '@mysten/sui/jsonRpc'

export class SuiChainAdapter extends ChainAdapter<
  // SuiNetwork,
  SuiMoveNormalizedModule,
  SuiEvent | SuiMoveObject
> {
  async getChainId() {
    return this.client.getChainIdentifier()
  }
  // static INSTANCE = new SuiChainAdapter()

  client: SuiJsonRpcClient
  constructor(client: SuiJsonRpcClient) {
    super()
    this.client = client
  }

  async fetchModule(
    account: string,
    module: string
    // network: SuiNetwork
  ): Promise<SuiMoveNormalizedModule> {
    return await this.client.getNormalizedMoveModule({ package: account, module })
  }

  async fetchModules(
    account: string
    // network: SuiNetwork
  ): Promise<SuiMoveNormalizedModule[]> {
    const modules = await this.client.getNormalizedMoveModulesByPackage({
      package: account
    })
    return Object.values(modules)
  }

  getMeaningfulFunctionParams(params: TypeDescriptor[]): TypeDescriptor[] {
    return params
    // if (params.length === 0) {
    //   return params
    // }
    // return params.slice(0, params.length - 1)
  }

  toInternalModules(modules: SuiMoveNormalizedModule[]): InternalMoveModule[] {
    return Object.values(modules).map(toInternalModule)
  }

  getAllEventStructs(modules: InternalMoveModule[]): Map<string, InternalMoveStruct> {
    const eventMap = new Map<string, InternalMoveStruct>()

    for (const module of modules) {
      const qname = moduleQname(module)

      for (const struct of module.structs) {
        const abilities = new Set(struct.abilities)
        if (abilities.has('Drop') && abilities.has('Copy')) {
          eventMap.set(qname + SPLITTER + struct.name, struct)
        }
      }
    }
    return eventMap
  }

  getType(base: SuiEvent | SuiMoveObject): string {
    return base.type
  }

  getData(val: SuiEvent | SuiMoveObject) {
    // if (val.parsedJson) {
    //   return val.parsedJson as any
    // }
    if (val === undefined) {
      throw Error('val is undefined')
    }
    if ('parsedJson' in val) {
      return val.parsedJson as any
    }
    // if (SuiParsedData.is(val)) {
    //   return val.fields as any
    // }
    if (val.dataType === 'moveObject') {
      return val.fields as any
    }
    // if (SuiMoveObject.is(val)) {
    //   return val.fields as any
    // }
    // This may not be perfect, just think everything has
    if ('fields' in val) {
      if ('type' in val && Object.keys(val).length === 2) {
        return val.fields as any
      }
    }
    return val as any
  }
  // validateAndNormalizeAddress(address: string) {
  //   return validateAndNormalizeAddress(address)
  // }
}

export function inferNetworkFromUrl(url: string): string {
  if (url.includes('mainnet')) return 'mainnet'
  if (url.includes('testnet')) return 'testnet'
  if (url.includes('devnet')) return 'devnet'
  if (url.includes('localnet') || url.includes('127.0.0.1') || url.includes('localhost')) return 'localnet'
  return 'custom'
}

function getRpcClient(endpoint: string): SuiJsonRpcClient {
  return new SuiJsonRpcClient({ url: endpoint, network: inferNetworkFromUrl(endpoint) })
}
