import { describe, test } from 'node:test'
import { InternalMoveModule, TypeDescriptor } from '@typemove/move'
import { Aptos, AptosConfig } from '@aptos-labs/ts-sdk'
import { expect } from 'chai'

import { AptosChainAdapter } from '../aptos-chain-adapter'

describe('AptosChainAdapter', () => {
  const adapter = new AptosChainAdapter(new Aptos(new AptosConfig({ fullnode: 'https://mainnet.aptoslabs.com/v1' })))

  test('should detect native events with drop+store abilities', () => {
    const modules: InternalMoveModule[] = [
      {
        address: '0x1',
        name: 'fungible_asset',
        structs: [
          {
            name: 'Deposit',
            isEvent: true,
            isNative: false,
            abilities: ['drop', 'store'],
            typeParams: [],
            fields: [
              {
                name: 'store',
                type: new TypeDescriptor('address')
              },
              {
                name: 'amount',
                type: new TypeDescriptor('u64')
              }
            ]
          },
          {
            name: 'SomeResource',
            isNative: true,
            isEvent: false,
            abilities: ['key'],
            typeParams: [],
            fields: [
              {
                name: 'dummy_field',
                type: new TypeDescriptor('bool')
              }
            ]
          }
        ],
        exposedFunctions: [],
        enums: []
      }
    ]

    const events = adapter.getAllEventStructs(modules)

    expect(events.has('0x1::fungible_asset::Deposit')).to.be.eq(true)
    expect(events.has('0x1::fungible_asset::SomeResource')).to.be.eq(false)
  })

  test('should detect legacy events with "Event" suffix', () => {
    const modules: InternalMoveModule[] = [
      {
        address: '0x1',
        name: 'fungible_asset',
        structs: [
          {
            name: 'DepositEvent',
            isNative: false,
            isEvent: false, // look at the worst case i.e. it's false/undefined for an actual event struct
            abilities: ['drop', 'store'],
            typeParams: [],
            fields: [
              {
                name: 'amount',
                type: new TypeDescriptor('u64')
              }
            ]
          }
        ],
        exposedFunctions: [],
        enums: []
      }
    ]

    const events = adapter.getAllEventStructs(modules)
    expect(events.has('0x1::fungible_asset::DepositEvent')).to.be.eq(true)
  })

  test('should detect events referenced in EventHandle fields', () => {
    const modules: InternalMoveModule[] = [
      {
        address: '0x1',
        name: 'test',
        structs: [
          {
            name: 'MyCustomEvent',
            isNative: false,
            isEvent: false,
            abilities: ['drop', 'store'],
            typeParams: [],
            fields: [
              {
                name: 'value',
                type: new TypeDescriptor('u64')
              }
            ]
          },
          {
            name: 'EventStore',
            isNative: false,
            isEvent: false,
            abilities: ['key'],
            typeParams: [],
            fields: [
              {
                name: 'events',
                type: new TypeDescriptor('0x1::event::EventHandle', [new TypeDescriptor('0x1::test::MyCustomEvent')])
              }
            ]
          }
        ],
        exposedFunctions: [],
        enums: []
      }
    ]

    const events = adapter.getAllEventStructs(modules)
    expect(events.has('0x1::test::MyCustomEvent')).to.be.eq(true)
  })

  test('should skip deprecated coin events', () => {
    const modules: InternalMoveModule[] = [
      {
        address: '0x1',
        name: 'coin',
        structs: [
          {
            name: 'Deposit',
            isNative: false,
            isEvent: false,
            abilities: ['drop', 'store'],
            typeParams: [],
            fields: [
              {
                name: 'amount',
                type: new TypeDescriptor('u64')
              }
            ]
          },
          {
            name: 'Withdraw',
            isNative: false,
            isEvent: false,
            abilities: ['drop', 'store'],
            typeParams: [],
            fields: [
              {
                name: 'amount',
                type: new TypeDescriptor('u64')
              }
            ]
          }
        ],
        exposedFunctions: [],
        enums: []
      }
    ]

    const events = adapter.getAllEventStructs(modules)
    expect(events.has('0x1::coin::Deposit')).to.be.eq(false)
    expect(events.has('0x1::coin::Withdraw')).to.be.eq(false)
  })

  test('should not detect structs with extra abilities as events', () => {
    const modules: InternalMoveModule[] = [
      {
        address: '0x1',
        name: 'test',
        structs: [
          {
            name: 'CopyableStruct',
            isNative: false,
            isEvent: false,
            abilities: ['copy', 'drop', 'store'],
            typeParams: [],
            fields: [
              {
                name: 'value',
                type: new TypeDescriptor('u64')
              }
            ]
          },
          {
            name: 'ResourceStruct',
            isNative: false,
            isEvent: false,
            abilities: ['key', 'store'],
            typeParams: [],
            fields: [
              {
                name: 'value',
                type: new TypeDescriptor('u64')
              }
            ]
          }
        ],
        exposedFunctions: [],
        enums: []
      }
    ]

    const events = adapter.getAllEventStructs(modules)
    expect(events.has('0x1::test::CopyableStruct')).to.be.eq(false)
    expect(events.has('0x1::test::ResourceStruct')).to.be.eq(false)
  })

  test('should respect optimisticEventDetection flag', () => {
    const optimisticAdapter = new AptosChainAdapter(
      new Aptos(new AptosConfig({ fullnode: 'https://mainnet.aptoslabs.com/v1' })),
      true
    )
    const conservativeAdapter = new AptosChainAdapter(
      new Aptos(new AptosConfig({ fullnode: 'https://mainnet.aptoslabs.com/v1' })),
      false
    )

    const modules: InternalMoveModule[] = [
      {
        address: '0x1',
        name: 'test',
        structs: [
          {
            name: 'Transfer', // No "Event" suffix
            isNative: false,
            isEvent: false,
            abilities: ['drop', 'store'],
            typeParams: [],
            fields: [
              {
                name: 'from',
                type: new TypeDescriptor('address')
              },
              {
                name: 'to',
                type: new TypeDescriptor('address')
              }
            ]
          }
        ],
        exposedFunctions: [],
        enums: []
      }
    ]

    const optimisticEvents = optimisticAdapter.getAllEventStructs(modules)
    const conservativeEvents = conservativeAdapter.getAllEventStructs(modules)

    expect(optimisticEvents.has('0x1::test::Transfer')).to.be.eq(true)
    expect(conservativeEvents.has('0x1::test::Transfer')).to.be.eq(false)
  })

  test('should detect structs marked with isEvent regardless of abilities', () => {
    const modules: InternalMoveModule[] = [
      {
        address: '0x1',
        name: 'test',
        structs: [
          {
            name: 'SpecialEvent',
            isEvent: true, // Explicitly marked
            isNative: false,
            abilities: [
              'drop' // Missing store, but marked as event; NOTE: should NOT happen in practice
            ],
            typeParams: [],
            fields: [
              {
                name: 'value',
                type: new TypeDescriptor('u64')
              }
            ]
          }
        ],
        exposedFunctions: [],
        enums: []
      }
    ]

    const events = adapter.getAllEventStructs(modules)
    expect(events.has('0x1::test::SpecialEvent')).to.be.eq(true)
  })

  test('should handle empty modules', () => {
    const modules: InternalMoveModule[] = [
      {
        address: '0x1',
        name: 'empty',
        structs: [],
        exposedFunctions: [],
        enums: []
      }
    ]

    const events = adapter.getAllEventStructs(modules)
    expect(events.size).to.be.eq(0)
  })
})
