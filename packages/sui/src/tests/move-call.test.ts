import { describe, test } from 'node:test'
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
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(100)])
    clob_v2.builder.createAccount(tx, [])
    clob_v2.builder.createPool(tx, [1n, 1n, '0x1::coin::USD'], ['coin1', 'coin2'])

    // client.signAndExecuteTransactionBlock({transactionBlock: tx, signer: keypair})

    console.log(JSON.stringify(tx.blockData, null, 2))
  })
})
