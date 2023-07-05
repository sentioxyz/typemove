# Typemove 
Generate TypeScript bindings for Sui contracts.
## Features
 - Code generation for SUI smart contract based on ABI
 - Typesafe encode/decoding, object filtering, transaction building, etc
 - Automatically manage depended modules
 - BCS schema (WIP) 
## Usage
### Code Generation
```typescript
typemove-sui <path-of-abi-file> <path-of-target-ts-directory> <testnet|mainnet>
```

### Decode Object
```typescript
import { defaultMoveCoder } from '../move-coder.js'
import { single_collateral } from './types/testnet/0xebaa2ad3eacc230f309cd933958cc52684df0a41ae7ac214d186b80f830867d2.js'

const res = await defaultMoveCoder().decodedType(
  data,
  single_collateral.Info.type()
)
```

<details>
  <summary>Without TypeMove</summary>

### Heading
```typescript
export interface Info {
  index: string;
  creator: string;
  createTsMs: string;
  round: string;
  deliveryInfo?: DeliveryInfo;
}
export interface DeliveryInfo {
  round: string;
  price: string;
  size: string;
  premium: string;
  tsMs: string;
}

let deliveryInfo: DeliveryInfo | undefined =
    // @ts-ignore
    data.content.fields.info.fields.delivery_info
        ? {
          // @ts-ignore
          round: data.content.fields.info.fields.delivery_info.fields.round,
          // @ts-ignore
          price: data.content.fields.info.fields.delivery_info.fields.price,
          // @ts-ignore
          size: data.content.fields.info.fields.delivery_info.fields.size,
          // @ts-ignore
          premium: data.content.fields.info.fields.delivery_info.fields.premium,
          // @ts-ignore
          tsMs: data.content.fields.info.fields.delivery_info.fields.ts_ms,
        }
        : undefined;
let info: Info = {
  // @ts-ignore
  index: data.content.fields.info.fields.index,
  // @ts-ignore
  creator: data.content.fields.info.fields.creator,
  // @ts-ignore
  createTsMs: data.content.fields.info.fields.create_ts_ms,
  // @ts-ignore
  round: data.content.fields.info.fields.round,
  deliveryInfo,
};

```
</details>


### Decode dynamic fields
Get objects with specified type from a list of dynamic objects, and access field with fully typed object
```typescript
const decodedObjects = await coder.getDynamicFields(
    objects,
    BUILTIN_TYPES.U64_TYPE,
    single_collateral.PortfolioVault.type()
)
console.log(decodedObjects[0].value.info.delivery_info?.price)
```
![dynamic_fields.png](images/dynamic_fields.png)

### Building transaction
```typescript
import { clob_v2 } from './types/0xdee9.js'

clob_v2.builder.getMarketPrice(
    tx,
    ['0x5d2687b354f2ad4bce90c828974346d91ac1787ff170e5d09cb769e5dbcdefae'],
    [
      '0x2::sui::SUI',
      '0x219d80b1be5d586ff3bdbfeaf4d051ec721442c3a6498a3222773c6945a73d9f::usdt::USDT',
    ]
)

const result = await provider.devInspectTransactionBlock({
  transactionBlock: tx
})
```
If you just want to call `devInspectTransactionBlock` for single function, you can simply do
```typescript
import { clob_v2 } from './types/0xdee9.js'

await clob_v2.view.getMarketPrice(provider, 
    ['0x5d2687b354f2ad4bce90c828974346d91ac1787ff170e5d09cb769e5dbcdefae'],
    [
      '0x2::sui::SUI',
      '0x219d80b1be5d586ff3bdbfeaf4d051ec721442c3a6498a3222773c6945a73d9f::usdt::USDT',
  ])
```

Checkout our [example](./examples/sui) for full codes。