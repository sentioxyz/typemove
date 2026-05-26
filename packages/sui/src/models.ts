import type { SuiClientTypes } from '@mysten/sui/client'
import type { GrpcTypes } from '@mysten/sui/grpc'
import { DecodedStruct } from '@typemove/move'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000'

// Decoder input/output types are now keyed on @mysten/sui/client's unified
// SuiClientTypes shapes (which both jsonRpc and gRPC clients implement) plus
// gRPC proto types for the transaction-side shapes that don't have a
// transport-agnostic equivalent. No `@mysten/sui/jsonRpc` import remains.
export type TypedEventInstance<T> = DecodedStruct<SuiClientTypes.Event, T>
export type TypedSuiMoveObject<T> = DecodedStruct<SuiClientTypes.Object<{ json: true }>, T>

export type TypedFunctionPayload<T extends Array<any>> = GrpcTypes.MoveCall & {
  /**
   * decoded argument data using ABI, undefined if there is decoding error, usually because the ABI/data mismatch
   */
  arguments_decoded: T
}

// Result wrapper for SuiGrpcClient.simulateTransaction return values. Replaces
// the old TypedDevInspectResults that was tied to JSON-RPC's DevInspectResults.
// The raw simulate response shape is intentionally widened to `any` here
// because the underlying SDK types are heavily generic and we only need the
// `commandResults` slice; we pass the original result through unchanged plus a
// `results_decoded` field populated by `MoveCoder.decodeSimulateResult`.
export type TypedSimulateResults<T extends Array<any>> = {
  /**
   * Decoded return values using ABI, undefined if there is decoding error, usually because the ABI/data mismatch
   */
  results_decoded?: T
} & Record<string, any>
