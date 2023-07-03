import {
  Ed25519Keypair,
  JsonRpcProvider,
  RawSigner,
  TransactionBlock,
  // bcs,
  testnetConnection,
} from '@mysten/sui.js'
import { clob_v2 } from './types/testnet/0xdee9'

export const SENDER =
  '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

describe('Test Sui call', () => {
  // const bcs = new BCS(getSuiMoveConfig());

  // https://github.com/MystenLabs/sui/tree/main/sdk/typescript#move-call
  test('movex call', async () => {
    // Generate a new Keypair
    const keypair = new Ed25519Keypair()
    const provider = new JsonRpcProvider(testnetConnection)
    const signer = new RawSigner(keypair, provider)
    const packageObjectId = '0x3'
    const tx = new TransactionBlock()

    clob_v2.builder.getMarketPrice(
      tx,
      ['0x5d2687b354f2ad4bce90c828974346d91ac1787ff170e5d09cb769e5dbcdefae'],
      [
        '0x2::sui::SUI',
        '0x219d80b1be5d586ff3bdbfeaf4d051ec721442c3a6498a3222773c6945a73d9f::usdt::USDT',
      ]
    )

    console.log(tx.blockData)

    const result = await provider.devInspectTransactionBlock({
      transactionBlock: tx,
      sender:
        '0xd9e6dc1e7f0790c18acf96b629f0a236d56de2f96537d921197bcb0e071b12bd',
    })

    // const returnValues = result.results![0]!.returnValues!
    //
    // const deData = bcs.de(
    //   returnValues[0][1],
    //   Uint8Array.from(returnValues[0][0])
    // )
    //
    // console.log(JSON.stringify(result))
    //
    // // https://github.com/josemvcerqueira/marc.ee-gilder/blob/430a391abb3bacb66063a9352c6f8e92f530534e/src/index.ts#L73
    // console.log(JSON.stringify(result.results))

    // console.log(JSON.stringify(result))
    // tx.splitCoins(tx.gas, {
    //   tx.pure(100,00)
    // })
    //
    // router.builder.addLiquidity(tx,
    //     [
    //
    //     ],
    //     [
    //
    //     ]
    // )

    // const res = tx.moveCall({
    //   target: `${packageObjectId}::nft::mint`,
    //   arguments: [tx.pure('Example NFT')],
    // })
    //
    // tx.moveCall({
    //   target: `${packageObjectId}::nft::mint`,
    //   arguments: [res],
    // })

    // const result = await signer.signAndExecuteTransactionBlock({
    //   transactionBlock: tx,
    // })

    // single_collateral.builder.addAuthorizedUser(tx, [
    //   '0x11',
    //   '0x22',
    //   [],
    //   '0x11',
    // ])
  })
})
