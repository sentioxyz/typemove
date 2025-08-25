import { Transaction, TransactionArgument, TransactionObjectInput } from '@iota/iota-sdk/transactions'

export function isTransactionArgument(value: any): boolean {
  if (typeof value !== 'object') return false
  if (value === null || value === undefined) return false

  return (
    value.$kind === 'GasCoin' || value.$kind === 'Result' || value.$kind === 'NestedResult' || value.$kind === 'Input'
  )
}

export function transactionArgumentOrObject(
  value: TransactionObjectInput,
  transactionBlock: Transaction
): TransactionArgument {
  // if (isTransactionArgument(value)) {
  //   return value as TransactionArgument
  // }
  return transactionBlock.object(value)
}

export function transactionArgumentOrPure(value: any, transactionBlock: Transaction): any {
  if (isTransactionArgument(value)) {
    return value
  }
  return typeof value == 'string' ? transactionBlock.pure.string(value) : transactionBlock.pure.u64(value)
}

export function transactionArgumentOrPureString(
  value: TransactionArgument | string,
  transactionBlock: Transaction
): TransactionArgument {
  if (isTransactionArgument(value)) {
    return value as TransactionArgument
  }
  return transactionBlock.pure.string(value as string)
}

export function transactionArgumentOrPureAddress(
  value: TransactionArgument | string,
  transactionBlock: Transaction
): TransactionArgument {
  if (isTransactionArgument(value)) {
    return value as TransactionArgument
  }
  return transactionBlock.pure.address(value as string)
}

export function transactionArgumentOrPureU8(
  value: TransactionArgument | number,
  transactionBlock: Transaction
): TransactionArgument {
  if (isTransactionArgument(value)) {
    return value as TransactionArgument
  }
  return transactionBlock.pure.u8(value as number)
}

export function transactionArgumentOrPureU16(
  value: TransactionArgument | number,
  transactionBlock: Transaction
): TransactionArgument {
  if (isTransactionArgument(value)) {
    return value as TransactionArgument
  }
  return transactionBlock.pure.u16(value as number)
}

export function transactionArgumentOrPureU32(
  value: TransactionArgument | number,
  transactionBlock: Transaction
): TransactionArgument {
  if (isTransactionArgument(value)) {
    return value as TransactionArgument
  }
  return transactionBlock.pure.u32(value as number)
}

export function transactionArgumentOrPureU64(
  value: TransactionArgument | bigint | number | string,
  transactionBlock: Transaction
): TransactionArgument {
  if (isTransactionArgument(value)) {
    return value as TransactionArgument
  }
  return transactionBlock.pure.u64(value as number)
}

export function transactionArgumentOrPureU128(
  value: TransactionArgument | bigint | number | string,
  transactionBlock: Transaction
): TransactionArgument {
  if (isTransactionArgument(value)) {
    return value as TransactionArgument
  }
  return transactionBlock.pure.u128(value as number)
}

export function transactionArgumentOrPureU256(
  value: TransactionArgument | bigint | number | string,
  transactionBlock: Transaction
): TransactionArgument {
  if (isTransactionArgument(value)) {
    return value as TransactionArgument
  }
  return transactionBlock.pure.u256(value as number)
}

export function transactionArgumentOrPureBool(
  value: TransactionArgument | boolean,
  transactionBlock: Transaction
): TransactionArgument {
  if (isTransactionArgument(value)) {
    return value as TransactionArgument
  }
  return transactionBlock.pure.bool(value as boolean)
}

// TODO vector might be nested
export function transactionArgumentOrVec(value: any, transactionBlock: Transaction): any {
  if (isTransactionArgument(value)) {
    return value
  }
  return transactionBlock.makeMoveVec({
    elements: value.map((a: any) => transactionBlock.object(a))
  })
}
