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
import type { SuiClientTypes } from '@mysten/sui/client'

// Decoder-input types now use @mysten/sui/client's unified SuiClientTypes —
// the same shapes returned by SuiGrpcClient (and that the GraphQL/JSON-RPC
// clients implement). Per the SDK's own warnings, the `.json` field's exact
// field names may vary between transports for some payloads; downstream code
// reading `getData` should treat it as opaque object data.
export type SuiEventInput = SuiClientTypes.Event
export type SuiMoveObjectInput = SuiClientTypes.Object<{ json: true }>

// Adapter ModuleType is the proto Module plus the package address (which the
// proto doesn't carry per-entry — only the wrapping Package has storageId).
export interface ModuleWithAddress {
  address: string
  module: GrpcTypes.Module
}

export class SuiChainAdapter extends ChainAdapter<ModuleWithAddress, SuiEventInput | SuiMoveObjectInput> {
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

  getType(base: SuiEventInput | SuiMoveObjectInput): string {
    // Unified SuiClientTypes: Event has `eventType`, Object has `type`.
    const v = base as any
    return v.eventType ?? v.type ?? ''
  }

  getData(val: SuiEventInput | SuiMoveObjectInput) {
    if (val === undefined) {
      throw Error('val is undefined')
    }
    // Pass through primitives (e.g. a UID flattened to a bare string) — the
    // decoder's per-type case handlers know how to interpret them.
    if (val === null || typeof val !== 'object') {
      return val as any
    }
    const v = val as any
    // Unified SuiClientTypes shapes: Event.json / Object<{json:true}>.json
    // carries the decoded Move struct content. Anything else (a nested
    // already-flat struct value passed in during recursion) is its own data.
    if (v.json != null) {
      return v.json as any
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

// gRPC counterpart of @mysten/sui/jsonRpc's `getJsonRpcFullnodeUrl`. The SDK
// doesn't ship one under /grpc — Sui's gRPC-Web endpoint is exposed on the
// same host as JSON-RPC over standard HTTPS, so we mirror the JSON-RPC list
// (sans the explicit :443 since the transport speaks HTTPS by default).
export function getGrpcFullnodeUrl(network: 'mainnet' | 'testnet' | 'devnet' | 'localnet'): string {
  switch (network) {
    case 'mainnet':
      return 'https://fullnode.mainnet.sui.io'
    case 'testnet':
      return 'https://fullnode.testnet.sui.io'
    case 'devnet':
      return 'https://fullnode.devnet.sui.io'
    case 'localnet':
      return 'http://127.0.0.1:9000'
  }
}

export function getGrpcClient(endpoint: string): SuiGrpcClient {
  const network = inferNetworkFromUrl(endpoint) as any
  return new SuiGrpcClient({ network, baseUrl: endpoint })
}
