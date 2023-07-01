import {
  Ed25519Keypair,
  JsonRpcProvider,
  RawSigner,
  TransactionBlock,
  SuiAddress,
} from '@mysten/sui.js'
import { single_collateral } from './types/testnet/0xebaa2ad3eacc230f309cd933958cc52684df0a41ae7ac214d186b80f830867d2.js'

describe('Test Sui call', () => {
  // https://github.com/MystenLabs/sui/tree/main/sdk/typescript#move-call
  test('call', async () => {
    // Generate a new Keypair
    const keypair = new Ed25519Keypair()
    const provider = new JsonRpcProvider()
    const signer = new RawSigner(keypair, provider)
    const packageObjectId = '0x3'
    const tx = new TransactionBlock()

    const x: SuiAddress = 'asdf'
    // tx.blockData

    x.split('sdf')
    // tx.makeMoveVec()
    const res = tx.moveCall({
      target: `${packageObjectId}::nft::mint`,
      arguments: [tx.pure('Example NFT')],
    })

    tx.moveCall({
      target: `${packageObjectId}::nft::mint`,
      arguments: [res],
    })

    // const result = await signer.signAndExecuteTransactionBlock({
    //   transactionBlock: tx,
    // })

    single_collateral.builder.addAuthorizedUser(tx, [
      '0x11',
      '0x22',
      [],
      '0x11',
    ])
  })
})
