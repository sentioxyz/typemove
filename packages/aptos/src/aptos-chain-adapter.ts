import {
  ChainAdapter,
  moduleQname,
  SPLITTER,
  TypeDescriptor,
  InternalMoveModule,
  InternalMoveStruct
} from '@typemove/move'

import { Aptos, Event, MoveModuleBytecode, MoveResource } from '@aptos-labs/ts-sdk'
import { toInternalModule } from './to-internal.js'

export class AptosChainAdapter extends ChainAdapter<MoveModuleBytecode, Event | MoveResource> {
  // static INSTANCE = new AptosChainAdapter()
  client: Aptos
  private optimisticEventDetection: boolean = true

  constructor(client: Aptos, optimisticEventDetection = true) {
    super()
    this.client = client
    this.optimisticEventDetection = optimisticEventDetection
  }

  async fetchModules(account: string): Promise<MoveModuleBytecode[]> {
    return await this.client.getAccountModules({
      accountAddress: account
    })
  }

  async fetchModule(account: string, module: string): Promise<MoveModuleBytecode> {
    return await this.client.getAccountModule({
      accountAddress: account,
      moduleName: module
    })
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
        const typeName = qname + SPLITTER + struct.name

        // Skip deprecated v2 events
        if (typeName == '0x1::coin::Deposit' || typeName == '0x1::coin::Withdraw') {
          continue
        }

        structMap.set(typeName, struct)

        // Check if struct is explicitly marked as event
        if (struct.isEvent) {
          eventMap.set(typeName, struct)
          continue
        }

        if (struct.name.endsWith('Event')) {
          // this is a hack to support some old events
          eventMap.set(typeName, struct)
          continue
        }

        // Check for native events: structs with EXACTLY drop and store abilities
        if (this.optimisticEventDetection) {
          const abilities = new Set(struct.abilities)
          if (abilities.size === 2 && abilities.has('drop') && abilities.has('store')) {
            eventMap.set(typeName, struct)
          }
        }
      }
    }

    // Also check for legacy events (in EventHandle fields)
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

  async getChainId(): Promise<string> {
    return (await this.client.getChainId()).toString()
  }
  // validateAndNormalizeAddress(address: string): string {
  //   return validateAndNormalizeAddress(address)
  // }
}
