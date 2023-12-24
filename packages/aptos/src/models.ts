import { DecodedStruct } from '@typemove/move'
import { EntryFunctionPayloadResponse, MoveResource, Event } from '@aptos-labs/ts-sdk'

export type TypedEventInstance<T> = DecodedStruct<Event, T>
export type TypedMoveResource<T> = DecodedStruct<MoveResource, T>

// Don't use intermediate type to make IDE happier
export type TypedFunctionPayload<T extends Array<any>> = EntryFunctionPayloadResponse & {
  /**
   * decoded argument data using ABI, undefined if there is decoding error, usually because the ABI/data mismatch
   */
  arguments_decoded: T
}
