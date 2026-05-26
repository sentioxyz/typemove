import { describe, test } from 'node:test'
import { coin, dynamic_field } from '../builtin/0x2.js'
import { defaultMoveCoder } from '../move-coder.js'
import { expect } from 'chai'
import { TypedSuiMoveObject } from '../models.js'
import { ANY_TYPE, BUILTIN_TYPES, parseMoveType } from '@typemove/move'
import { single_collateral } from './types/testnet/0xebaa2ad3eacc230f309cd933958cc52684df0a41ae7ac214d186b80f830867d2.js'
import { ascii } from '../builtin/0x1.js'
import { de_token } from './types/testnet/enum.js'

describe('Test Sui coder', () => {
  const coder = defaultMoveCoder()
  // loadAllTypes(coder)

  test('decode string', async () => {
    const res = await coder.decodeType('mystring', ascii.String.type())
    expect(res).equals('mystring')
  })

  test('decode object', async () => {
    // gRPC unified shape: nested struct values are flat — no { type, fields } envelopes.
    const data = {
      create_ts_ms: '1680756795894',
      creator: '0xb6c7e3b1c61ee81516a8317f221daa035f1503e0ac3ae7a50b61834bc7a3ead9',
      delivery_info: {
        premium: '0',
        price: '603716059',
        round: '11',
        size: '0',
        ts_ms: '1681635628133'
      },
      index: '11',
      round: '11'
    }
    const res = await coder.decodeType(data, single_collateral.Info.type())
    expect(res?.delivery_info?.price).equals(603716059n)
  })

  test('decode object2', async () => {
    const bidVaultType =
      '0xebaa2ad3eacc230f309cd933958cc52684df0a41ae7ac214d186b80f830867d2::vault::BidVault<0xebaa2ad3eacc230f309cd933958cc52684df0a41ae7ac214d186b80f830867d2::single_collateral::ManagerCap, 0xd175cff04f1d49574efb6f138bc3b9b7313915a57b5ca04141fb1cb4f66984b2::usdc::USDC>'
    // gRPC unified shape: nested struct values are flat objects, no envelopes.
    const subVault = (tag: string) => ({
      balance: '0',
      index: '11',
      share_supply: '0',
      tag,
      user_shares: {
        first: null,
        id: '0xbc2092c8ddddfc1e1bd850879b8e16e4c504fd060d0d2e7e9a5a83117b59a953',
        last: null,
        length: '0'
      }
    })
    const data = {
      bidder_sub_vault: subVault('4'),
      performance_fee_sub_vault: subVault('6'),
      premium_sub_vault: subVault('5')
    }
    const res = await coder.decodeType(data, parseMoveType(bidVaultType))
    expect(res.performance_fee_sub_vault.balance).equals(0n)
  })

  test('decode enum', async () => {
    const data = {
      action: {
        variant: 'LOCK',
        fields: {}
      },
      current_bal: '2000000000000000',
      current_duration: '30914396059',
      current_end: '1767614400000',
      current_raw_voting_weight: '1965964340341353',
      current_voting_weight: '1965964340341353',
      escrow_id: '0x376cbdd42d3075519ec3523e1a78bbca1f07a3011f96ea10ebd60e9f65c1075e',
      prev_bal: '0',
      prev_duration: '0',
      prev_end: '0',
      prev_raw_voting_weight: '0',
      timestamp: '1736700003941'
    }

    const res = await coder.decodeType(data, de_token.DeTokenUpdateEvent.type())
    expect(res?.action.variant).equals('LOCK')
  })

  test('decode dynamic fields', async () => {
    const objects = data
    const res = (await coder.filterAndDecodeObjects(
      parseMoveType('0x2::dynamic_field::Field<address, bool>'),
      objects as any
    )) as any
    expect(res.length).eq(objects.length)
    const fieldType = dynamic_field.Field.type(BUILTIN_TYPES.ADDRESS_TYPE, BUILTIN_TYPES.BOOL_TYPE)
    const res2 = (await coder.filterAndDecodeObjects(fieldType, objects as any)).map((e) => e.data_decoded)
    expect(res2.length).eq(objects.length)

    const objectWithAny = await coder.decodeType(objects[0], dynamic_field.Field.type(ANY_TYPE, ANY_TYPE))
    expect(objectWithAny?.value).eq(true)

    // console.log(decodedObjects)
  })

  test('decode dynamic fields 2', async () => {
    const objects = data2
    const res: TypedSuiMoveObject<dynamic_field.Field<any, any>>[] = await coder.filterAndDecodeObjects(
      dynamic_field.Field.type(),
      objects as any
    )
    expect(res.length).eq(objects.length)

    const decodedObjects = await coder.getDynamicFields(
      objects as any,
      BUILTIN_TYPES.U64_TYPE,
      single_collateral.PortfolioVault.type()
    )
    expect(res.length).eq(1)
    // console.log(decodedObjects)
  })

  test('decode dynamic fields 3', async () => {
    const objects = data3.objects
    const coder = defaultMoveCoder()

    const res: TypedSuiMoveObject<dynamic_field.Field<any, any>>[] = await coder.filterAndDecodeObjects(
      dynamic_field.Field.type(),
      objects as any
    )
    expect(res.length).eq(objects.length)

    // const decodedObjects = await coder.getDynamicFields(
    //     objects,
    //     BUILTIN_TYPES.U8_TYPE,
    //     single_collateral.PortfolioVault.type()
    // )
    // expect(res.length).eq(5)
    console.log(objects)
  })

  test('decode array', async () => {
    const res = await coder.decodeArray(
      [
        '0x7778e8c334013aacc9308eeea1f3cb377cc483a46a0dd2d09293996724c64d4a',
        '0xf9a081de27ab4ef435c619e032082e279830726453cbec62cfb84477b350aaf6',
        undefined
      ],
      [
        parseMoveType('&0xf0bae856227dd70c836a9efa09d18807b56e16434a7bd3e0bd1c85ecbd9ed1af::pause::Pause'),
        parseMoveType('&0xf0bae856227dd70c836a9efa09d18807b56e16434a7bd3e0bd1c85ecbd9ed1af::maven::Maven'),
        coin.Coin.type()
      ]
    )
    expect(res.length).equals(3)
  })

  test('check account norm', async () => {
    const f1 = await coder.getMoveStruct('0x2::bcs::BCS')
    const f2 = await coder.getMoveStruct('0x002::bcs::BCS')
    const f3 = await coder.getMoveStruct('0x1::option::Option')

    expect(f1).equals(f2)
    expect(f1).not.equals(f3)
  })
})

const data = [
  {
    type: '0x2::dynamic_field::Field<address, bool>',
    json: {
      id: '0x0002645c0afc5c5c298bea19f3a6a4dc72f763e0fe022e61cd5fed80bfcffccf',
      name: '0x489b404f8b41dd2b182ef591c7b1558ac3414e1b70b875d802ede77af4f6e602',
      value: true
    },
    objectId: '0x0002645c0afc5c5c298bea19f3a6a4dc72f763e0fe022e61cd5fed80bfcffccf',
    version: '261183',
    digest: '4pY5doijhofhKKy6dAp5Zuvh3Drig7i6FPn28UDMqo2z',
    owner: {
      $kind: 'ObjectOwner',
      ObjectOwner: '0xa14f85860d6ce99154ecbb13570ba5fba1d8dc16b290de13f036b016fd19a29c'
    }
  },
  {
    type: '0x2::dynamic_field::Field<address, bool>',
    json: {
      id: '0x0002cd71bdbcd593ac8558cb9ae5ddd7df08861671ce8a50656a5380ce200094',
      name: '0x641a3ae10ac6df38503ddf28f41ef7ed2cf90c8a9ec3db156de4f7b36f9876eb',
      value: true
    },
    objectId: '0x0002cd71bdbcd593ac8558cb9ae5ddd7df08861671ce8a50656a5380ce200094',
    version: '284842',
    digest: '3eEgWLdREioWdyhArwq8sRQmYhheQyUJZWzGMiurk59T',
    owner: {
      $kind: 'ObjectOwner',
      ObjectOwner: '0xa14f85860d6ce99154ecbb13570ba5fba1d8dc16b290de13f036b016fd19a29c'
    }
  },
  {
    type: '0x2::dynamic_field::Field<address, bool>',
    json: {
      id: '0x001030edc1453fd6a81af482c881d328890c0544b5756c989f17f326595161dc',
      name: '0x1ca3775163688720ba837ea455a05c70b9e15d4c8f3aaa512c8211fb029f1bde',
      value: true
    },
    objectId: '0x001030edc1453fd6a81af482c881d328890c0544b5756c989f17f326595161dc',
    version: '293745',
    digest: 'J5sByqHXemu6y8dPjLmW1Uu26T2Ty17UsM6zhRxhDUY8',
    owner: {
      $kind: 'ObjectOwner',
      ObjectOwner: '0xa14f85860d6ce99154ecbb13570ba5fba1d8dc16b290de13f036b016fd19a29c'
    }
  }
]

const data2 = [
  {
    type: '0x2::dynamic_field::Field<u64, 0xebaa2ad3eacc230f309cd933958cc52684df0a41ae7ac214d186b80f830867d2::single_collateral::PortfolioVault<0xd175cff04f1d49574efb6f138bc3b9b7313915a57b5ca04141fb1cb4f66984b2::usdc::USDC, 0xd175cff04f1d49574efb6f138bc3b9b7313915a57b5ca04141fb1cb4f66984b2::usdc::USDC, 0xd175cff04f1d49574efb6f138bc3b9b7313915a57b5ca04141fb1cb4f66984b2::sui::SUI>>',
    json: {
      id: '0x0b96ca4b33fef52a7a8e7575e5caeb6bb482a480c9c089d763c6664cd802ddea',
      name: '11',
      value: {
        auction: null,
        authority: {
          whitelist: {
            head: '0xb6c7e3b1c61ee81516a8317f221daa035f1503e0ac3ae7a50b61834bc7a3ead9',
            id: '0x40decd3eb4eedc3c5065f14e7b865e143a0736a5614f8062476aade3a2b931a3',
            size: '1',
            tail: '0xb6c7e3b1c61ee81516a8317f221daa035f1503e0ac3ae7a50b61834bc7a3ead9'
          }
        },
        bid_vault: {
          bidder_sub_vault: {
            balance: '0',
            index: '11',
            share_supply: '0',
            tag: '4',
            user_shares: {
              first: null,
              id: '0xbc2092c8ddddfc1e1bd850879b8e16e4c504fd060d0d2e7e9a5a83117b59a953',
              last: null,
              length: '0'
            }
          },
          performance_fee_sub_vault: {
            balance: '0',
            index: '11',
            share_supply: '0',
            tag: '6',
            user_shares: {
              first: null,
              id: '0xbc2092c8ddddfc1e1bd850879b8e16e4c504fd060d0d2e7e9a5a83117b59a953',
              last: null,
              length: '0'
            }
          },
          premium_sub_vault: {
            balance: '0',
            index: '11',
            share_supply: '0',
            tag: '5',
            user_shares: {
              first: null,
              id: '0xbc2092c8ddddfc1e1bd850879b8e16e4c504fd060d0d2e7e9a5a83117b59a953',
              last: null,
              length: '0'
            }
          }
        },
        config: {
          activation_ts_ms: '1681632000000',
          active_vault_config: {
            auction_duration_in_ms: '3600000',
            decay_speed: '1',
            final_price: '388759141',
            initial_price: '603716059',
            payoff_configs: [
              {
                is_buyer: false,
                strike: '1380000000',
                strike_pct: '10983',
                weight: '1'
              },
              {
                is_buyer: true,
                strike: '1260000000',
                strike_pct: '10000',
                weight: '2'
              },
              {
                is_buyer: false,
                strike: '1140000000',
                strike_pct: '9016',
                weight: '1'
              }
            ],
            strike_increment: '10000000'
          },
          b_token_decimal: '9',
          capacity: '100000000000000',
          d_token_decimal: '9',
          expiration_ts_ms: '1681718400000',
          has_next: true,
          leverage: '100',
          lot_size: '100000',
          o_token_decimal: '9',
          option_type: '5',
          period: '0',
          upcoming_vault_config: {
            auction_duration_in_ms: '3600000',
            decay_speed: '1',
            final_price: '388759141',
            initial_price: '603716059',
            payoff_configs: [
              {
                is_buyer: false,
                strike: null,
                strike_pct: '10983',
                weight: '1'
              },
              {
                is_buyer: true,
                strike: null,
                strike_pct: '10000',
                weight: '2'
              },
              {
                is_buyer: false,
                strike: null,
                strike_pct: '9016',
                weight: '1'
              }
            ],
            strike_increment: '10000000'
          },
          warmup_vault_config: {
            auction_duration_in_ms: '3600000',
            decay_speed: '1',
            final_price: '388759141',
            initial_price: '603716059',
            payoff_configs: [
              {
                is_buyer: false,
                strike: null,
                strike_pct: '10983',
                weight: '1'
              },
              {
                is_buyer: true,
                strike: null,
                strike_pct: '10000',
                weight: '2'
              },
              {
                is_buyer: false,
                strike: null,
                strike_pct: '9016',
                weight: '1'
              }
            ],
            strike_increment: '10000000'
          }
        },
        deposit_vault: {
          active_sub_vault: {
            balance: '0',
            index: '11',
            share_supply: '0',
            tag: '0',
            user_shares: {
              first: null,
              id: '0xbc2092c8ddddfc1e1bd850879b8e16e4c504fd060d0d2e7e9a5a83117b59a953',
              last: null,
              length: '0'
            }
          },
          deactivating_sub_vault: {
            balance: '0',
            index: '11',
            share_supply: '0',
            tag: '1',
            user_shares: {
              first: null,
              id: '0xbc2092c8ddddfc1e1bd850879b8e16e4c504fd060d0d2e7e9a5a83117b59a953',
              last: null,
              length: '0'
            }
          },
          has_next: true,
          inactive_sub_vault: {
            balance: '0',
            index: '11',
            share_supply: '0',
            tag: '2',
            user_shares: {
              first: null,
              id: '0xbc2092c8ddddfc1e1bd850879b8e16e4c504fd060d0d2e7e9a5a83117b59a953',
              last: null,
              length: '0'
            }
          },
          warmup_sub_vault: {
            balance: '0',
            index: '11',
            share_supply: '0',
            tag: '3',
            user_shares: {
              first: null,
              id: '0xbc2092c8ddddfc1e1bd850879b8e16e4c504fd060d0d2e7e9a5a83117b59a953',
              last: null,
              length: '0'
            }
          }
        },
        info: {
          create_ts_ms: '1680756795894',
          creator: '0xb6c7e3b1c61ee81516a8317f221daa035f1503e0ac3ae7a50b61834bc7a3ead9',
          delivery_info: {
            premium: '0',
            price: '603716059',
            round: '11',
            size: '0',
            ts_ms: '1681635628133'
          },
          index: '11',
          round: '11'
        }
      }
    },
    objectId: '0x0b96ca4b33fef52a7a8e7575e5caeb6bb482a480c9c089d763c6664cd802ddea',
    version: '6201683',
    digest: 'HHvMjfPCYq3DyxEoiAw6HgiLLAqz2vGY1HdkdTvPJrnR',
    owner: {
      $kind: 'ObjectOwner',
      ObjectOwner: '0xdcb1f0c4d31528a67f89303e3a99e15b9e21c7e22b4123a0e43e90b3fae5ea1e'
    }
  }
]

const data3 = {
  objects: [
    {
      type: '0x2::dynamic_field::Field<u8, 0xccdf4385016f20c784e68376359ddc2f6a9e050ec431ca5c85f1bc81024d4427::oracle::Price>',
      json: {
        name: 1,
        value: {
          timestamp: '1687233731874',
          value: '1000000',
          decimal: 6
        },
        id: '0x568cd069dc536eeb49374c2628ceee60d94b4d515799f46017bedbb7683b1ed4'
      }
    },
    {
      type: '0x2::dynamic_field::Field<u8, 0xccdf4385016f20c784e68376359ddc2f6a9e050ec431ca5c85f1bc81024d4427::oracle::Price>',
      json: {
        name: 0,
        value: {
          decimal: 9,
          timestamp: '1687233658805',
          value: '1200000000'
        },
        id: '0x79468ede1c9a8a2e6815b89c48df407e7291e668cb625f68c11ff13febce3baf'
      }
    },
    {
      type: '0x2::dynamic_field::Field<u8, 0xccdf4385016f20c784e68376359ddc2f6a9e050ec431ca5c85f1bc81024d4427::oracle::Price>',
      json: {
        value: {
          decimal: 9,
          timestamp: '1687233770630',
          value: '1600000000000'
        },
        id: '0xf2ee4a57108529829087a2dcc464c4b826bb300c4bb481014493a98bd015f2a0',
        name: 3
      }
    },
    {
      type: '0x2::dynamic_field::Field<u8, 0xccdf4385016f20c784e68376359ddc2f6a9e050ec431ca5c85f1bc81024d4427::oracle::Price>',
      json: {
        id: '0xf4c06eb58d2b70b97c4f4e621b0a3269b2f79d12fc52a43670dea4c05b3b7b8a',
        name: 2,
        value: {
          decimal: 6,
          timestamp: '1687233752800',
          value: '990000'
        }
      }
    },
    {
      type: '0x2::dynamic_field::Field<u8, 0xccdf4385016f20c784e68376359ddc2f6a9e050ec431ca5c85f1bc81024d4427::oracle::Price>',
      json: {
        id: '0xf79c96dc3197aa2dd676465305bababf76a79950af405580dbb6b0d9ae6e2809',
        name: 4,
        value: {
          decimal: 9,
          timestamp: '1687233789583',
          value: '21000000000000'
        }
      }
    }
  ],
  timestamp: '2023-06-20T07:59:59.478Z',
  slot: '5595091'
}
