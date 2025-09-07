import { accountTypeString, moduleQname, SPLITTER, VECTOR_STR } from './utils.js'
import { DecodedStruct, matchType, parseMoveType, TypeDescriptor } from './types.js'
import { InternalMoveEnum, InternalMoveFunction, InternalMoveModule, InternalMoveStruct } from './internal-models.js'
// import { bytesToBigInt } from '../utils/index.js'
import { ChainAdapter } from './chain-adapter.js'

export abstract class AbstractMoveCoder<ModuleType, StructType> {
  protected moduleMapping = new Map<string, InternalMoveModule>()
  protected accounts = new Set<string>()
  private typeMapping = new Map<string, InternalMoveStruct>()
  private enumMapping = new Map<string, InternalMoveEnum>()

  private funcMapping = new Map<string, InternalMoveFunction>()
  // network: string
  adapter: ChainAdapter<ModuleType, StructType>

  protected constructor(adapter: ChainAdapter<ModuleType, StructType>) {
    this.adapter = adapter
  }

  contains(account: string, name: string) {
    return this.moduleMapping.has(moduleQname({ address: account, name }))
  }

  abstract load(module: ModuleType, address: string): InternalMoveModule

  protected loadInternal(module: InternalMoveModule, address: string) {
    const account = module.address
    const declareAccount = accountTypeString(address)

    this._loadInternal(module, account)
    if (account !== declareAccount) {
      this._loadInternal(module, declareAccount)
    }
  }

  private _loadInternal(module: InternalMoveModule, account: string) {
    if (this.contains(account, module.name)) {
      return
    }
    this.moduleMapping.set(moduleQname({ address: account, name: module.name }), module)
    for (const enumType of module.enums) {
      const key = [account, module.name, enumType.name].join(SPLITTER)
      this.enumMapping.set(key, enumType)
    }

    for (const struct of module.structs) {
      // TODO move to util
      const key = [account, module.name, struct.name].join(SPLITTER)
      this.typeMapping.set(key, struct)
    }

    for (const func of module.exposedFunctions) {
      // if (!func.isEntry) {
      //   continue
      // }
      const key = [account, module.name, func.name].join(SPLITTER)
      this.funcMapping.set(key, func)
    }
  }

  protected decodeBigInt(data: any): bigint {
    if (Array.isArray(data)) {
      throw new Error('data is in byte array')
      // Only sui function need this, strange
      // const bytes = data as number[]
      // return bytesToBigInt(new Uint8Array(bytes.slice().reverse()))
    }

    return BigInt(data)
  }

  private requestMap = new Map<string, Promise<void>>()

  async getMoveStruct(type: string): Promise<InternalMoveStruct> {
    const [account_, module, typeName] = type.split(SPLITTER)
    const account = accountTypeString(account_)
    type = [account, module, typeName].join(SPLITTER)

    let struct = this.typeMapping.get(type)
    if (struct) {
      return struct
    }
    if (this.accounts.has(account)) {
      throw new Error('Failed to load struct ' + type + ' for imported account')
    }
    let resp = this.requestMap.get(account)
    if (!resp) {
      resp = this.adapter.fetchModules(account).then((modules) => {
        for (const m of modules) {
          this.load(m, account)
        }
      })
      this.requestMap.set(account, resp)
    }
    await resp
    struct = this.typeMapping.get(type)
    if (struct) {
      return struct
    }
    throw new Error('Failed to load function ' + type + ' type are not imported anywhere')
  }

  async maybeGetMoveEnum(type: string): Promise<InternalMoveEnum | undefined> {
    const [account_, module, typeName] = type.split(SPLITTER)
    const account = accountTypeString(account_)
    type = [account, module, typeName].join(SPLITTER)

    let enumType = this.enumMapping.get(type)
    if (enumType) {
      return enumType
    }
    if (this.accounts.has(account)) {
      return undefined
    }
    let resp = this.requestMap.get(account)
    if (!resp) {
      resp = this.adapter.fetchModules(account).then((modules) => {
        for (const m of modules) {
          this.load(m, account)
        }
      })
      this.requestMap.set(account, resp)
    }
    await resp
    enumType = this.enumMapping.get(type)
    if (enumType) {
      return enumType
    }
    return undefined
  }

  async getMoveFunction(type: string): Promise<InternalMoveFunction> {
    const [account_, module, typeName] = type.split(SPLITTER)
    const account = accountTypeString(account_)
    type = [account, module, typeName].join(SPLITTER)

    let func = this.funcMapping.get(type)
    if (func) {
      return func
    }
    if (this.accounts.has(account)) {
      throw new Error('Failed to load function ' + type + ' for imported account')
    }
    let resp = this.requestMap.get(account)
    if (!resp) {
      resp = this.adapter
        .fetchModules(account)
        .then((modules) => {
          for (const m of modules) {
            this.load(m, account)
          }
        })
        .catch((e) => {
          this.requestMap.delete(account)
        })
      this.requestMap.set(account, resp)
    }
    await resp
    func = this.funcMapping.get(type)
    if (func) {
      return func
    }
    throw new Error('Failed to load function ' + type + ' type are not imported anywhere')
  }

  protected async decode<T>(data: any, type: TypeDescriptor<T>): Promise<T> {
    // process simple type
    if (type.reference) {
      return data
    }
    switch (type.qname) {
      case 'signer': // TODO check this, aptos only
      case 'address':
      case 'Address':
      case '0x1::string::String':
      case 'bool':
      case 'Bool':
      case 'u8':
      case 'U8':
      case 'u16':
      case 'U16':
      case 'u32':
      case 'U32':
        return data
      case 'u64':
      case 'U64':
      case 'u128':
      case 'U128':
      case 'u256':
      case 'U256':
        return this.decodeBigInt(data) as any
    }

    // process vector
    if (type.qname.toLowerCase() === VECTOR_STR) {
      // vector<u8> as hex string
      if (type.typeArgs[0].qname === 'u8' || type.typeArgs[0].qname === 'U8') {
        return data
      }

      const res = []
      for (const entry of data) {
        res.push(await this.decode(entry, type.typeArgs[0]))
      }
      return res as any
    }

    // try enum type first
    const enumType = await this.maybeGetMoveEnum(type.qname)
    if (enumType) {
      return data
    }

    // Process complex type
    const struct = await this.getMoveStruct(type.qname)

    const typeCtx = new Map<string, TypeDescriptor>()
    for (const [idx, typeArg] of type.typeArgs.entries()) {
      typeCtx.set('T' + idx, typeArg)
    }

    const typedData: any = {}

    for (const field of struct.fields) {
      let filedType = field.type
      filedType = filedType.applyTypeArgs(typeCtx)
      const fieldValue = this.adapter.getData(data)[field.name]
      const value = await this.decode(fieldValue, filedType)
      typedData[field.name] = value
    }
    return typedData
  }

  async decodeArray(entries: any[], types: TypeDescriptor[], strict = true): Promise<any[]> {
    const entriesDecoded: any[] = []
    for (const [idx, arg] of entries.entries()) {
      // TODO consider apply payload.type_arguments, but this might be hard since we don't code gen for them
      const argType = types[idx]
      try {
        if (!strict && arg === undefined) {
          entriesDecoded.push(arg)
        } else {
          entriesDecoded.push(await this.decode(arg, argType))
        }
      } catch (e) {
        throw Error('Decoding error for ' + JSON.stringify(arg) + 'using type' + argType + e.toString())
      }
    }
    return entriesDecoded
  }

  public encode(data: any): any {
    if (data === undefined || data === null) {
      return undefined
    }
    if (typeof data === 'bigint') {
      return data.toString()
    }
    if (Array.isArray(data)) {
      return this.encodeArray(data)
    }
    for (const [key, value] of Object.entries(data)) {
      if (!value) {
        continue
      }
      if (typeof value === 'bigint') {
        data[key] = value.toString()
      }
    }
    return data
  }

  encodeArray(entriesDecoded: any[]): any[] {
    const entries: any[] = []
    for (const [idx, arg] of entriesDecoded.entries()) {
      entries.push(this.encode(arg))
    }
    return entries
  }

  async decodeCallResult(res: any[], func: string): Promise<any[]> {
    const f = await this.getMoveFunction(func)
    return this.decodeArray(res, f.return)
  }

  async filterAndDecodeStruct<T, ST extends StructType>(
    typeMatcher: TypeDescriptor<T>,
    structsWithTags: ST[]
  ): Promise<DecodedStruct<ST, T>[]> {
    if (!structsWithTags) {
      return [] as any
    }
    // const typeMatcherDescriptor = parseMoveType(typeMatcher)
    const results: DecodedStruct<ST, T>[] = []
    for (const resource of structsWithTags) {
      const resourceType = this.adapter.getType(resource)
      const resourceTypeDescriptor = parseMoveType(resourceType)
      if (!matchType(typeMatcher, resourceTypeDescriptor)) {
        continue
      }

      const result = await this.decodedStruct<T, ST>(resource)
      if (result) {
        results.push(result)
      } else {
        console.error('decoding error')
      }
    }
    return results
  }

  protected async decodedStruct<T, ST extends StructType>(typeStruct: ST): Promise<DecodedStruct<ST, T> | undefined> {
    const typeDescriptor = parseMoveType(this.adapter.getType(typeStruct))
    const typeArguments = typeDescriptor.typeArgs.map((t) => t.getSignature())

    let dataTyped = undefined
    try {
      dataTyped = await this.decode(typeStruct, typeDescriptor)
    } catch (e) {
      throw Error('Decoding error for struct' + JSON.stringify(typeStruct) + e.toString())
      // return undefined
    }
    return {
      ...typeStruct,
      data_decoded: dataTyped,
      type_arguments: typeArguments
    }
  }

  public async decodeType<T, ST>(typeStruct: ST, type: TypeDescriptor<T>): Promise<T | undefined> {
    if (typeStruct === null || typeStruct == undefined) {
      return typeStruct as any
    }
    if (typeof typeStruct === 'object') {
      if ('type' in typeStruct) {
        const typeInStruct = parseMoveType((typeStruct.type as any).toString() || '')
        if (!matchType(type, typeInStruct)) {
          return undefined
        }
      }
    }

    return await this.decode(typeStruct, type)
  }
}
