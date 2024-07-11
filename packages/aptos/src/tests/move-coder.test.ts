import assert from 'assert'
import { describe, test } from 'node:test'
import { stable_pool } from './types/0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af'
import { defaultMoveCoder } from '@typemove/aptos'
import { MoveStructId } from '@aptos-labs/ts-sdk'

describe('move-coder', () => {
  // const aptosClient = new AptosClient("https://fullnode.mainnet.aptoslabs.com")
  const coder = defaultMoveCoder()

  test('decode resource', async () => {
    // const typeDescript = stable_pool.StablePool
    // const resources = await aptosClient.getAccountResources("0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af")
    const pool = await coder.decodeResource<stable_pool.StablePool<any, any, any, any>>(resource)

    assert.equal(pool?.data_decoded.asset_1.value, 2828506n)

    const encoded = coder.encode(pool)
    assert.equal(encoded.data.asset_1.value, '2828506')
  })
})

const resource = {
  type: '0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::stable_pool::StablePool<0x159df6b7689437016108a019fd5bef736bac692b6d4a1f10c941f6fbb9a74ca6::oft::CakeOFT, 0x1::aptos_coin::AptosCoin, 0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null, 0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null>' as MoveStructId,
  data: {
    amp_factor: '10',
    asset_0: {
      value: '64917048'
    },
    asset_1: {
      value: '2828506'
    },
    asset_2: {
      value: '0'
    },
    asset_3: {
      value: '0'
    },
    events: {
      add_liquidity_events: {
        counter: '0',
        guid: {
          id: {
            addr: '0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af',
            creation_num: '370'
          }
        }
      },
      param_change_events: {
        counter: '0',
        guid: {
          id: {
            addr: '0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af',
            creation_num: '373'
          }
        }
      },
      pool_creation_events: {
        counter: '1',
        guid: {
          id: {
            addr: '0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af',
            creation_num: '369'
          }
        }
      },
      remove_liquidity_events: {
        counter: '0',
        guid: {
          id: {
            addr: '0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af',
            creation_num: '371'
          }
        }
      },
      swap_events: {
        counter: '4',
        guid: {
          id: {
            addr: '0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af',
            creation_num: '372'
          }
        }
      }
    },
    inverse_negated_swap_fee_ratio: {
      v: '18465209284871323648'
    },
    pool_token_burn_cap: {
      dummy_field: false
    },
    pool_token_mint_cap: {
      dummy_field: false
    },
    precision_multipliers: ['1', '1'],
    reserved_lp_coin: {
      value: '100'
    },
    swap_fee_ratio: {
      v: '18446744073709551'
    }
  }
}
