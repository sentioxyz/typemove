import { AptosClient, MaybeHexString } from 'aptos'
import { TypeDescriptor } from '@typemove/move'
import { defaultMoveCoder } from './move-coder.js'
import { TypedMoveResource } from './models.js'

type ResourceQuery = {
  ledgerVersion?: bigint | number
}

export class AccountResourceClient {
  client: AptosClient
  constructor(client: AptosClient) {
    this.client = client
  }

  /**
   * Get all resources of an account, same as `getAccountResources` in aptos client
   * @param accountAddress
   * @param query
   */
  async getAll(accountAddress: MaybeHexString, query?: ResourceQuery) {
    return this.client.getAccountResources(accountAddress, query)
  }

  /**
   * Match a single resource with exact type, resource type should not contain any type
   * @param accountAddress
   * @param resourceType
   * @param query
   */
  async matchExact<T>(
    accountAddress: MaybeHexString,
    resourceType: TypeDescriptor<T>,
    query?: ResourceQuery
  ): Promise<TypedMoveResource<T> | undefined> {
    if (resourceType.existAnyType()) {
      throw new Error('resource type for match call should not contain any type')
    }
    const typeStr = resourceType.getSignature()
    const result = await this.client.getAccountResource(accountAddress, typeStr, query)
    return defaultMoveCoder(this.client.nodeUrl).decodeResource<T>(result)
  }

  /**
   * Match all resources with type pattern, it could be a partial type like `amm.Pool<aptos_coin.AptosCoin.type(), ANY_TYPE>`
   * @param accountAddress
   * @param resourceType
   * @param query
   */
  async matchAll<T>(
    accountAddress: MaybeHexString,
    resourceType: TypeDescriptor<T>,
    query?: ResourceQuery
  ): Promise<TypedMoveResource<T>[]> {
    const result = await this.client.getAccountResources(accountAddress, query)
    return defaultMoveCoder(this.client.nodeUrl).filterAndDecodeResources<T>(resourceType, result)
  }
}
