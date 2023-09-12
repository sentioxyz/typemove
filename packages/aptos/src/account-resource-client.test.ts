import { AptosClient } from 'aptos'
import { expect } from 'chai'
import { jest } from '@jest/globals'
import { AccountResourceClient } from './account-resource-client.js'
import { amm, vault } from './tests/types/0xbd35135844473187163ca197ca93b2ab014370587bb0ed3befff9e902d6bb541.js'
import { aptos_coin } from './builtin/0x1.js'
import { ANY_TYPE } from '@typemove/move'

describe('account resource client', () => {
  const client = new AptosClient('https://mainnet.aptoslabs.com/')
  const accountResourceClient = new AccountResourceClient(client)
  const ACCOUNT_ADDRESS = '0xbd35135844473187163ca197ca93b2ab014370587bb0ed3befff9e902d6bb541'

  jest.setTimeout(100000)

  test('test all pool', async () => {
    const poolType = amm.Pool.type()
    const allPoolResources = await accountResourceClient.matchAll(ACCOUNT_ADDRESS, poolType)
    expect(allPoolResources.length).to.greaterThan(1)
    for (const r of allPoolResources) {
      expect(r.data_decoded.x_reserve).not.be.undefined
    }

    const poolTypeWithAptos = amm.Pool.type(aptos_coin.AptosCoin.type(), ANY_TYPE)
    const aptosPoolResources = await accountResourceClient.matchAll(ACCOUNT_ADDRESS, poolTypeWithAptos)

    expect(aptosPoolResources.length).to.greaterThan(1)
    expect(allPoolResources.length).to.greaterThan(aptosPoolResources.length)
  })

  test('test single resource', async () => {
    const x = await accountResourceClient.matchExact(ACCOUNT_ADDRESS, vault.Vault.type())
    expect(x).not.be.undefined
  })

  test('test single resource with type', async () => {
    const type = amm.Pool.type(aptos_coin.AptosCoin.type(), aptos_coin.AptosCoin.type())
    const x = await accountResourceClient.matchExact(ACCOUNT_ADDRESS, type)
    expect(x).not.be.undefined
  })

  test('test single resource with wrong pattern', async () => {
    const type = amm.Pool.type(aptos_coin.AptosCoin.type(), ANY_TYPE)
    try {
      const x = await accountResourceClient.matchExact(ACCOUNT_ADDRESS, type)
    } catch (e) {
      expect(e.message).to.be.equal('resource type for match call should not contain any type')
    }
  })
})
