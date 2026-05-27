import assert from 'assert'
import { describe, test } from 'node:test'
import { stable_pool } from './types/0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af.js'
import { defaultMoveCoder } from '@typemove/aptos'
import { MoveResource, MoveStructId, WriteSetChangeWriteResource } from '@aptos-labs/ts-sdk'
import { decodeResourceChange } from '../coder-helpers.js'
import { NestedDecodedStruct } from '@typemove/move'

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

  test('decode resource change', async () => {
    const decodedResources = await decodeResourceChange([resourceChange], coder)
    const decodedResource = decodedResources[0] as NestedDecodedStruct<MoveResource, WriteSetChangeWriteResource, any>
    assert.equal(decodedResource.data.data_decoded.collateral_info.asset_mantissa, 1000000n)
    // console.log(decodedResource)
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

const resourceChange = {
  resource: '',
  data: {
    data: {
      supply_cap: '1000000',
      collateral_factor_bps: '2000',
      initial_liquidity: '1000000',
      interest_rate_last_update_seconds: '1727934742',
      total_supply_shares: '1000000',
      liability_info: { asset_mantissa: '100000000', asset_name: 'Aptos Coin', asset_type: '300' },
      interest_rate_model_type: '100',
      total_borrow_shares: '0',
      interest_rate_index: { v: '18446744073709551616' },
      paused: false,
      collateral_info: { asset_mantissa: '1000000', asset_name: 'Gui Inu', asset_type: '300' },
      total_collateral_amount: '0',
      collateral_dust_amount: '10000000000',
      total_borrow_amount: '0',
      liquidation_incentive_bps: '10700',
      extend_ref: { self: '0xfa9968279d29207392b48a4fda486de3f42f80fccb16fcc63a35f6214b3011e9' },
      total_supply_amount: '1000000',
      borrow_cap: '0'
    },
    handle: '',
    key: '',
    value: '',
    bytecode: '',
    abi: null,
    type: '0x24c90c44edf46aa02c3e370725b918a59c52b5aa551388feb258bd5a1e82271::isolated_lending::Pair'
  },
  type: 'write_resource',
  state_key_hash: '0x964ccf819ed0a70ddbd16edfa76d639220a3f924a1ac2f41647c226a704ef843',
  address: '0xfa9968279d29207392b48a4fda486de3f42f80fccb16fcc63a35f6214b3011e9',
  module: ''
}
