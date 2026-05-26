import { describe, test } from 'node:test'
import { math } from '../builtin/0x2.js'
import { clob_v2 } from './types/testnet/0xdee9.js'

import { expect } from 'chai'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { getGrpcClient } from '../sui-chain-adapter.js'

import { airdrop } from './types/testnet/0x7f7a37c826c88bcfe9aecc042453395ddfa9df6f29cb7c97590bf86cf2b0a75e.js'

export const SENDER = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const TESTNET_GRPC = 'https://fullnode.testnet.sui.io'

describe('Test Sui call', () => {
  test('view functions', async () => {
    const client = getGrpcClient(TESTNET_GRPC)

    let res = (await math.view.diff(client, [1n, 4n])).results_decoded
    expect(res?.[0]).equals(3n)

    res = (await math.view.min(client, [20n, 4n])).results_decoded
    expect(res?.[0]).equals(4n)
  })

  test('build transaction', async () => {
    const _keypair = new Ed25519Keypair()
    const tx = new Transaction()
    const [_coin] = tx.splitCoins(tx.gas, [100])
    clob_v2.builder.createAccount(tx, [])
    clob_v2.builder.createPool(tx, [1n, 1n, '0x1::coin::USD'], ['coin1', 'coin2'])

    const res = await clob_v2.builder.createPool(tx, [1n, 1n, '0x1::coin::USD'], ['coin1', 'coin2'])
    console.log(JSON.stringify(res))
  })

  test('build transaction with address param', async () => {
    const client = getGrpcClient(TESTNET_GRPC)

    const res = await airdrop.view.authorizeApi(client, [
      '0x080c14c97f457e8d40036109e647376beef62d3de35b51a3b9d183295fc8dc1c',
      '0x53a38614e77a540d037c3edea864d0fc5bbe8f5049230b6e1ce173f76596357f',
      SENDER
    ])

    console.log(JSON.stringify(res, null, 2))

    const tx = new Transaction()

    airdrop.builder.authorizeApi(tx, [
      tx.object('0x080c14c97f457e8d40036109e647376beef62d3de35b51a3b9d183295fc8dc1c'),
      tx.object('0x53a38614e77a540d037c3edea864d0fc5bbe8f5049230b6e1ce173f76596357f'),
      tx.pure.address(SENDER)
    ])

    const res2 = await client.simulateTransaction({
      transaction: tx,
      sender: SENDER,
      include: { commandResults: true },
      checksEnabled: false
    } as any)

    console.log(JSON.stringify(res2, null, 2))
  })
})
