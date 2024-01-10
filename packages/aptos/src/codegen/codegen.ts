import * as fs from 'fs'
import chalk from 'chalk'
import { join } from 'path'
import { AptosChainAdapter } from '../aptos-chain-adapter.js'
import { AbstractCodegen, camel, InternalMoveFunction, InternalMoveModule, normalizeToJSName } from '@typemove/move'
import { Aptos, AptosConfig, Event, MoveModuleBytecode, MoveResource } from '@aptos-labs/ts-sdk'

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
  ADDRESS_TYPE = 'MoveAddressType'
  PREFIX = 'Aptos'
  SYSTEM_PACKAGE = '@typemove/aptos'

  constructor(endpoint: string) {
    super(new AptosChainAdapter(new Aptos(new AptosConfig({ fullnode: endpoint }))))
  }

  generateImports(): string {
    return `
      ${super.generateImports()}
      import { Aptos, Account as AptosAccount, MoveAddressType, PendingTransactionResponse, InputGenerateTransactionOptions, MoveStructId, InputViewRequestData } from '@aptos-labs/ts-sdk'
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
      ${func.typeParams.length > 0 ? `typeArguments: [${func.typeParams.map((_) => 'MoveStructId').join(', ')}],` : ''}
      ${func.params.length > 0 ? `functionArguments: [${fields.join(',')}]` : ''}},`

    return `export async function ${camel(normalizeToJSName(func.name))}${genericString}(
    client: Aptos,
    ${requestArg}
    version?: bigint): Promise<[${returns.join(',')}]> {
      const coder = defaultMoveCoder(client.config.fullnode)        
      const data: InputViewRequestData = {
        function: "${module.address}::${module.name}::${func.name}",
        functionArguments: ${func.params.length > 0 ? 'coder.encodeArray(request.functionArguments)' : '[]'},
        typeArguments: ${func.typeParams.length > 0 ? 'request.typeArguments' : '[]'},
      }
      const res = await client.view({payload: data, options: { ledgerVersion: version } });
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
      client: Aptos,
      account: AptosAccount,
      request: {
        typeArguments: [${func.typeParams.map((_) => 'MoveStructId').join(', ')}], 
        functionArguments: [${fields.join(',')}]
      },
      options?: InputGenerateTransactionOptions
    ): Promise<PendingTransactionResponse> {
      const coder = defaultMoveCoder(client.config.fullnode)  
      const transaction = await client.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: "${module.address}::${module.name}::${func.name}",
          functionArguments: ${func.params.length > 0 ? 'coder.encodeArray(request.functionArguments)' : '[]'},
          typeArguments: ${func.typeParams.length > 0 ? 'request.typeArguments' : '[]'},
        },
        options
      })
      return await client.signAndSubmitTransaction({ signer: account, transaction });
    }`
  }
}
