import { TransactionBlock } from '@mysten/sui.js/transactions'
import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client'
import { clob_v2 } from './types/0xdee9.js'
import { _0x2 } from '@typemove/sui/builtin'

const tx = new TransactionBlock()
const provider = new SuiClient({ url: getFullnodeUrl('testnet') })

clob_v2.builder.getMarketPrice(
  tx,
  ['0x5d2687b354f2ad4bce90c828974346d91ac1787ff170e5d09cb769e5dbcdefae'],
  ['0x2::sui::SUI', '0x219d80b1be5d586ff3bdbfeaf4d051ec721442c3a6498a3222773c6945a73d9f::usdt::USDT']
)

const result = await provider.devInspectTransactionBlock({
  transactionBlock: tx,
  sender: '0xd9e6dc1e7f0790c18acf96b629f0a236d56de2f96537d921197bcb0e071b12bd',
})

console.log(tx.blockData)

const balance = await _0x2.coin.view.balance(
  provider,
  ['0x5d2687b354f2ad4bce90c828974346d91ac1787ff170e5d09cb769e5dbcdefae'],
  ['0x219d80b1be5d586ff3bdbfeaf4d051ec721442c3a6498a3222773c6945a73d9f::usdt::USDT']
)
console.log(balance)
