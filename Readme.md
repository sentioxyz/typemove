<p align="center">
  <img src="./images/logo.png" width="300" alt="TypeChain">
</p>

# TypeMove 
Generate TypeScript bindings for Move smart contracts. (currently support Aptos & SUI).
Developed by [Sentio](http://sentio.xyz).

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/sentioxyz/typemove/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/sentioxyz/typemove/tree/main)
[![npm version](https://badge.fury.io/js/@typemove%2Fmove.svg)](https://badge.fury.io/js/@typemove%2Fmove)
## Features
 - Code generation for move smart contract based on ABI
 - Friendly typing using `bigint` instead of `string` for objects
 - Flawless works with any IDE
 - Typesafe encode/decoding, object filtering, etc
 - Simple View function calling, transaction building
 - Automatically manage depended modules
 - Easy to extend for your own code generator

|                       | Aptos | SUI  |
|-----------------------|-------|------|
| Type Generate         | Done  | Done |     
| Decoding/Encoding     | Done  | Done |
| View Function         | Done  | Done |
| Transaction Building  | Done  | Done |
| Resource/Object Utils | Done  | Done |

## Get Started
 - [For Aptos](packages/aptos/Readme.md)
 - [For Sui](packages/sui/Readme.md)

## Development
```shell
pnpm install
pnpm build:all
```

Check submodules's package.json for other commands