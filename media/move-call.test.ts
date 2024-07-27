import { describe, test } from 'node:test'
import {
  base_pool,
  fees,
  stable_pool
} from './types/0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af'
import { Aptos, AptosConfig } from '@aptos-labs/ts-sdk'
import { _0x1 } from '@typemove/aptos/builtin'
import { expect } from 'chai'

describe('move-call', () => {
  const client = new Aptos(new AptosConfig({ fullnode: 'https://fullnode.mainnet.aptoslabs.com/v1' }))

  test('system-call', async () => {
    const [res] = await _0x1.account.view.existsAt(client, {
      functionArguments: ['0x5967ebb35647e8a664ea8d2d96276f28cc88e7bfeff46e625c8900d8b541506a']
    })
    expect(res).to.equal(true)

    const [chainId] = await _0x1.chain_id.view.get(client)
    expect(chainId).to.equal(1)

    const [decimal] = await _0x1.coin.view.decimals(client, {
      typeArguments: ['0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T']
    })
    expect(decimal).to.equal(6)
  })

  test('custom-call', async () => {
    const [poolId] = await stable_pool.view.nextPoolId(client)
    console.log(poolId)

    const [balance] = await fees.view.balance(client, {
      typeArguments: ['0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T']
    })
    console.log(balance)

    const [decimal] = await base_pool.view.maxSupportedDecimals(client)
    expect(decimal).to.equal(8)

    const [lpName] = await stable_pool.view.lpNameById(client, { functionArguments: [3n] })
    const [poolBalances, weights, supply] = await stable_pool.view.poolInfo(client, {
      functionArguments: [lpName]
    })
    expect(poolBalances.length > 0).equal(true)
    expect(weights > 0n).equal(true)
    expect(supply > 0n).equal(true)
  })
})
