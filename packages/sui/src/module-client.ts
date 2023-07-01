import { JsonRpcProvider } from '@mysten/sui.js'

export class ModuleClient {
  public async viewDecoded(
    func: string,
    typeArguments: string[],
    args: any[],
    ledger_version?: bigint
  ) {
    throw Error('not implemented')
  }
}

// const provider: JsonRpcProvider

//
// provider.

export class TypedJsonRpcProvider extends JsonRpcProvider {
  public xxx() {
    this.connection.fullnode
  }
}
