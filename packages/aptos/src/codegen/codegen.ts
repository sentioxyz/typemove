import * as fs from 'fs'
import { Event, MoveModuleBytecode, MoveResource } from '../move-types.js'
import chalk from 'chalk'
import { join } from 'path'
import { AptosChainAdapter } from '../aptos-chain-adapter.js'
import { AbstractCodegen, camel, InternalMoveFunction, InternalMoveModule, normalizeToJSName } from '@typemove/move'
import { AptosClient } from 'aptos'

export async function codegen(
  abisDir: string,
  outDir = join('src', 'types', 'aptos'),
  endpoint: string,
  genExample = false,
  builtin = false
) {
  if (!fs.existsSync(abisDir)) {
    console.error(chalk.red(`ABIs directory ${abisDir} does not exist`))
    return 0
  }
  const gen = new AptosCodegen(endpoint)
  try {
    const numFiles = await gen.generate(abisDir, outDir, builtin)
    if (numFiles > 0) {
      console.log(chalk.green(`Generated for ${numFiles} accounts for Aptos to ${outDir}`))
    } else {
      console.error(chalk.red(`No account found`))
    }
    return numFiles
  } catch (e) {
    console.error(chalk.red(`Failed to generate for ${abisDir}, please check if ABI json files are valid`))
    console.log(e)
    return 0
  }
}

export class AptosCodegen extends AbstractCodegen<MoveModuleBytecode, Event | MoveResource> {
  ADDRESS_TYPE = 'Address'
  PREFIX = 'Aptos'
  SYSTEM_PACKAGE = '@typemove/aptos'

  constructor(endpoint: string) {
    super(new AptosChainAdapter(new AptosClient(endpoint)))
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
    const allEmpty = func.typeParams.length === 0 && func.params.length === 0
    const requestArg = allEmpty
      ? ''
      : `request: {
      ${func.typeParams.length > 0 ? `type_arguments: [${func.typeParams.map((_) => 'string').join(', ')}],` : ''}
      ${func.params.length > 0 ? `arguments: [${fields.join(',')}]` : ''}},`

    return `export async function ${camel(normalizeToJSName(func.name))}${genericString}(
    client: AptosClient,
    ${requestArg}
    version?: bigint): Promise<[${returns.join(',')}]> {
      const coder = defaultMoveCoder(client.nodeUrl)
      const data = { 
        type_arguments:  ${func.typeParams.length > 0 ? 'request.type_arguments' : '[]'},
        arguments: ${func.params.length > 0 ? 'coder.encodeArray(request.arguments)' : '[]'},
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
