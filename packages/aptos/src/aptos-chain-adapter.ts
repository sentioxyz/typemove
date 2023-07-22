import {
  ChainAdapter,
  moduleQname,
  SPLITTER,
  TypeDescriptor,
  InternalMoveModule,
  InternalMoveStruct,
} from '@typemove/move'
import { AptosClient } from 'aptos'

import { Event, MoveModuleBytecode, MoveResource } from './move-types.js'
import { toInternalModule } from './to-internal.js'

export class AptosChainAdapter extends ChainAdapter<
  MoveModuleBytecode,
  Event | MoveResource
> {
  // static INSTANCE = new AptosChainAdapter()

  async fetchModules(account: string): Promise<MoveModuleBytecode[]> {
    const client = getRpcClient(this.endpoint)
    return await client.getAccountModules(account)
  }

  async fetchModule(
    account: string,
    module: string
  ): Promise<MoveModuleBytecode> {
    const client = getRpcClient(this.endpoint)
    return await client.getAccountModule(account, module)
  }

  toInternalModules(modules: MoveModuleBytecode[]): InternalMoveModule[] {
    return modules.flatMap((m) => (m.abi ? [toInternalModule(m)] : []))
  }

  getMeaningfulFunctionParams(params: TypeDescriptor[]): TypeDescriptor[] {
    if (params.length === 0) {
      return params
    }
    if (params[0].qname === 'signer' && params[0].reference) {
      params = params.slice(1)
    }
    return params
  }

  getAllEventStructs(modules: InternalMoveModule[]) {
    const eventMap = new Map<string, InternalMoveStruct>()
    const structMap = new Map<string, InternalMoveStruct>()
    for (const module of modules) {
      const qname = moduleQname(module)
      for (const struct of module.structs) {
        structMap.set(qname + SPLITTER + struct.name, struct)
      }
    }

    for (const module of modules) {
      for (const struct of module.structs) {
        for (const field of struct.fields) {
          const t = field.type
          if (t.qname === '0x1::event::EventHandle') {
            const event = t.typeArgs[0].qname
            const eventStruct = structMap.get(event)
            if (eventStruct) {
              eventMap.set(event, eventStruct)
            }
          }
        }
      }
    }
    return eventMap
  }

  getType(data: Event | MoveResource): string {
    return data.type
  }

  getData(data: Event | MoveResource) {
    if ('data' in data && 'type' in data) {
      return data.data
    }
    return data
  }
  // validateAndNormalizeAddress(address: string): string {
  //   return validateAndNormalizeAddress(address)
  // }
}

function getRpcClient(network: string): AptosClient {
  return new AptosClient(network)
}
