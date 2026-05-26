import type { GrpcTypes } from '@mysten/sui/grpc'
import {
  accountTypeString,
  InternalMoveEnum,
  InternalMoveFunction,
  InternalMoveFunctionVisibility,
  InternalMoveModule,
  InternalMoveStruct,
  InternalMoveStructField,
  SPLITTER,
  TypeDescriptor
} from '@typemove/move'

// Re-exports for convenience: callers used to import named types from
// '@mysten/sui/jsonRpc'; now they come from the gRPC proto namespace.
type Module = GrpcTypes.Module
type DatatypeDescriptor = GrpcTypes.DatatypeDescriptor
type FieldDescriptor = GrpcTypes.FieldDescriptor
type FunctionDescriptor = GrpcTypes.FunctionDescriptor
type OpenSignature = GrpcTypes.OpenSignature
type OpenSignatureBody = GrpcTypes.OpenSignatureBody

// Proto enum constants kept as literals so we can compare against
// the ordinals returned in the wire-decoded shape without importing
// the namespaced enum at runtime.
const DATATYPE_KIND_STRUCT = 1
const DATATYPE_KIND_ENUM = 2

const VISIBILITY_PRIVATE = 1
const VISIBILITY_PUBLIC = 2
const VISIBILITY_FRIEND = 3

// OpenSignatureBody.Type
const TYPE_ADDRESS = 1
const TYPE_BOOL = 2
const TYPE_U8 = 3
const TYPE_U16 = 4
const TYPE_U32 = 5
const TYPE_U64 = 6
const TYPE_U128 = 7
const TYPE_U256 = 8
const TYPE_VECTOR = 9
const TYPE_DATATYPE = 10
const TYPE_TYPE_PARAMETER = 11

const ABILITY_NAMES: Record<number, string> = {
  1: 'Copy',
  2: 'Drop',
  3: 'Store',
  4: 'Key'
}

// Convert a proto Module (from movePackageService.getPackage().package.modules[i])
// into typemove's InternalMoveModule. `packageAddress` is needed because the
// proto Module doesn't repeat the package id on every module entry.
export function toInternalModule(module: Module, packageAddress: string): InternalMoveModule {
  packageAddress = accountTypeString(packageAddress)
  const datatypes = module.datatypes ?? []
  const functions = module.functions ?? []

  const structs: InternalMoveStruct[] = datatypes.filter((d) => d.kind === DATATYPE_KIND_STRUCT).map(toInternalStruct)

  const enums: InternalMoveEnum[] = datatypes.filter((d) => d.kind === DATATYPE_KIND_ENUM).map(toInternalEnum)

  return {
    address: packageAddress,
    name: module.name ?? '',
    exposedFunctions: functions.map(toInternalFunction),
    structs,
    enums
  }
}

function toInternalFunction(func: FunctionDescriptor): InternalMoveFunction {
  let visibility: InternalMoveFunctionVisibility
  switch (func.visibility) {
    case VISIBILITY_PRIVATE:
      visibility = InternalMoveFunctionVisibility.PRIVATE
      break
    case VISIBILITY_PUBLIC:
      visibility = InternalMoveFunctionVisibility.PUBLIC
      break
    case VISIBILITY_FRIEND:
      visibility = InternalMoveFunctionVisibility.FRIEND
      break
    default:
      throw Error(`No visibility for function ${func.name}`)
  }
  return {
    typeParams: (func.typeParameters ?? []).map((p) => ({
      constraints: (p.constraints ?? []).map(abilityName)
    })),
    isEntry: func.isEntry ?? false,
    name: func.name ?? '',
    params: (func.parameters ?? []).map(toTypeDescriptorFromSignature),
    return: (func.returns ?? []).map(toTypeDescriptorFromSignature),
    visibility
  }
}

function toInternalStruct(d: DatatypeDescriptor): InternalMoveStruct {
  return {
    abilities: (d.abilities ?? []).map(abilityName),
    fields: (d.fields ?? []).map(toInternalField),
    typeParams: (d.typeParameters ?? []).map((p) => ({
      constraints: (p.constraints ?? []).map(abilityName)
    })),
    isNative: false,
    isEvent: false,
    name: d.name ?? ''
  }
}

function toInternalEnum(d: DatatypeDescriptor): InternalMoveEnum {
  const variants: { [key: string]: InternalMoveStructField[] } = {}
  for (const v of d.variants ?? []) {
    variants[v.name ?? ''] = (v.fields ?? []).map(toInternalField)
  }
  return {
    name: d.name ?? '',
    abilities: (d.abilities ?? []).map(abilityName),
    typeParams: (d.typeParameters ?? []).map((p) => ({
      constraints: (p.constraints ?? []).map(abilityName)
    })),
    variants
  }
}

function toInternalField(f: FieldDescriptor): InternalMoveStructField {
  if (!f.type) {
    throw Error(`Field ${f.name} has no type`)
  }
  return {
    name: f.name ?? '',
    type: toTypeDescriptorFromBody(f.type)
  }
}

// OpenSignature wraps an OpenSignatureBody with an optional reference marker.
// Used for function params and returns.
function toTypeDescriptorFromSignature(sig: OpenSignature): TypeDescriptor {
  if (!sig.body) {
    throw Error('OpenSignature has no body')
  }
  const desc = toTypeDescriptorFromBody(sig.body)
  // Reference.IMMUTABLE=1, MUTABLE=2
  if (sig.reference === 1) {
    desc.reference = true
  } else if (sig.reference === 2) {
    desc.reference = true
    desc.mutable = true
  }
  return desc
}

function toTypeDescriptorFromBody(body: OpenSignatureBody): TypeDescriptor {
  switch (body.type) {
    case TYPE_ADDRESS:
      return new TypeDescriptor('Address')
    case TYPE_BOOL:
      return new TypeDescriptor('Bool')
    case TYPE_U8:
      return new TypeDescriptor('U8')
    case TYPE_U16:
      return new TypeDescriptor('U16')
    case TYPE_U32:
      return new TypeDescriptor('U32')
    case TYPE_U64:
      return new TypeDescriptor('U64')
    case TYPE_U128:
      return new TypeDescriptor('U128')
    case TYPE_U256:
      return new TypeDescriptor('U256')
    case TYPE_VECTOR: {
      const inner = body.typeParameterInstantiation?.[0]
      if (!inner) throw Error('Vector OpenSignatureBody missing type parameter')
      return new TypeDescriptor('Vector', [toTypeDescriptorFromBody(inner)])
    }
    case TYPE_DATATYPE: {
      // gRPC emits typeName as `<defining_id>::<module>::<name>` with the
      // address in canonical long form (0x0000...0002). Normalize to the
      // short form (0x2) so module-lookup keys match what's loaded into
      // MoveCoder by short-form aware code paths.
      const raw = body.typeName ?? ''
      const parts = raw.split(SPLITTER)
      const qname = parts.length === 3 ? [accountTypeString(parts[0]), parts[1], parts[2]].join(SPLITTER) : raw
      const args = (body.typeParameterInstantiation ?? []).map(toTypeDescriptorFromBody)
      return new TypeDescriptor(qname, args)
    }
    case TYPE_TYPE_PARAMETER:
      return new TypeDescriptor('T' + (body.typeParameter ?? 0))
    default:
      throw new Error(`Unexpected OpenSignatureBody type: ${body.type}`)
  }
}

function abilityName(a: number): string {
  const n = ABILITY_NAMES[a]
  if (!n) throw Error(`Unknown Ability value: ${a}`)
  return n
}
