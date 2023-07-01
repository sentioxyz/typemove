import {
  SuiMoveNormalizedModule,
  SuiEvent,
  SuiMoveObject,
} from '@mysten/sui.js'

import * as fs from 'fs'
import chalk from 'chalk'
import {
  InternalMoveModule,
  InternalMoveStruct,
  AbstractCodegen,
  structQname,
  InternalMoveFunction,
} from '@typemove/move'
import { join } from 'path'
import { SuiChainAdapter } from '../sui-chain-adapter.js'
import { camel } from 'radash'

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

class SuiCodegen extends AbstractCodegen<
  // SuiNetwork,
  SuiMoveNormalizedModule,
  SuiEvent | SuiMoveObject
> {
  ADDRESS_TYPE = 'SuiAddress'
  REFERENCE_TYPE = 'ObjectId'
  // ADDRESS_TYPE = 'string'
  // MAIN_NET = SuiNetwork.MAIN_NET
  // TEST_NET = SuiNetwork.TEST_NET
  PREFIX = 'Sui'
  // STRUCT_FIELD_NAME = 'fields'
  // GENERATE_ON_ENTRY = true
  PAYLOAD_OPTIONAL = true

  constructor(endpoint: string) {
    super(new SuiChainAdapter(endpoint))
  }

  readModulesFile(fullPath: string) {
    const res = super.readModulesFile(fullPath)
    if (res.result) {
      return res.result
    }
    return res
  }

  generateStructs(
    module: InternalMoveModule,
    struct: InternalMoveStruct,
    events: Set<string>
  ): string {
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
    return (
      content + super.generateStructs(module, struct, events, content !== '')
    )
  }

  generateForEvents(
    module: InternalMoveModule,
    struct: InternalMoveStruct
  ): string {
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

  protected generateBuilder(module: InternalMoveModule): string {
    const funcs = module.exposedFunctions.map((f) =>
      this.generateBuilderForFunction(module, f)
    )

    return `
    export namespace builder {
      ${funcs.join('\n')}
    }
    `
  }

  protected generateBuilderForFunction(
    module: InternalMoveModule,
    func: InternalMoveFunction
  ): string {
    if (!func.isEntry) {
      return ''
    }

    const args = []
    for (const [idx, arg] of func.params.entries()) {
      if (arg.reference) {
        args.push({
          paramType: 'ObjectId | ObjectCallArg | TransactionArgument',
          callValue: `_args.push(TransactionArgument.is(args[${idx}]) ? args[${idx}] : tx.object(args[${idx}]))`,
        })
      } else if (arg.isVector()) {
        args.push({
          paramType: '(ObjectId | ObjectCallArg)[] | TransactionArgument',
          callValue: `_args.push(TransactionArgument.is(args[${idx}]) ? args[${idx}] : tx.makeMoveVec({
            objects: args[${idx}].map(a => tx.object(a))
            // type: TODO
          }))`,
        })
      } else {
        args.push({
          paramType: `${this.generateTypeForDescriptor(
            arg,
            module.address
          )} | TransactionArgument`,
          callValue: `_args.push(TransactionArgument.is(args[${idx}]) ? args[${idx}] : tx.pure(args[${idx}]))`,
        })
      }
    }

    const genericString = this.generateFunctionTypeParameters(func)

    return `export function ${camel(
      func.name
    )}${genericString}(tx: TransactionBlock, args: [${args
      .map((a) => a.paramType)
      .join(',')}] ): TransactionArgument & [ ${'TransactionArgument,'.repeat(
      func.params.length
    )} ] {
      const _args = []
      ${args.map((a) => a.callValue).join('\n')}
      
      // @ts-ignore
      return tx.moveCall({
        target: "${module.address}::${module.name}::${func.name}",
        arguments: _args
        // typeArguments: 
      })
    }`
  }

  generateImports(): string {
    return `
      ${super.generateImports()}
      import { TransactionBlock, TransactionArgument, ObjectCallArg } from '@mysten/sui.js'
    `
  }
}
