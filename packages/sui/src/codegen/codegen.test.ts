import { describe, test } from 'node:test'
import { expect } from 'chai'
import { InternalMoveFunctionVisibility, InternalMoveModule, InternalMoveStruct, TypeDescriptor } from '@typemove/move'
import { SuiCodegen } from './codegen.js'

const ADDR = '0x000000000000000000000000000000000000000000000000000000000000abcd'

function struct(name: string, isEvent = false): InternalMoveStruct {
  return {
    name,
    isNative: false,
    isEvent,
    abilities: ['drop'],
    typeParams: [],
    fields: [{ name: 'dummy', type: new TypeDescriptor('bool') }]
  }
}

function moduleWith(name: string, structs: InternalMoveStruct[], refStruct: string): InternalMoveModule {
  return {
    address: ADDR,
    name,
    enums: [],
    structs,
    exposedFunctions: [
      {
        name: 'consume',
        visibility: InternalMoveFunctionVisibility.PUBLIC,
        isEntry: true,
        isView: false,
        typeParams: [],
        // a function param referencing a struct in the same module
        params: [new TypeDescriptor(`${ADDR}::${name}::${refStruct}`)],
        return: []
      }
    ]
  }
}

describe('Sui codegen same-module references', () => {
  const gen = new SuiCodegen('https://fullnode.mainnet.sui.io')

  // Regression: a dependency with a module named TOKEN and a struct named TOKEN
  // used to emit `namespace TOKEN { namespace TOKEN { ... } }`, and every
  // same-module reference was qualified as `TOKEN.TOKEN` / `TOKEN.<other>`.
  // Inside `namespace TOKEN` the leading `TOKEN` resolves to the struct (it
  // shadows the enclosing namespace), so those references failed with TS2694.
  test('module sharing a struct name emits unqualified same-module references', () => {
    const tokenStruct = struct('TOKEN', /* isEvent */ true)
    const module = moduleWith('TOKEN', [tokenStruct, struct('Other')], 'TOKEN')
    const events = new Map<string, InternalMoveStruct>([[`${ADDR}::TOKEN::TOKEN`, tokenStruct]])

    const out = gen.generateModule(module, events, ADDR)

    // The shadowed `module.struct` qualifier must not appear: a field/arg typed
    // as the same-named struct, nor any reference to a sibling struct.
    expect(out).to.not.match(/[^:]TOKEN\.TOKEN/) // not the `TOKEN.TOKEN` type ref
    expect(out).to.not.include('TOKEN.Other')
    // ...and the references are emitted unqualified instead.
    expect(out).to.include('dummy: boolean')
    expect(out).to.match(/consume\(tx: Transaction,\s*args: \[TOKEN\b/)
  })

  // Guard: ordinary modules (no name collision) keep the `module.struct`
  // qualifier, which is needed to disambiguate sibling modules in the same file.
  test('ordinary module keeps the module-qualified same-module reference', () => {
    const module = moduleWith('pool', [struct('Coin', /* isEvent */ true), struct('Holder')], 'Coin')
    const events = new Map<string, InternalMoveStruct>([[`${ADDR}::pool::Coin`, struct('Coin', true)]])

    const out = gen.generateModule(module, events, ADDR)

    expect(out).to.include('pool.Coin')
  })
})
