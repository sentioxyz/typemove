// #!/usr/bin/env node

import { codegen } from './codegen.js'
import { AptosClient } from 'aptos'
import * as path from 'path'
import * as fs from 'fs'

if (process.argv.length > 3) {
  let abisDir = process.argv[2]
  const targetDir = process.argv[3]
  let endpoint: string | undefined = process.argv[4]
  if (!endpoint || endpoint == 'mainnet') {
    endpoint = 'https://mainnet.aptoslabs.com/'
  }
  if (endpoint == 'testnet') {
    endpoint = 'https://testnet.aptoslabs.com/'
  }
  const aptosClient = new AptosClient(endpoint)
  if (abisDir.startsWith('0x')) {
    const abiAddress = abisDir
    const abi = await aptosClient.getAccountModules(abiAddress)
    abisDir = path.join(targetDir, '..', 'abis')
    if (!fs.existsSync(abisDir)) {
      fs.mkdirSync(abisDir, { recursive: true })
    }
    fs.writeFileSync(path.join(abisDir, abiAddress + '.json'), JSON.stringify(abi, null, 2))
  }

  await codegen(abisDir, targetDir, endpoint, true)
} else {
  console.error('Not enough argument')
  process.exit(1)
}