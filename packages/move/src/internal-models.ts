import { TypeDescriptor } from './types.js'

export interface InternalMoveModule {
  address: string
  name: string
  exposedFunctions: InternalMoveFunction[]
  structs: InternalMoveStruct[]
  enums: InternalMoveEnum[]
}

export interface InternalMoveFunction {
  name: string
  visibility: InternalMoveFunctionVisibility
  isEntry: boolean
  isView?: boolean
  typeParams: InternalMoveTypeParam[]
  params: TypeDescriptor[]
  return: TypeDescriptor[]
}

export interface InternalMoveStruct {
  name: string
  isNative: boolean
  isEvent: boolean
  abilities: string[]
  typeParams: InternalMoveTypeParam[]
  fields: InternalMoveStructField[]
}

export interface InternalMoveEnum {
  name: string
  abilities: string[]
  typeParams: InternalMoveTypeParam[]
  variants: {
    [key: string]: InternalMoveStructField[]
  }
}

export interface InternalMoveStructField {
  name: string
  type: TypeDescriptor
}

export enum InternalMoveFunctionVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
  FRIEND = 'friend'
}

export type InternalMoveTypeParam = {
  constraints: string[]
}
