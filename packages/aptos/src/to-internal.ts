import {
  InternalMoveFunction,
  InternalMoveFunctionVisibility,
  InternalMoveModule,
  InternalMoveStruct,
  InternalMoveStructField,
  parseMoveType,
} from '@typemove/move'
import { Types } from 'aptos'
import {
  MoveFunction,
  MoveModuleBytecode,
  MoveStruct,
  MoveStructField,
} from './move-types'

export function toInternalModule(
  module: MoveModuleBytecode
): InternalMoveModule {
  if (!module.abi) {
    throw Error('module with no ABI found')
  }
  const abi = module.abi
  return {
    address: abi.address,
    exposedFunctions: abi.exposed_functions.map(toInternalFunction),
    name: abi.name,
    structs: abi.structs.map(toInternalStruct),
  }
}

export function toInternalFunction(func: MoveFunction): InternalMoveFunction {
  let visibility
  switch (func.visibility) {
    case Types.MoveFunctionVisibility.PRIVATE:
      visibility = InternalMoveFunctionVisibility.PRIVATE
      break
    case Types.MoveFunctionVisibility.PUBLIC:
      visibility = InternalMoveFunctionVisibility.PUBLIC
      break
    case Types.MoveFunctionVisibility.FRIEND:
      visibility = InternalMoveFunctionVisibility.FRIEND
      break
  }
  return {
    typeParams: func.generic_type_params,
    isEntry: func.is_entry,
    name: func.name,
    params: func.params.map(parseMoveType),
    return: func.return.map(parseMoveType),
    visibility: visibility,
  }
}

export function toInternalStruct(struct: MoveStruct): InternalMoveStruct {
  return {
    abilities: struct.abilities,
    fields: struct.fields.map(toInternalField),
    typeParams: struct.generic_type_params,
    isNative: struct.is_native,
    name: struct.name,
  }
}

export function toInternalField(
  module: MoveStructField
): InternalMoveStructField {
  return {
    name: module.name,
    type: parseMoveType(module.type),
  }
}
