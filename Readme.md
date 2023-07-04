# Typemove 
Generate TypeScript bindings for Sui contracts.
## Features
 - Code generation for SUI smart contract based on ABI
 - 
## Usage
### Code Generation
```typescript
typemove-sui <path-of-abi-file> <path-of-target-ts-directory> <testnet|mainnet>
```

### Decode Object
```typescript
const res = await coder.decodedType(
  data,
  parseMoveType('0xebaa2ad3eacc230f309cd933958cc52684df0a41ae7ac214d186b80f830867d2::single_collateral::Info')
)
expect(res.delivery_info.price).equals(603716059n)
```

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

Checkout our [example](./examples/sui) for full codes。