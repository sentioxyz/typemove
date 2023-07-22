import { AptosClient, Types } from 'aptos'
import { _0x1 } from '@typemove/aptos/builtin'

describe('view function', () => {
  test('decode function payload', async () => {
    const client = new AptosClient('https://mainnet.aptoslabs.com/')
    const res1 = await client.view(data)
    console.log(res1)

    const res2 = await _0x1.coin.view.balance(client, {
      type_arguments: [
        '0x84d7aeef42d38a5ffc3ccef853e1b82e4958659d16a7de736a29c55fbbeb0114::staked_aptos_coin::StakedAptosCoin',
      ],
      arguments: ['0x5967ebb35647e8a664ea8d2d96276f28cc88e7bfeff46e625c8900d8b541506a'],
    })
    console.log(res2)
  })
})

const data: Types.ViewRequest = {
  type_arguments: [
    '0x84d7aeef42d38a5ffc3ccef853e1b82e4958659d16a7de736a29c55fbbeb0114::staked_aptos_coin::StakedAptosCoin',
  ],
  arguments: ['0x5967ebb35647e8a664ea8d2d96276f28cc88e7bfeff46e625c8900d8b541506a'],
  function: '0x1::coin::balance',
}
