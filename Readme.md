# Typemove 
Generate TypeScript bindings for Move smart contracts. (currently support Aptos & SUI).
Developed by [Sentio](sentio.xyz).
## Features
 - Code generation for move smart contract based on ABI
 - Typesafe encode/decoding, object filtering, etc
 - Simple View function calling, transaction building
 - Automatically manage depended modules
## Details:
 - [Aptos](packages/aptos/Readme.md)
 - [SUI](packages/sui/Readme.md)
## Development
```shell
pnpm install
pnpm build:all
```

Check submodules's package.json for other commands