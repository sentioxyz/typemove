import * as fs from 'fs'
import { Event, MoveModuleBytecode, MoveResource } from '../move-types.js'
import chalk from 'chalk'
import { join } from 'path'
import { AptosChainAdapter } from '../aptos-chain-adapter.js'
import { AbstractCodegen } from '@typemove/move'

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

class AptosCodegen extends AbstractCodegen<
  MoveModuleBytecode,
  Event | MoveResource
> {
  ADDRESS_TYPE = 'Address'
  REFERENCE_TYPE = 'Address'
  PREFIX = 'Aptos'
  SYSTEM_PACKAGE = '@typemove/aptos'

  constructor(endpoint: string) {
    super(new AptosChainAdapter(endpoint))
  }

  // generateImports(): string {
  //   return `
  //     ${super.generateImports()}
  //     import { Address } from '@typemove/aptos'
  //   `
  // }
}
