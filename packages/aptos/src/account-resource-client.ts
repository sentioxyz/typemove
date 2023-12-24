import {
  AccountAddressInput,
  Aptos,
  MoveStructId,
  LedgerVersionArg,
  PaginationArgs,
  MoveResource
} from '@aptos-labs/ts-sdk'
import { TypeDescriptor } from '@typemove/move'
import { defaultMoveCoder } from './move-coder.js'
import { TypedMoveResource } from './models.js'

// type ResourceQuery = {
//   ledgerVersion?: bigint | number
// }

export class AccountResourceClient {
  client: Aptos
  constructor(client: Aptos) {
    this.client = client
  }

  /**
   * Get all resources of an account, same as `getAccountResources` in aptos client
   * @param accountAddress
   * @param query
   */
  async getAll(accountAddress: AccountAddressInput, options?: PaginationArgs & LedgerVersionArg) {
    return this.client.getAccountResources({ accountAddress, options })
  }

  /**
   * Match a single resource with exact type, resource type should not contain any type
   * @param accountAddress
   * @param resourceType
   * @param options
   */
  async matchExact<T>(
    accountAddress: AccountAddressInput,
    resourceType: TypeDescriptor<T>,
    options?: LedgerVersionArg
  ): Promise<TypedMoveResource<T> | undefined> {
    if (resourceType.existAnyType()) {
      throw new Error('resource type for match call should not contain any type')
    }
    const typeStr = resourceType.getSignature() as MoveStructId
    const result = await this.client.getAccountResource({ accountAddress, resourceType: typeStr, options })
    const resource: MoveResource = {
      type: typeStr,
      data: result
    }
    return defaultMoveCoder(this.client.config.fullnode).decodeResource<T>(resource)
  }

  /**
   * Match all resources with type pattern, it could be a partial type like `amm.Pool<aptos_coin.AptosCoin.type(), ANY_TYPE>`
   * @param accountAddress
   * @param resourceType
   * @param options
   */
  async matchAll<T>(
    accountAddress: AccountAddressInput,
    resourceType: TypeDescriptor<T>,
    options?: PaginationArgs & LedgerVersionArg
  ): Promise<TypedMoveResource<T>[]> {
    const result = await this.client.getAccountResources({ accountAddress, options })
    return defaultMoveCoder(this.client.config.fullnode).filterAndDecodeResources<T>(resourceType, result)
  }
}
