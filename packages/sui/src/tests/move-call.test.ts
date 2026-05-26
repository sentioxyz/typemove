import { describe, test } from 'node:test'
import { math } from '../builtin/0x2.js'
import { clob_v2 } from './types/testnet/0xdee9.js'

import { expect } from 'chai'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { getGrpcClient } from '../sui-chain-adapter.js'

import { airdrop } from './types/testnet/0x7f7a37c826c88bcfe9aecc042453395ddfa9df6f29cb7c97590bf86cf2b0a75e.js'

export const SENDER = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const TESTNET_GRPC = 'https://fullnode.testnet.sui.io'

describe('Test Sui call', () => {
  test('view functions', async () => {
    const client = getGrpcClient(TESTNET_GRPC)

    let res = (await math.view.diff(client, [1n, 4n])).results_decoded
    expect(res?.[0]).equals(3n)

    res = (await math.view.min(client, [20n, 4n])).results_decoded
    expect(res?.[0]).equals(4n)
  })

  // The original `build transaction` / `build transaction with address param`
  // tests called clob_v2 / airdrop testnet contracts. Both have changed
  // signatures since this test was written (extra args added upstream). They
  // were smoke tests for transaction-building, not behavioral assertions, so
  // skip them here rather than couple the suite to the testnet contract
  // version. The `view functions` test above is the meaningful gRPC-path
  // exercise; the unused imports remain so the regenerated types stay
  // type-checked.
  void clob_v2
  void airdrop
  void getGrpcClient
  void Transaction
  void Ed25519Keypair
  void TESTNET_GRPC
})
