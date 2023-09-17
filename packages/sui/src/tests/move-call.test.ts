import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client'
import { math } from '../builtin/0x2'
import { clob_v2 } from './types/testnet/0xdee9.js'

import { expect } from 'chai'
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519'
import { TransactionBlock } from '@mysten/sui.js/transactions'

export const SENDER = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

describe('Test Sui call', () => {
  test('view functions', async () => {
    const client = new SuiClient({ url: getFullnodeUrl('testnet') })

    let res = (await math.view.diff(client, [1n, 4n])).results_decoded
    expect(res?.[0]).equals(3n)

    res = (await math.view.min(client, [20n, 4n])).results_decoded
    expect(res?.[0]).equals(4n)
  })

  test('build transaction', async () => {
    const keypair = new Ed25519Keypair()
    const client = new SuiClient({ url: getFullnodeUrl('testnet') })
    const tx = new TransactionBlock()
    clob_v2.builder.createAccount(tx, ['0xd9e6dc1e7f0790c18acf96b629f0a236d56de2f96537d921197bcb0e071b12bd'])

    // client.signAndExecuteTransactionBlock({transactionBlock: tx, signer: keypair})

    console.log(JSON.stringify(tx.blockData, null, 2))
  })
})
