import { describe, test } from 'node:test'
import { assert } from 'chai'
import { AbstractMoveCoder } from './abstract-move-coder.js'
import { ChainAdapter } from './chain-adapter.js'
import {
  InternalMoveEnum,
  InternalMoveFunction,
  InternalMoveFunctionVisibility,
  InternalMoveModule
} from './internal-models.js'
import { TypeDescriptor } from './types.js'

const COIN_ENUM: InternalMoveEnum = {
  name: 'Status',
  abilities: [],
  typeParams: [],
  variants: {}
}

const COIN_FUNC: InternalMoveFunction = {
  name: 'do_thing',
  visibility: InternalMoveFunctionVisibility.PUBLIC,
  isEntry: false,
  typeParams: [],
  params: [],
  return: []
}

const COIN_MODULE: InternalMoveModule = {
  address: '0x1',
  name: 'coin',
  exposedFunctions: [COIN_FUNC],
  enums: [COIN_ENUM],
  structs: [
    {
      name: 'CoinInfo',
      isNative: false,
      isEvent: false,
      abilities: [],
      typeParams: [],
      fields: []
    }
  ]
}

class FlakyAdapter extends ChainAdapter<any, any> {
  calls = 0
  failNext = true

  async getChainId(): Promise<string> {
    return 'test-chain'
  }

  async fetchModule(account: string, module: string): Promise<any> {
    return COIN_MODULE
  }

  async fetchModules(account: string): Promise<any[]> {
    this.calls++
    if (this.failNext) {
      this.failNext = false
      throw new Error('transient RPC failure')
    }
    return [COIN_MODULE]
  }

  toInternalModules(modules: any[]): InternalMoveModule[] {
    return modules
  }

  getAllEventStructs(modules: InternalMoveModule[]): Map<string, any> {
    return new Map()
  }

  getMeaningfulFunctionParams(params: TypeDescriptor[]): TypeDescriptor[] {
    return params
  }

  getType(base: any): string {
    return ''
  }

  getData<T>(base: any): any {
    return {}
  }
}

class TestCoder extends AbstractMoveCoder<any, any> {
  constructor(adapter: ChainAdapter<any, any>) {
    super(adapter)
  }

  load(module: any, address: string): InternalMoveModule {
    this.loadInternal(module as InternalMoveModule, address)
    return module as InternalMoveModule
  }
}

async function firstError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise
    return undefined
  } catch (e) {
    return e
  }
}

describe('module fetch request cache', () => {
  test('getMoveStruct retries after a transient fetchModules failure', async () => {
    const adapter = new FlakyAdapter()
    const coder = new TestCoder(adapter)

    const error = await firstError(coder.getMoveStruct('0x1::coin::CoinInfo'))
    assert.equal(error?.message, 'transient RPC failure')

    const struct = await coder.getMoveStruct('0x1::coin::CoinInfo')
    assert.equal(struct.name, 'CoinInfo')
    assert.equal(adapter.calls, 2)
  })

  test('maybeGetMoveEnum retries after a transient fetchModules failure', async () => {
    const adapter = new FlakyAdapter()
    const coder = new TestCoder(adapter)

    const error = await firstError(coder.maybeGetMoveEnum('0x1::coin::Status'))
    assert.equal(error?.message, 'transient RPC failure')

    const enumType = await coder.maybeGetMoveEnum('0x1::coin::Status')
    assert.equal(enumType?.name, 'Status')
    assert.equal(adapter.calls, 2)
  })

  test('getMoveFunction surfaces the original fetch error, not a masking error', async () => {
    const adapter = new FlakyAdapter()
    const coder = new TestCoder(adapter)

    const error = await firstError(coder.getMoveFunction('0x1::coin::do_thing'))
    assert.equal(error?.message, 'transient RPC failure')
  })
})
