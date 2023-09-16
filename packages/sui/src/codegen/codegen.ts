import { SuiMoveNormalizedModule, SuiEvent, SuiMoveObject, SuiClient } from '@mysten/sui.js/client'

import * as fs from 'fs'
import chalk from 'chalk'
import {
  InternalMoveModule,
  InternalMoveStruct,
  AbstractCodegen,
  structQname,
  InternalMoveFunction,
  InternalMoveFunctionVisibility,
  normalizeToJSName,
  camel
} from '@typemove/move'
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
    return
  }
  const gen = new SuiCodegen(endpoint)
  const numFiles = await gen.generate(abisDir, outDir, builtin)
  console.log(chalk.green(`Generated ${numFiles} for Sui`))
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

  protected generateExtra(module: InternalMoveModule): string {
    const funcs = module.exposedFunctions.map((f) => this.generateBuilderForFunction(module, f))

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

  private generateArgs(module: InternalMoveModule, func: InternalMoveFunction) {
    const args = []
    for (const [idx, arg] of func.params.entries()) {
      if (arg.reference) {
        args.push({
          paramType: `${this.ADDRESS_TYPE} | ObjectCallArg | TransactionArgument`,
          callValue: `_args.push(TransactionArgument.is(args[${idx}]) ? args[${idx}] : tx.object(args[${idx}]))`
        })
      } else if (arg.isVector()) {
        args.push({
          paramType: `(${this.ADDRESS_TYPE} | ObjectCallArg)[] | TransactionArgument`,
          callValue: `_args.push(TransactionArgument.is(args[${idx}]) ? args[${idx}] : tx.makeMoveVec({
            objects: args[${idx}].map((a: any) => tx.object(a))
            // type: TODO
          }))`
        })
      } else {
        args.push({
          paramType: `${this.generateTypeForDescriptor(arg, module.address)} | TransactionArgument`,
          callValue: `_args.push(TransactionArgument.is(args[${idx}]) ? args[${idx}] : tx.pure(args[${idx}]))`
        })
      }
    }
    return args
  }

  protected generateViewFunction(module: InternalMoveModule, func: InternalMoveFunction): string {
    if (func.visibility !== InternalMoveFunctionVisibility.PUBLIC) {
      return ''
    }
    const genericString = this.generateFunctionTypeParameters(func)

    const typeParamArg = func.typeParams
      .map((v, idx) => {
        return `TypeDescriptor<T${idx}> | string`
      })
      .join(',')

    const args = this.generateArgs(module, func)
    const returnType = `${this.generateFunctionReturnTypeParameters(func, module.address)}`

    return `export async function ${camel(normalizeToJSName(func.name))}${genericString}(
      client: SuiClient,
      args: [${args.map((a) => a.paramType).join(',')}],
      ${
        typeParamArg.length > 0 ? `typeArguments: [${typeParamArg}]` : ``
      } ): Promise<TypedDevInspectResults<${returnType}>> {
      const tx = new TransactionBlock()
      builder.${camel(normalizeToJSName(func.name))}(tx, args ${typeParamArg.length > 0 ? `, typeArguments` : ''})
      const insepctRes = await client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: ZERO_ADDRESS
      })
      
      return (await getMoveCoder(client)).decodeDevInspectResult<${returnType}>(insepctRes)
    }`
  }

  protected generateBuilderForFunction(module: InternalMoveModule, func: InternalMoveFunction): string {
    if (func.visibility !== InternalMoveFunctionVisibility.PUBLIC) {
      return ''
    }

    const args = this.generateArgs(module, func)

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

    return `export function ${camel(normalizeToJSName(func.name))}${genericString}(tx: TransactionBlock, 
      args: [${args.map((a) => a.paramType).join(',')}],
      ${typeParamArg.length > 0 ? `typeArguments: [${typeParamArg}]` : ``} ):
       TransactionArgument & [ ${'TransactionArgument,'.repeat(func.params.length)} ] {
      const _args: any[] = []
      ${args.map((a) => a.callValue).join('\n')}
      
      // @ts-ignore
      return tx.moveCall({
        target: "${module.address}::${module.name}::${func.name}",
        arguments: _args,
        ${typeParamArg.length > 0 ? `typeArguments: [${typeParamToString}]` : ``}
      })
    }`
  }

  generateImports(): string {
    return `
      ${super.generateImports()}
      import { ZERO_ADDRESS, TypedDevInspectResults, getMoveCoder } from '@typemove/sui'
      import { TransactionBlock } from '@mysten/sui.js/transactions'
      import { ObjectCallArg, TransactionArgument } from '@mysten/sui.js'
      import { SuiClient } from '@mysten/sui.js/client'
    `
  }
}
