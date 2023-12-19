import { _0x1 } from '@typemove/aptos/builtin'
import { expect } from 'chai'
import { jest } from '@jest/globals'
import { Account, Aptos, AptosConfig, Network, ViewRequest } from '@aptos-labs/ts-sdk'

describe('client call of entry or view', () => {
  const client = new Aptos(
    new AptosConfig({
      network: Network.CUSTOM,
      fullnode: 'https://mainnet.aptoslabs.com/'
    })
  )
  jest.setTimeout(100000)

  test('call balance', async () => {
    const data: ViewRequest = {
      typeArguments: [
        '0x84d7aeef42d38a5ffc3ccef853e1b82e4958659d16a7de736a29c55fbbeb0114::staked_aptos_coin::StakedAptosCoin'
      ],
      functionArguments: ['0x5967ebb35647e8a664ea8d2d96276f28cc88e7bfeff46e625c8900d8b541506a'],
      function: '0x1::coin::balance'
    }
    const res1 = await client.view({
      payload: data,
      options: {
        ledgerVersion: 193435152n
      }
    })
    expect(res1).eql(['99680593'])

    const res2 = await _0x1.coin.view.balance(
      client,
      {
        type_arguments: [
          '0x84d7aeef42d38a5ffc3ccef853e1b82e4958659d16a7de736a29c55fbbeb0114::staked_aptos_coin::StakedAptosCoin'
        ],
        arguments: ['0x5967ebb35647e8a664ea8d2d96276f28cc88e7bfeff46e625c8900d8b541506a']
      },
      193435152n
    )
    expect(res2).eql([99680593n])
  })

  test('call get_validator_config', async () => {
    const res = await _0x1.stake.view.getValidatorConfig(client, {
      arguments: ['0xee49776eff9fd395eb90d601449542080645e63704f518b31c6f72b6a95d7868']
    })
    expect(res.length).eql(3)
  })

  test.skip('build transaction', async () => {
    // const account = Account.fromPrivateKeyAndAddress(undefined, '0x5967ebb35647e8a664ea8d2d96276f28cc88e7bfeff46e625c8900d8b541506a')
    const res = await _0x1.coin.entry.transfer(client, account, {
      type_arguments: ['0x1::aptos_coin::AptosCoin'],
      arguments: ['0x1', 1n]
    })
  })
})
