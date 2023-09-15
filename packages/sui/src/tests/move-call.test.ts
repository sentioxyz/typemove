import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519'
import {
  // TransactionBlock,
  SuiClient,
  getFullnodeUrl
} from '@mysten/sui.js/client'
import { clob_v2 } from './types/testnet/0xdee9.js'
import { TransactionBlock } from '@mysten/sui.js/transactions'
import { BCS } from '@mysten/bcs'
import { InternalMoveStruct, parseMoveType } from '@typemove/move'
import { defaultMoveCoder } from '@typemove/sui'
// import { BCS, getSuiMoveConfig } from "@mysten/bcs";

export const SENDER = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

function registerBCSType(type: InternalMoveStruct, bcs: BCS) {}

describe('Test Sui call', () => {
  // const bcs = new BCS(getSuiMoveConfig());
  // https://github.com/MystenLabs/sui/tree/main/sdk/typescript#move-call
  test('movex call', async () => {
    // Generate a new Keypair
    const keypair = new Ed25519Keypair()
    const provider = new SuiClient({ url: getFullnodeUrl('testnet') })
    const conf = await provider.getProtocolConfig()
    const coder = defaultMoveCoder(getFullnodeUrl('testnet'))
    // const signer = new RawSigner(keypair, provider)
    const packageObjectId = '0x3'
    const tx = new TransactionBlock()

    clob_v2.builder.getMarketPrice(
      tx,
      ['0x5d2687b354f2ad4bce90c828974346d91ac1787ff170e5d09cb769e5dbcdefae'],
      ['0x2::sui::SUI', '0x219d80b1be5d586ff3bdbfeaf4d051ec721442c3a6498a3222773c6945a73d9f::usdt::USDT']
    )

    console.log(tx.blockData)

    const result = await provider.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: '0xd9e6dc1e7f0790c18acf96b629f0a236d56de2f96537d921197bcb0e071b12bd'
    })

    const result2 = await clob_v2.view.getMarketPrice(
      provider,
      ['0x5d2687b354f2ad4bce90c828974346d91ac1787ff170e5d09cb769e5dbcdefae'],
      ['0x2::sui::SUI', '0x219d80b1be5d586ff3bdbfeaf4d051ec721442c3a6498a3222773c6945a73d9f::usdt::USDT']
    )

    const returnValues = result.results![0]!.returnValues!

    const type = parseMoveType(returnValues[0][1])
    // await coder.registerBCSTypes(parseMoveType(type))

    // const bcs = new BCS(getSuiMoveConfig());

    // console.log(bcs.hasType("u8"))
    //
    const deData = await coder.decodeBCS(type, Uint8Array.from(returnValues[0][0]))

    const deData2 = await coder.decodedType(deData, type)
    //
    console.log(deData)
    // // bcs.registerType()

    // bcs.registerType()
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
