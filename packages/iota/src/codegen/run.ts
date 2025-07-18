#!/usr/bin/env node

import { codegen } from './codegen.js'
import { Command } from 'commander'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { IotaClient } from '@iota/iota-sdk/client'
const require = createRequire(import.meta.url)
let pkg = undefined
try {
  pkg = require('../../package.json')
} catch (e) {
  pkg = require('../../../package.json')
}

const program = new Command()
program
  .name('typemove-sui')
  .description('CLI to generate typescript types from SUI ABIs')
  .showHelpAfterError()
  .version(pkg.version)
  .argument('<location>', 'Directory of ABI json files or address of account to generate types for')
  .option('-a, --abi-dir <dir>', 'Directory to store downloaded ABI. Only useful if <location> is address', './abis')
  .option('-t, --target-dir <dir>', 'Directory to output generated files', './types')
  .option(
    '-n, --network <mainnet|testnet|$url>',
    'Network to use, could be either "mainnet", "testnet" or any node URL',
    'mainnet'
  )
  .action(async (location, options) => {
    let endpoint = options.network
    if (endpoint == 'mainnet') {
      endpoint = 'https://api.mainnet.iota.cafe/'
    }
    if (endpoint == 'testnet') {
      endpoint = 'https://api.testnet.iota.cafe/'
    }

    const suiClient = new IotaClient({ url: endpoint })

    let abisDir = location
    if (location.startsWith('0x')) {
      const abiAddress = abisDir
      const abi = await suiClient.getNormalizedMoveModulesByPackage({ package: abiAddress })
      abisDir = options.abiDir
      if (!fs.existsSync(abisDir)) {
        fs.mkdirSync(abisDir, { recursive: true })
      }
      fs.writeFileSync(path.join(abisDir, abiAddress + '.json'), JSON.stringify(abi, null, 2))
    }

    const num = await codegen(abisDir, options.targetDir, endpoint, true)
    process.exit(num == 0 ? 1 : 0)
  })

program.parse()
