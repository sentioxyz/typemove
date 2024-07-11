import { describe, test } from 'node:test'
import { defaultMoveCoder } from '../index.js'
import { loadAllTypes } from '../builtin/0x1.js'
import { EntryFunctionPayloadResponse } from '@aptos-labs/ts-sdk'

describe('type decode', () => {
  loadAllTypes(defaultMoveCoder())
  test('decode function payload', async () => {
    const decoded = defaultMoveCoder().decodeFunctionPayload(data)
    console.log(decoded)
  })
})

const data: EntryFunctionPayloadResponse = {
  type: 'entry_function_payload',
  type_arguments: [],
  arguments: ['0xaaaf981fec16d967eb79bb51b4c6d39e75acb3482c6dabddb19ca9adbfceee80'],
  // code: { bytecode: '' },
  function: '0x1::aptos_account::create_account'
}
