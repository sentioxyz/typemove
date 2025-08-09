import { SuiMoveNormalizedModule, SuiEvent, SuiMoveObject, SuiClient } from '@mysten/sui/client'

import * as fs from 'fs'
import chalk from 'chalk'
import {
  InternalMoveModule,
  InternalMoveStruct,
  structQname,
  InternalMoveFunction,
  InternalMoveFunctionVisibility,
  normalizeToJSName,
  camel
} from '@typemove/move'
import { AbstractCodegen } from '@typemove/move/codegen'
import { join } from 'path'
import { SuiChainAdapter } from '../sui-chain-adapter.js'

export async function codegen(
  abisDir: string,
  outDir = join('src', 'types', 'sui'),
  endpoint: string,
  genExample = false,
  builtin = false
) {
  if (!fs.existsSync(abisDir)) {
    console.error(chalk.red(`ABIs directory ${abisDir} does not exist`))
    return 0
  }
  try {
    const gen = new SuiCodegen(endpoint)
    const numFiles = await gen.generate(abisDir, outDir, builtin)
    if (numFiles > 0) {
      console.log(chalk.green(`Generated for ${numFiles} accounts for Sui to ${outDir}`))
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

export class SuiCodegen extends AbstractCodegen<
  // SuiNetwork,
  SuiMoveNormalizedModule,
  SuiEvent | SuiMoveObject
> {
  ADDRESS_TYPE = 'string'
  SYSTEM_PACKAGE = '@typemove/sui'
  // ADDRESS_TYPE = 'string'
  // MAIN_NET = SuiNetwork.MAIN_NET
  // TEST_NET = SuiNetwork.TEST_NET
  PREFIX = 'Sui'
  // STRUCT_FIELD_NAME = 'fields'
  // GENERATE_ON_ENTRY = true
  PAYLOAD_OPTIONAL = true

  constructor(endpoint: string) {
    super(new SuiChainAdapter(new SuiClient({ url: endpoint })))
  }

  readModulesFile(fullPath: string) {
    const res = super.readModulesFile(fullPath)
    if (res.result) {
      return res.result
    }
    return res
  }

  generateStructs(module: InternalMoveModule, struct: InternalMoveStruct, events: Set<string>): string {
    let content = ''
    switch (structQname(module, struct)) {
      // TODO they should still have module code generated
      case '0x1::ascii::Char':
      case '0x1::ascii::String':
      case '0x2::object::ID':
        content += `export type ${struct.name} = string`
        break
      case '0x2::coin::Coin':
        content += `export type ${struct.name}<T> = string`
        break
      case '0x2::balance::Balance':
        content += `export type ${struct.name}<T> = bigint`
        break
      case '0x1::option::Option':
        content += `export type Option<T> = T | undefined`
        break
    }
    return content + super.generateStructs(module, struct, events, content !== '')
  }

  generateForEvents(module: InternalMoveModule, struct: InternalMoveStruct): string {
    switch (structQname(module, struct)) {
      case '0x1::ascii::Char':
      case '0x1::ascii::String':
      case '0x2::object::ID':
      case '0x2::coin::Coin':
      case '0x1::option::Option':
      case '0x2::balance::Balance':
        return ''
    }
    return super.generateForEvents(module, struct)
  }

  protected generateExtra(address: string | undefined, module: InternalMoveModule): string {
    const funcs = module.exposedFunctions.map((f) =>
      this.generateBuilderForFunction(address || module.address, module, f)
    )

    const viewFuncs = module.exposedFunctions.map((f) => this.generateViewFunction(module, f))

    return `
    export namespace builder {
      ${funcs.join('\n')}
    }
    export namespace view {
      ${viewFuncs.join('\n')}
    }
    `
  }

  private generateArgs(module: InternalMoveModule, func: InternalMoveFunction, isView: boolean) {
    const args = []
    const argsLen = func.params.length
    for (const [idx, arg] of func.params.entries()) {
      if (idx === argsLen - 1 && arg.qname === '0x2::tx_context::TxContext') {
        // no op
      } else if (arg.reference) {
        args.push({
          paramType: isView ? this.ADDRESS_TYPE : `${this.ADDRESS_TYPE} | TransactionObjectArgument`,
          callValue: `_args.push(transactionArgumentOrObject(args[${idx}], tx))`
        })
      } else if (arg.isVector()) {
        // TODO fix pure vector
        args.push({
          paramType: isView
            ? `${this.ADDRESS_TYPE}[]`
            : `(${this.ADDRESS_TYPE} | TransactionObjectArgument)[] | TransactionArgument`,
          callValue: `_args.push(transactionArgumentOrVec(args[${idx}], tx))`
        })
      } else {
        // Handle pure type
        let pureFunction = ''
        const paramType = isView
          ? this.generateTypeForDescriptor(arg, module.address)
          : `${this.generateTypeForDescriptor(arg, module.address)} | TransactionArgument`

        switch (arg.qname.toLowerCase()) {
          case 'u8':
            pureFunction = `transactionArgumentOrPureU8`
            break
          case 'u16':
            pureFunction = `transactionArgumentOrPureU16`
            break
          case 'u32':
            pureFunction = `transactionArgumentOrPureU32`
            break
          case 'u64':
            pureFunction = `transactionArgumentOrPureU64`
            break
          case 'u128':
            pureFunction = `transactionArgumentOrPureU128`
            break
          case 'u256':
            pureFunction = `transactionArgumentOrPureU256`
            break
          case 'bool':
            pureFunction = `transactionArgumentOrPureBool`
            break
          case 'string':
            pureFunction = `transactionArgumentOrPureString`
            break
          case 'address':
            pureFunction = `transactionArgumentOrPureAddress`
            break
          // case 'vector':
          // case 'option':
          default:
            pureFunction = `transactionArgumentOrPure`
          //   paramType = 'TransactionArgument'
        }
        const callValue = pureFunction ? `_args.push(${pureFunction}(args[${idx}], tx))` : `_args.push(args[${idx}])`

        args.push({
          paramType,
          callValue
        })
      }
    }
    return args
  }

  protected generateViewFunction(module: InternalMoveModule, func: InternalMoveFunction): string {
    if (func.visibility === InternalMoveFunctionVisibility.PRIVATE) {
      return ''
    }
    const genericString = this.generateFunctionTypeParameters(func)

    const typeParamArg = func.typeParams
      .map((v, idx) => {
        return `TypeDescriptor<T${idx}> | string`
      })
      .join(',')

    const args = this.generateArgs(module, func, true)
    const returnType = `${this.generateFunctionReturnTypeParameters(func, module.address)}`

    return `export async function ${camel(normalizeToJSName(func.name))}${genericString}(
      client: SuiClient,
      args: [${args.map((a) => a.paramType).join(',')}],
      ${
        typeParamArg.length > 0 ? `typeArguments: [${typeParamArg}]` : ``
      } ): Promise<TypedDevInspectResults<${returnType}>> {
      const tx = new Transaction()
      builder.${camel(normalizeToJSName(func.name))}(tx, args ${typeParamArg.length > 0 ? `, typeArguments` : ''})
      const inspectRes = await client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: ZERO_ADDRESS
      })

      return (await getMoveCoder(client)).decodeDevInspectResult<${returnType}>(inspectRes)
    }`
  }

  protected generateBuilderForFunction(
    address: string,
    module: InternalMoveModule,
    func: InternalMoveFunction
  ): string {
    if (func.visibility === InternalMoveFunctionVisibility.PRIVATE && func.isEntry !== true) {
      return ''
    }

    const args = this.generateArgs(module, func, false)

    const genericString = this.generateFunctionTypeParameters(func)

    const typeParamArg = func.typeParams
      .map((v, idx) => {
        return `TypeDescriptor<T${idx}> | string`
      })
      .join(',')
    const typeParamToString = func.typeParams
      .map((v, idx) => {
        return `typeof typeArguments[${idx}] === 'string' ? typeArguments[${idx}] : typeArguments[${idx}].getSignature()`
      })
      .join(',')

    return `export function ${camel(normalizeToJSName(func.name))}${genericString}(tx: Transaction,
      args: [${args.map((a) => a.paramType).join(',')}],
      ${typeParamArg.length > 0 ? `typeArguments: [${typeParamArg}]` : ``} ):
       TransactionArgument & [ ${'TransactionArgument,'.repeat(args.length)} ] {
      const _args: any[] = []
      ${args.map((a) => a.callValue).join('\n')}

      // @ts-ignore
      return tx.moveCall({
        target: "${address}::${module.name}::${func.name}",
        arguments: _args,
        ${typeParamArg.length > 0 ? `typeArguments: [${typeParamToString}]` : ``}
      })
    }`
  }

  generateImports(): string {
    return `
      ${super.generateImports()}
      import { ZERO_ADDRESS, TypedDevInspectResults, getMoveCoder } from '@typemove/sui'
      import { Transaction, TransactionArgument, TransactionObjectArgument } from '@mysten/sui/transactions'
      import { SuiClient } from '@mysten/sui/client'
      import {  transactionArgumentOrObject, 
                transactionArgumentOrVec,
                transactionArgumentOrPure,
                transactionArgumentOrPureU8,
                transactionArgumentOrPureU16,
                transactionArgumentOrPureU32,
                transactionArgumentOrPureU64,
                transactionArgumentOrPureU128,
                transactionArgumentOrPureU256,
                transactionArgumentOrPureBool,
                transactionArgumentOrPureString,
                transactionArgumentOrPureAddress,
      } from '@typemove/sui'
    `
  }
}
