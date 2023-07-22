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
      import { AptosClient } from 'aptos'
    `
  }
  protected generateExtra(module: InternalMoveModule) {
    // const funcs = module.exposedFunctions.map((f) =>
    //     this.generateBuilderForFunction(module, f)
    // )

    const viewFuncs = module.exposedFunctions.map((f) => this.generateViewFunction(module, f))

    // export namespace builder {
    //   ${funcs.join('\n')}
    // }

    return `
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
      const data = { ...request, function: "${module.address}::${module.name}::${func.name}", }
      const res = await client.view(data, version?.toString())
      const coder = defaultMoveCoder(client.nodeUrl)
      const type = await coder.getMoveFunction("${module.address}::${module.name}::${func.name}")
      return await coder.decodeArray(res, type.return) as any
    }`
  }
}
