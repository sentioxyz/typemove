import {
  // TransactionBlock,
  SuiClient,
  getFullnodeUrl
} from '@mysten/sui.js/client'
import { math } from '../builtin/0x2'
import { expect } from 'chai'
// import { BCS, getSuiMoveConfig } from "@mysten/bcs";

export const SENDER = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

describe('Test Sui call', () => {
  test('view functions', async () => {
    const provider = new SuiClient({ url: getFullnodeUrl('testnet') })

    let res = (await math.view.diff(provider, [1n, 4n])).results_decoded
    expect(res?.[0]).equals(3n)

    res = (await math.view.min(provider, [20n, 4n])).results_decoded
    expect(res?.[0]).equals(4n)
  })
})
