import type {
  // IotaMoveNormalizedEnum,
  IotaMoveNormalizedField,
  IotaMoveNormalizedFunction,
  IotaMoveNormalizedModule,
  IotaMoveNormalizedStruct,
  IotaMoveNormalizedType
} from '@iota/iota-sdk/client'
import {
  // InternalMoveEnum,
  InternalMoveFunction,
  InternalMoveFunctionVisibility,
  InternalMoveModule,
  InternalMoveStruct,
  InternalMoveStructField,
  SPLITTER,
  TypeDescriptor
} from '@typemove/move'

export function toInternalModule(module: IotaMoveNormalizedModule): InternalMoveModule {
  return {
    address: module.address,
    exposedFunctions: Object.entries(module.exposedFunctions).map(([n, f]) => toInternalFunction(n, f)),
    name: module.name,
    structs: Object.entries(module.structs).map(([n, s]) => toInternalStruct(n, s)),
    enums: []
  }
}

function toInternalFunction(name: string, func: IotaMoveNormalizedFunction): InternalMoveFunction {
  let visibility
  switch (func.visibility) {
    case 'Private':
      visibility = InternalMoveFunctionVisibility.PRIVATE
      break
    case 'Public':
      visibility = InternalMoveFunctionVisibility.PUBLIC
      break
    case 'Friend':
      visibility = InternalMoveFunctionVisibility.FRIEND
      break
    default:
      throw Error('No visibility for function' + name)
  }
  return {
    typeParams: func.typeParameters.map((p: any) => {
      return { constraints: p.abilities }
    }),
    isEntry: func.isEntry,
    name: name,
    params: func.parameters.map(toTypeDescriptor),
    return: func.return.map(toTypeDescriptor),
    visibility: visibility
  }
}

function toInternalStruct(name: string, struct: IotaMoveNormalizedStruct): InternalMoveStruct {
  return {
    abilities: struct.abilities.abilities,
    fields: struct.fields.map(toInternalField),
    typeParams: struct.typeParameters.map((p: any) => {
      return { constraints: p.constraints.abilities }
    }),
    isNative: false,
    isEvent: false,
    name: name
  }
}

// function toInternalEnum(name: string, enumType: IotaMoveNormalizedEnum): InternalMoveEnum {
//   return {
//     name: name,
//     abilities: enumType.abilities.abilities,
//     typeParams: enumType.typeParameters.map((p: any) => {
//       return { constraints: p.constraints.abilities }
//     }),
//     variants: Object.entries(enumType.variants).reduce((acc: { [key: string]: InternalMoveStructField[] }, [k, v]) => {
//       acc[k] = v.map(toInternalField)
//       return acc
//     }, {})
//   }
// }

function toInternalField(module: IotaMoveNormalizedField): InternalMoveStructField {
  return {
    name: module.name,
    type: toTypeDescriptor(module.type)
  }
}

function toTypeDescriptor(normalizedType: IotaMoveNormalizedType): TypeDescriptor {
  if (typeof normalizedType === 'string') {
    return new TypeDescriptor(normalizedType)
  }

  if ('Struct' in normalizedType) {
    const qname = [normalizedType.Struct.address, normalizedType.Struct.module, normalizedType.Struct.name].join(
      SPLITTER
    )

    const args = normalizedType.Struct.typeArguments.map(toTypeDescriptor)

    return new TypeDescriptor(qname, args)
  }

  if ('Vector' in normalizedType) {
    return new TypeDescriptor('Vector', [toTypeDescriptor(normalizedType.Vector)])
  }
  if ('TypeParameter' in normalizedType) {
    return new TypeDescriptor('T' + normalizedType.TypeParameter)
  }

  if ('Reference' in normalizedType) {
    const res = toTypeDescriptor(normalizedType.Reference)
    res.reference = true
    return res
  }

  if ('MutableReference' in normalizedType) {
    const res = toTypeDescriptor(normalizedType.MutableReference)
    res.reference = true
    res.mutable = true
    return res
  }

  throw new Error('Unexpected sui type')
}
