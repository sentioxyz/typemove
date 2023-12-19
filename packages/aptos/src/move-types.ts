// import {  MoveModule } from '@aptos-labs/ts-sdk'

export type Address = string

export type {
  MoveAddressType,
  Event,
  MoveFunction,
  MoveModule,
  MoveResource,
  MoveStruct,
  MoveStructField,
  MoveModuleBytecode
} from '@aptos-labs/ts-sdk'
import { EntryFunctionPayloadResponse, UserTransactionResponse } from '@aptos-labs/ts-sdk'

export type TransactionPayload_EntryFunctionPayload = EntryFunctionPayloadResponse
