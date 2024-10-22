import { Transaction } from '@mysten/sui/transactions'

export function isTransactionArgument(value: any): boolean {
  if (typeof value !== 'object') return false
  if (value === null || value === undefined) return false

  return value.kind === 'GasCoin' || value.kind === 'Result' || value.kind === 'NestedResult' || value.kind === 'Input'
}

export function transactionArgumentOrObject(value: any, transactionBlock: Transaction): any {
  if (isTransactionArgument(value)) {
    return value
  }
  return transactionBlock.object(value)
}

export function transactionArgumentOrPure(value: any, transactionBlock: Transaction): any {
  if (isTransactionArgument(value)) {
    return value
  }
  return typeof value == 'string' ? transactionBlock.pure.string(value) : transactionBlock.pure.u64(value)
}

export function transactionArgumentOrVec(value: any, transactionBlock: Transaction): any {
  if (isTransactionArgument(value)) {
    return value
  }
  return transactionBlock.makeMoveVec({
    elements: value.map((a: any) => transactionBlock.object(a))
  })
}
