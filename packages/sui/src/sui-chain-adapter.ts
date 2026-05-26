import { toInternalModule } from './to-internal.js'
import {
  InternalMoveModule,
  InternalMoveStruct,
  ChainAdapter,
  moduleQname,
  SPLITTER,
  TypeDescriptor
} from '@typemove/move'

import type { GrpcTypes } from '@mysten/sui/grpc'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import type { SuiEvent, SuiMoveObject } from '@mysten/sui/jsonRpc'

// Decoder-input types stay sourced from `/jsonRpc` because they describe the
// runtime shape of events/objects that upstream processors hand to MoveCoder.
// We are not migrating the data ingestion path here — only the codegen / ABI
// fetch path.

// Adapter ModuleType is the proto Module plus the package address (which the
// proto doesn't carry per-entry — only the wrapping Package has storageId).
export interface ModuleWithAddress {
  address: string
  module: GrpcTypes.Module
}

export class SuiChainAdapter extends ChainAdapter<ModuleWithAddress, SuiEvent | SuiMoveObject> {
  client: SuiGrpcClient

  constructor(client: SuiGrpcClient) {
    super()
    this.client = client
  }

  async getChainId(): Promise<string> {
    const { chainIdentifier } = await this.client.core.getChainIdentifier()
    return chainIdentifier ?? ''
  }

  async fetchModule(account: string, module: string): Promise<ModuleWithAddress> {
    // gRPC has no single-module-fetch RPC; pull the whole package and filter.
    const modules = await this.fetchModules(account)
    const m = modules.find((x) => x.module.name === module)
    if (!m) {
      throw Error(`Module ${module} not found in package ${account}`)
    }
    return m
  }

  async fetchModules(account: string): Promise<ModuleWithAddress[]> {
    const { response } = await this.client.movePackageService.getPackage({ packageId: account })
    const pkg = response.package
    if (!pkg) {
      throw Error(`No package returned for ${account}`)
    }
    // gRPC returns the canonical long-form storage id (0x0000...0002); the rest
    // of typemove keys system packages by their short form (0x2). Preserve the
    // caller-supplied address so framework lookups and short-form import paths
    // (`@typemove/sui/builtin/0x2`) keep working.
    return (pkg.modules ?? []).map((module) => ({ address: account, module }))
  }

  getMeaningfulFunctionParams(params: TypeDescriptor[]): TypeDescriptor[] {
    return params
  }

  toInternalModules(modules: ModuleWithAddress[]): InternalMoveModule[] {
    return modules.map(({ address, module }) => toInternalModule(module, address))
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
    if (val === undefined) {
      throw Error('val is undefined')
    }
    if ('parsedJson' in val) {
      return val.parsedJson as any
    }
    if (val.dataType === 'moveObject') {
      return val.fields as any
    }
    if ('fields' in val) {
      if ('type' in val && Object.keys(val).length === 2) {
        return val.fields as any
      }
    }
    return val as any
  }
}

export function inferNetworkFromUrl(url: string): string {
  if (url.includes('mainnet')) return 'mainnet'
  if (url.includes('testnet')) return 'testnet'
  if (url.includes('devnet')) return 'devnet'
  if (url.includes('localnet') || url.includes('127.0.0.1') || url.includes('localhost')) return 'localnet'
  return 'custom'
}

export function getGrpcClient(endpoint: string): SuiGrpcClient {
  const network = inferNetworkFromUrl(endpoint) as any
  return new SuiGrpcClient({ network, baseUrl: endpoint })
}
