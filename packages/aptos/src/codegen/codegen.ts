import * as fs from 'fs'
import { Event, MoveModuleBytecode, MoveResource } from '../move-types.js'
import chalk from 'chalk'
import { join } from 'path'
import { AptosChainAdapter } from '../aptos-chain-adapter.js'
import { AbstractCodegen, camel, InternalMoveFunction, InternalMoveModule, normalizeToJSName } from '@typemove/move'

export async function codegen(
  abisDir: string,
  outDir = join('src', 'types', 'aptos'),
  endpoint: string,
  genExample = false,
  builtin = false
) {
  if (!fs.existsSync(abisDir)) {
    return
  }
  const gen = new AptosCodegen(endpoint)
  const numFiles = await gen.generate(abisDir, outDir, builtin)
  console.log(chalk.green(`Generated ${numFiles} for Aptos`))
}

class AptosCodegen extends AbstractCodegen<MoveModuleBytecode, Event | MoveResource> {
  ADDRESS_TYPE = 'Address'
  REFERENCE_TYPE = 'Address'
  PREFIX = 'Aptos'
  SYSTEM_PACKAGE = '@typemove/aptos'

  constructor(endpoint: string) {
    super(new AptosChainAdapter(endpoint))
  }

  generateImports(): string {
    return `
      ${super.generateImports()}
      import { AptosClient, AptosAccount, TransactionBuilderRemoteABI, Types, TxnBuilderTypes, OptionalTransactionArgs } from 'aptos'
    `
  }
  protected generateExtra(module: InternalMoveModule) {
    const funcs = module.exposedFunctions.map((f) => this.generateEntryForFunction(module, f))

    const viewFuncs = module.exposedFunctions.map((f) => this.generateViewFunction(module, f))

    return `
    export namespace entry {
      ${funcs.join('\n')}
    }
    export namespace view {
      ${viewFuncs.join('\n')}
    }
    `
  }

  protected generateViewFunction(module: InternalMoveModule, func: InternalMoveFunction): string {
    if (!func.isView) {
      return ''
    }
    const genericString = this.generateFunctionTypeParameters(func)
    const fields = this.chainAdapter.getMeaningfulFunctionParams(func.params).map((param) => {
      return this.generateTypeForDescriptor(param, module.address)
    })

    const returns = func.return.map((param) => {
      return this.generateTypeForDescriptor(param, module.address)
    })

    const typeParamArg = func.typeParams
      .map((v, idx) => {
        return `TypeDescriptor<T${idx}> | string`
      })
      .join(',')

    // const args = this.generateArgs(module, func)

    return `export async function ${camel(normalizeToJSName(func.name))}${genericString}(
    client: AptosClient,
    request: {
      type_arguments: [${func.typeParams.map((_) => 'string').join(', ')}], 
      arguments: [${fields.join(',')}]},
    version?: bigint): Promise<[${returns.join(',')}]> {
      const coder = defaultMoveCoder(client.nodeUrl)
      const data = { 
        type_arguments: request.type_arguments,
        arguments: coder.encodeArray(request.arguments),
        function: "${module.address}::${module.name}::${func.name}"
      }
      const res = await client.view(data, version?.toString())
      const type = await coder.getMoveFunction("${module.address}::${module.name}::${func.name}")
      return await coder.decodeArray(res, type.return) as any
    }`
  }

  protected generateEntryForFunction(module: InternalMoveModule, func: InternalMoveFunction): string {
    if (!func.isEntry) {
      return ''
    }
    const genericString = this.generateFunctionTypeParameters(func)
    const fields = this.chainAdapter.getMeaningfulFunctionParams(func.params).map((param) => {
      return this.generateTypeForDescriptor(param, module.address)
    })

    // const typeParamArg = func.typeParams
    //     .map((v, idx) => {
    //       return `TypeDescriptor<T${idx}> | string`
    //     })
    //     .join(',')
    //
    // const args = this.generateArgs(module, func)

    return `export async function ${camel(normalizeToJSName(func.name))}${genericString}(
      client: AptosClient,
      account: AptosAccount,
      request: {
        type_arguments: [${func.typeParams.map((_) => 'string').join(', ')}], 
        arguments: [${fields.join(',')}]
      },
      extraArgs?: OptionalTransactionArgs
    ): Promise<Types.PendingTransaction> {
      const coder = defaultMoveCoder(client.nodeUrl)
      const builder = new TransactionBuilderRemoteABI(client, { sender: account.address(), ...extraArgs });
      const txn = await builder.build("${module.address}::${module.name}::${
      func.name
    }", request.type_arguments, coder.encodeArray(request.arguments))
      const bcsTxn = AptosClient.generateBCSTransaction(account, txn)
      return await client.submitSignedBCSTransaction(bcsTxn)
    }`
  }
}
