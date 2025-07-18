import type { IotaEvent, MoveCallIotaTransaction, IotaMoveObject, DevInspectResults } from '@iota/iota-sdk/client'
import { DecodedStruct } from '@typemove/move'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000'

export type TypedEventInstance<T> = DecodedStruct<IotaEvent, T>
export type TypedIotaMoveObject<T> = DecodedStruct<IotaMoveObject, T>

export type TypedFunctionPayload<T extends Array<any>> = MoveCallIotaTransaction & {
  /**
   * decoded argument data using ABI, undefined if there is decoding error, usually because the ABI/data mismatch
   */
  arguments_decoded: T
}

export type TypedDevInspectResults<T extends Array<any>> = DevInspectResults & {
  /**
   * Decoded return values using ABI, undefined if there is decoding error, usually because the ABI/data mismatch
   */
  results_decoded?: T
}
