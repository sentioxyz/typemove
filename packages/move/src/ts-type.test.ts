import { describe, test } from 'node:test'
import { assert } from 'chai'
import { parseMoveType } from './types.js'

describe('type gen', () => {
  test('type gen for generic', async () => {
    const res = parseMoveType('x<g1<a,g2<c,d>>,b,g3<a,b>,e>')

    assert(res.qname === 'x')
    assert(res.typeArgs[0].typeArgs[1].qname === 'g2')
    assert(res.typeArgs[0].typeArgs[1].typeArgs[1].qname === 'd')
  })

  test('type gen for non generic', async () => {
    const res = parseMoveType('xyz')

    assert(res.qname === 'xyz')
    assert(res.typeArgs.length === 0)
  })

  test('test depended types', async () => {
    const typeString =
      '0x1::table_with_length::TableWithLength<T0, 0xd5f9f2b1c24faee8f07b790e570c75dfa1b7d8c1e9a60162fbd92ade03ea29e4::iterable_table::IterableValue<T0, T1>>'
    const res = parseMoveType(typeString)

    const deps = res.dependedTypes()
    assert(deps.length === 2)
    assert(
      deps[0] === '0xd5f9f2b1c24faee8f07b790e570c75dfa1b7d8c1e9a60162fbd92ade03ea29e4::iterable_table::IterableValue'
    )
    assert(deps[1] === '0x1::table_with_length::TableWithLength')

    const computedTypeString = res.getSignature()
    assert(computedTypeString === typeString)
  })

  test('test depended types array', async () => {
    const typeString = '0x2::table::Table<U64, vector<0x1.ascii.String>>'
    const res = parseMoveType(typeString)

    const deps = res.dependedTypes()
    assert(deps.length === 2)
  })

  // Aptos SDK 7+ ABI exposes Move closure / function-value types as `|args|ret`.
  // parseMoveType used to crash on `|` — these tests guard the closure parser.
  test('parse closure with single param and return', async () => {
    const res = parseMoveType('|T1|T2')

    assert(res.qname === '|fn|')
    assert(res.typeArgs.length === 2)
    assert(res.typeArgs[0].qname === 'T1')
    assert(res.typeArgs[1].qname === 'T2')
  })

  test('parse closure with mutable reference param (big_ordered_map::iter_modify)', async () => {
    const res = parseMoveType('|&mut T1|T2')

    assert(res.qname === '|fn|')
    assert(res.typeArgs.length === 2)
    const [param, ret] = res.typeArgs
    assert(param.qname === 'T1')
    assert(param.reference === true)
    assert(param.mutable === true)
    assert(ret.qname === 'T2')
  })

  test('parse closure with multiple params and qualified types (sigma_protocol_homomorphism::Homomorphism)', async () => {
    const typeString =
      '|&0x1::sigma_protocol_statement::Statement<T0>,&0x1::sigma_protocol_witness::Witness|0x1::sigma_protocol_representation_vec::RepresentationVec'
    const res = parseMoveType(typeString)

    assert(res.qname === '|fn|')
    assert(res.typeArgs.length === 3)
    const [p1, p2, ret] = res.typeArgs
    assert(p1.qname === '0x1::sigma_protocol_statement::Statement')
    assert(p1.reference === true)
    assert(p1.typeArgs.length === 1)
    assert(p1.typeArgs[0].qname === 'T0')
    assert(p2.qname === '0x1::sigma_protocol_witness::Witness')
    assert(p2.reference === true)
    assert(ret.qname === '0x1::sigma_protocol_representation_vec::RepresentationVec')
  })

  test('closure dependedTypes walks params and return, excludes type parameters', async () => {
    const typeString =
      '|&0x1::sigma_protocol_statement::Statement<T0>|0x1::sigma_protocol_representation_vec::RepresentationVec'
    const res = parseMoveType(typeString)
    const deps = res.dependedTypes().sort()

    assert.deepEqual(deps, [
      '0x1::sigma_protocol_representation_vec::RepresentationVec',
      '0x1::sigma_protocol_statement::Statement'
    ])
  })
  // test('type type gen', async () => {
  //
  //   const res = parseGenericType('x<g1<a,g2<c,d>>,b,g3<a,b>,e>')
  //   console.log(res)
  //
  //   assert(res.symbol === 'x')
  //   assert(res.typeParams[0].typeParams[1].symbol === "g2")
  //   assert(res.typeParams[0].typeParams[1].typeParams[1].symbol === "d")
  // })
})
