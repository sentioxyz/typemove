import { InternalMoveModule, InternalMoveStruct } from './internal-models.js'
import { camel as camelRadash } from 'radash'

export const SPLITTER = '::'

export const VECTOR_STR = 'vector'

export function isFrameworkAccount(account: string) {
  const n = parseInt(account, 16)
  if (Number.isNaN(n)) {
    return false
  }
  return n >= 0 && n < 16
}

// strip any lead 0
export function accountTypeString(account: string): string {
  const withoutPrefix = account.toLowerCase().replace(/^(0x)/, '')
  return '0x' + withoutPrefix.replace(/^0*/, '')
}

const MOVE_ADDRESS_LENGTH = 32

function isHex(value: string): boolean {
  return /^(0x|0X)?[a-fA-F0-9]+$/.test(value)
}

function getHexByteLength(value: string): number {
  return /^(0x|0X)/.test(value) ? (value.length - 2) / 2 : value.length / 2
}

export function isValidMoveAddress(value: string): boolean {
  return isHex(value) && getHexByteLength(value) <= MOVE_ADDRESS_LENGTH
}

// Get full address with 32 bytes
export function accountAddressString(account: string): string {
  if (!isValidMoveAddress(account)) {
    throw Error('Not valid move address')
  }

  const address = account.toLowerCase().replace(/^(0x)/, '')
  return `0x${address.padStart(MOVE_ADDRESS_LENGTH * 2, '0')}`
}

// https://github.com/microsoft/TypeScript/issues/2536
const KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'as',
  'implements',
  'interface',
  'let',
  'package',
  'private',
  'protected',
  'public',
  'static',
  'yield',
  'any',
  'boolean',
  'constructor',
  'declare',
  // 'get',
  'module',
  // 'require',
  'number',
  // 'set',
  'string',
  'symbol',
  'type',
  'from',
  // 'of',
  'async',
  'await',
  'bigint',
  'object',
  'volatile',
  'namespace',
  'arguments'
])

export function normalizeToJSName(name: string) {
  if (KEYWORDS.has(name)) {
    return name + '$'
  }
  return name
}

export function moduleQnameForType(type: string): [string, string] {
  const parts = type.split(SPLITTER).slice(0, 2)
  return [parts[0], parts[1]]
}

export function moduleQname(module: { address: string; name: string }): string {
  return accountTypeString(module.address) + SPLITTER + module.name
}

export function structQname(module: InternalMoveModule, struct: InternalMoveStruct): string {
  return [accountTypeString(module.address), module.name, struct.name].join(SPLITTER)
}

export function upperFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function camel(str: string): string {
  const base = camelRadash(str)
  return str.endsWith('_') ? base + '_' : base
}
