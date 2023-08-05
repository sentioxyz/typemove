import { stable_pool } from './types/0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af'
import { AptosClient } from 'aptos'

const client = new AptosClient('https://fullnode.mainnet.aptoslabs.com')

const [lpName] = await stable_pool.view.lpNameById(client, { arguments: [3n] })
console.log(lpName)

const [poolBalances, weights, supply] = await stable_pool.view.poolInfo(client, {
  arguments: [lpName],
})

console.log(poolBalances, weights, supply)
