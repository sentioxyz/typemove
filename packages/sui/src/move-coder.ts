import { TypedEventInstance, TypedFunctionPayload } from './models.js'
import {
  AbstractMoveCoder,
  ANY_TYPE,
  DecodedStruct,
  parseMoveType,
  SPLITTER,
  TypeDescriptor,
  InternalMoveModule,
} from '@typemove/move'
import {
  MoveCallSuiTransaction,
  SuiCallArg,
  SuiEvent,
  SuiMoveNormalizedModule,
  SuiMoveObject,
} from '@mysten/sui.js/client'
import { toInternalModule } from './to-internal.js'
import { SuiChainAdapter } from './sui-chain-adapter.js'
import { dynamic_field } from './builtin/0x2.js'

export class MoveCoder extends AbstractMoveCoder<
  // SuiNetwork,
  SuiMoveNormalizedModule,
  SuiEvent | SuiMoveObject
> {
  constructor(network: string) {
    super(new SuiChainAdapter(network))
  }

  load(module: SuiMoveNormalizedModule): InternalMoveModule {
    let m = this.moduleMapping.get(module.address + '::' + module.name)
    if (m) {
      return m
    }
    m = toInternalModule(module)
    this.loadInternal(m)
    return m
  }

  protected decode(data: any, type: TypeDescriptor): any {
    switch (type.qname) {
      case '0x1::ascii::Char':
      case '0x1::ascii::String':
      case '0x2::object::ID':
      case '0x2::coin::Coin':
        return data
      case '0x2::balance::Balance':
        return BigInt(data)
      case '0x1::option::Option':
        if (data === null) {
          return data
        }
        return this.decode(data, type.typeArgs[0])
      default:
        return super.decode(data, type)
    }
  }

  decodeEvent<T>(event: SuiEvent): Promise<TypedEventInstance<T> | undefined> {
    return this.decodedStruct(event)
  }
  filterAndDecodeEvents<T>(type: TypeDescriptor<T> | string, resources: SuiEvent[]): Promise<TypedEventInstance<T>[]> {
    if (typeof type === 'string') {
      type = parseMoveType(type)
    }
    return this.filterAndDecodeStruct(type, resources)
  }

  async getDynamicFields<T1, T2>(
    objects: SuiMoveObject[],
    keyType: TypeDescriptor<T1> = ANY_TYPE,
    valueType: TypeDescriptor<T2> = ANY_TYPE
  ): Promise<dynamic_field.Field<T1, T2>[]> {
    // const type = dynamic_field.Field.TYPE
    // Not using the code above to avoid cycle initialize failed
    const type = new TypeDescriptor<dynamic_field.Field<T1, T2>>('0x2::dynamic_field::Field')
    type.typeArgs = [keyType, valueType]
    const res = await this.filterAndDecodeObjects(type, objects)
    return res.map((o) => o.data_decoded)
  }

  filterAndDecodeObjects<T>(
    type: TypeDescriptor<T>,
    objects: SuiMoveObject[]
  ): Promise<DecodedStruct<SuiMoveObject, T>[]> {
    return this.filterAndDecodeStruct(type, objects)
  }

  async decodeFunctionPayload(payload: MoveCallSuiTransaction, inputs: SuiCallArg[]): Promise<MoveCallSuiTransaction> {
    const functionType = [payload.package, payload.module, payload.function].join(SPLITTER)
    const func = await this.getMoveFunction(functionType)
    const params = this.adapter.getMeaningfulFunctionParams(func.params)
    const args = []
    for (const value of payload.arguments || []) {
      const argValue = value as any
      if ('Input' in (argValue as any)) {
        const idx = argValue.Input
        const arg = inputs[idx]
        if (arg.type === 'pure') {
          args.push(arg.value)
        } else if (arg.type === 'object') {
          // object is not there
          args.push(undefined)
        } else {
          console.error('unexpected function arg value')
          args.push(undefined)
        }
        // args.push(arg) // TODO check why ts not work using arg.push(arg)
      } else {
        args.push(undefined)
      }
    }

    const argumentsTyped = await this.decodeArray(args, params, false)
    return {
      ...payload,
      arguments_decoded: argumentsTyped,
    } as TypedFunctionPayload<any>
  }
}

const DEFAULT_ENDPOINT = 'https://fullnode.mainnet.sui.io/'
const CODER_MAP = new Map<string, MoveCoder>()

export function defaultMoveCoder(endpoint: string = DEFAULT_ENDPOINT): MoveCoder {
  let coder = CODER_MAP.get(endpoint)
  if (!coder) {
    coder = new MoveCoder(DEFAULT_ENDPOINT)
    CODER_MAP.set(endpoint, coder)
  }
  return coder
}
