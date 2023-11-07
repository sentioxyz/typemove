#!/usr/bin/env node

import { codegen } from './codegen.js'

if (process.argv.length > 3) {
  const abisDir = process.argv[2]
  const targetDir = process.argv[3]
  let endpoint: string | undefined = process.argv[4]
  if (!endpoint || endpoint == 'mainnet') {
    endpoint = 'https://fullnode.mainnet.sui.io/'
  }
  if (endpoint == 'testnet') {
    endpoint = 'https://fullnode.testnet.sui.io/'
  }

  await codegen(abisDir, targetDir, endpoint, false, true)
} else {
  console.error('Not enough argument')
  process.exit(1)
}
