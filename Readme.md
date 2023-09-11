# Typemove 
Generate TypeScript bindings for Move smart contracts. (currently support Aptos & SUI).
Developed by [Sentio](sentio.xyz).
## Features
 - Code generation for move smart contract based on ABI
 - Friendly typing using `bigint` instead of `string` for objects
 - Flawless works with any IDE
 - Typesafe encode/decoding, object filtering, etc
 - Simple View function calling, transaction building
 - Automatically manage depended modules
 - Easy to extend for your own code generator

|                       | Aptos | SUI         |
|-----------------------|-------|-------------|
| Type Generate         | Done  | Done        |     
| Decoding/Encoding     | Done  | Done        |
| View Function         | Done  | In Progress |
| Transaction Building  | Done  | Done        |
| Resource/Object Utils | Done  | In Progress |

## Details:
 - [@typemove/aptos](packages/aptos/Readme.md)
 - [@typemove/sui](packages/sui/Readme.md)

## Development
```shell
pnpm install
pnpm build:all
```

Check submodules's package.json for other commands