import {
  InternalMoveFunction,
  InternalMoveFunctionVisibility,
  InternalMoveModule,
  InternalMoveStruct,
} from './internal-models.js'
import path from 'path'
import fs from 'fs'
import { AccountModulesImportInfo, AccountRegister } from './account.js'
import chalk from 'chalk'
import { format } from 'prettier'
import {
  isFrameworkAccount,
  moduleQname,
  normalizeToJSName,
  SPLITTER,
  upperFirst,
  VECTOR_STR,
} from './utils.js'
import { camel } from 'radash'
import { TypeDescriptor } from './types.js'
import { ChainAdapter } from './chain-adapter.js'

interface OutputFile {
  fileName: string
  fileContent: string
}

interface Config {
  fileName: string
  outputDir: string
  // network: NetworkType
}

// TODO be able to generate cjs
export abstract class AbstractCodegen<ModuleTypes, StructType> {
  // TEST_NET: NetworkType
  // MAIN_NET: NetworkType
  ADDRESS_TYPE: string
  PREFIX: string
  STRUCT_FIELD_NAME: string = 'data'
  GENERATE_CLIENT = false
  GENERATE_ON_ENTRY = true
  PAYLOAD_OPTIONAL = false
  SYSTEM_MODULES = new Set(['0x1', '0x2', '0x3'])
  ESM = true

  chainAdapter: ChainAdapter<ModuleTypes, StructType>

  protected constructor(chainAdapter: ChainAdapter<ModuleTypes, StructType>) {
    this.chainAdapter = chainAdapter
  }

  public maybeEsmPrefix() {
    return this.ESM ? '.js' : ''
  }

  readModulesFile(fullPath: string) {
    return JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
  }

  async generate(
    srcDir: string,
    outputDir: string,
    // network: NetworkType,
    builtin = false
  ) {
    if (!fs.existsSync(srcDir)) {
      return 0
    }

    const files = fs.readdirSync(srcDir)
    outputDir = path.resolve(outputDir)
    const outputs: OutputFile[] = []

    fs.mkdirSync(outputDir, { recursive: true })

    const loader = new AccountRegister()

    // when generating user code, don't need to generate framework account
    for (const sysModule of this.SYSTEM_MODULES) {
      loader.accountImports.set(
        sysModule,
        new AccountModulesImportInfo(sysModule, sysModule)
      )
    }
    // const client = getRpcClient(network)

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue
      }
      const fullPath = path.resolve(srcDir, file)
      const abi = this.readModulesFile(fullPath)
      const modules = this.chainAdapter.toInternalModules(abi)

      for (const module of modules) {
        loader.register(module, path.basename(file, '.json'))
      }
      const codeGen = new AccountCodegen(this, loader, abi, modules, {
        fileName: path.basename(file, '.json'),
        outputDir: outputDir,
        // network,
      })

      outputs.push(...codeGen.generate())
    }

    while (loader.pendingAccounts.size > 0) {
      for (const account of loader.pendingAccounts) {
        console.log(
          `download dependent module for account ${account} at ${this.chainAdapter.endpoint}`
        )

        try {
          const rawModules = await this.chainAdapter.fetchModules(
            account
            // network
          )
          const modules = this.chainAdapter.toInternalModules(rawModules)

          fs.writeFileSync(
            path.resolve(srcDir, account + '.json'),
            JSON.stringify(rawModules, null, '\t')
          )
          for (const module of modules) {
            loader.register(module, account)
          }
          const codeGen = new AccountCodegen(
            this,
            loader,
            rawModules,
            modules,
            {
              fileName: account,
              outputDir: outputDir,
              // network,
            }
          )

          outputs.push(...codeGen.generate())
        } catch (e) {
          console.error(
            chalk.red(
              'Error downloading account module, check if you choose the right network，or download account modules manually into your director'
            )
          )
          console.error(e)
          process.exit(1)
        }
      }
    }

    for (const output of outputs) {
      // const content = output.fileContent
      const content = format(output.fileContent, { parser: 'typescript' })
      fs.writeFileSync(path.join(outputDir, output.fileName), content)
    }

    const rootFile = path.join(outputDir, 'index.ts')
    let rootFileContent = `/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
`
    for (const output of outputs) {
      const parsed = path.parse(output.fileName)
      rootFileContent += `export * as _${parsed.name.replaceAll(
        '-',
        '_'
      )} from './${parsed.name}${this.maybeEsmPrefix()}'\n`
    }
    fs.writeFileSync(rootFile, rootFileContent)

    return outputs.length + 1
  }

  // generateNetworkOption(network: NetworkType) {
  //   switch (network) {
  //     case this.TEST_NET:
  //       return 'TEST_NET'
  //   }
  //   return 'MAIN_NET'
  // }

  protected generateModuleExtra(
    module: InternalMoveModule,
    allEventStructs: Map<string, InternalMoveStruct>
    // network: NetworkType
  ) {
    return ''
  }

  generateModule(
    module: InternalMoveModule,
    allEventStructs: Map<string, InternalMoveStruct>
    // network: NetworkType
  ) {
    const qname = moduleQname(module)
    // const functions = this.GENERATE_ON_ENTRY
    //   ? module.exposedFunctions
    //       .map((f) => this.generateForEntryFunctions(module, f))
    //       .filter((s) => s !== '')
    //   : []
    const clientFunctions = this.GENERATE_CLIENT
      ? module.exposedFunctions
          .map((f) => this.generateClientFunctions(module, f))
          .filter((s) => s !== '')
      : []
    const eventStructs = new Map<string, InternalMoveStruct>()
    for (const [type, struct] of allEventStructs.entries()) {
      if (type.startsWith(qname + SPLITTER)) {
        eventStructs.set(type, struct)
      }
    }

    const eventTypes = new Set(eventStructs.keys())
    const events = Array.from(eventStructs.values())
      .map((e) => this.generateForEvents(module, e))
      .filter((s) => s !== '')
    const structs = module.structs.map((s) =>
      this.generateStructs(module, s, eventTypes)
    )
    const callArgs = module.exposedFunctions.map((f) =>
      this.generateCallArgsStructs(module, f)
    )

    const moduleName = normalizeToJSName(module.name)
    let client = ''

    if (clientFunctions.length > 0) {
      client = `
      export class Client extends ModuleClient {
        ${clientFunctions.join('\n')}
      }
      `
    }

    // TODO how to deal with callArgs
    return `
  ${this.generateModuleExtra(module, allEventStructs)}

  export namespace ${moduleName} {
    ${structs.join('\n')}
    
    ${client}
  }
  `
  }

  generateStructs(
    module: InternalMoveModule,
    struct: InternalMoveStruct,
    events: Set<string>,
    typeOnly = false
  ) {
    const typeParams = struct.typeParams || []
    const genericString = this.generateStructTypeParameters(struct)
    const genericStringAny = this.generateStructTypeParameters(struct, true)

    const structName = normalizeToJSName(struct.name)

    const fields = struct.fields.map((field) => {
      const type = this.generateTypeForDescriptor(field.type, module.address)
      return `${field.name}: ${type}`
    })

    const typeParamApplyArg = typeParams
      .map((v, idx) => {
        return `arg${idx}: TypeDescriptor<T${idx}> = ANY_TYPE`
      })
      .join(',')
    const typeParamApply = typeParams
      .map((v, idx) => {
        return `arg${idx}`
      })
      .join(',')

    const typeDescriptor = `
  export namespace ${structName}{
    export const TYPE_QNAME = '${module.address}::${module.name}::${struct.name}'
    
    const TYPE = new TypeDescriptor<${structName}${genericStringAny}>(${structName}.TYPE_QNAME)

    export function type${genericString}(${typeParamApplyArg}): TypeDescriptor<${structName}${genericString}> {
      return TYPE.apply(${typeParamApply})
    }
  }
`
    if (typeOnly) {
      return typeDescriptor
    }

    let eventPayload = ''
    if (events.has(moduleQname(module) + SPLITTER + struct.name)) {
      eventPayload = `
    export interface ${structName}Instance extends
        TypedEventInstance<${structName}${genericStringAny}> {
      ${this.STRUCT_FIELD_NAME}_decoded: ${structName}${genericStringAny}
      type_arguments: [${struct.typeParams.map((_) => 'string').join(', ')}]
    }
    `
    }

    return `
  export interface ${structName}${genericString} {
    ${fields.join('\n')}
  }
  
  ${typeDescriptor}

  ${eventPayload}
  `
  }

  generateFunctionTypeParameters(func: InternalMoveFunction) {
    let genericString = ''
    if (func.typeParams && func.typeParams.length > 0) {
      const params = func.typeParams
        .map((v, idx) => {
          return `T${idx}=any`
        })
        .join(',')
      genericString = `<${params}>`
    }
    return genericString
  }

  generateStructTypeParameters(struct: InternalMoveStruct, useAny = false) {
    let genericString = ''

    if (struct.typeParams && struct.typeParams.length > 0) {
      const params = struct.typeParams
        .map((v, idx) => {
          return useAny ? 'any' : 'T' + idx
        })
        .join(',')
      genericString = `<${params}>`
    }
    return genericString
  }

  generateCallArgsStructs(
    module: InternalMoveModule,
    func: InternalMoveFunction
  ) {
    if (!func.isEntry) {
      return
    }

    const fields = this.chainAdapter
      .getMeaningfulFunctionParams(func.params)
      .map((param) => {
        return (
          this.generateTypeForDescriptor(param, module.address) +
          (this.PAYLOAD_OPTIONAL ? ' | undefined' : '')
        )
      })

    const camelFuncName = upperFirst(camel(func.name))

    const genericString = this.generateFunctionTypeParameters(func)
    return `
  export interface ${camelFuncName}Payload${genericString}
      extends TypedFunctionPayload<[${fields.join(',')}]> {
    arguments_decoded: [${fields.join(',')}],
    type_arguments: [${func.typeParams.map((_) => 'string').join(', ')}]
  }
  `
  }

  generateClientFunctions(
    module: InternalMoveModule,
    func: InternalMoveFunction
  ) {
    if (func.visibility === InternalMoveFunctionVisibility.PRIVATE) {
      return ''
    }
    if (func.isEntry) {
      return ''
    }
    // const moduleName = normalizeToJSName(module.name)
    const funcName = camel(func.name)
    const fields = this.chainAdapter
      .getMeaningfulFunctionParams(func.params)
      .map((param) => {
        return this.generateTypeForDescriptor(param, module.address)
      })
    const genericString = this.generateFunctionTypeParameters(func)

    const returns = func.return.map((param) => {
      return this.generateTypeForDescriptor(param, module.address)
    })

    const source = `
  ${funcName}${genericString}(type_arguments: [${func.typeParams
      .map((_) => 'string')
      .join(', ')}], args: [${fields.join(
      ','
    )}], version?: bigint): Promise<[${returns.join(',')}]> {
    return this.viewDecoded('${module.address}::${module.name}::${
      func.name
    }', type_arguments, args, version) as any
  }`
    return source
  }

  // generateForEntryFunctions(
  //   module: InternalMoveModule,
  //   func: InternalMoveFunction
  // ) {
  //   return ''
  // }

  generateForEvents(
    module: InternalMoveModule,
    struct: InternalMoveStruct
  ): string {
    return ''
  }

  generateTypeForDescriptor(
    type: TypeDescriptor,
    currentAddress: string
  ): string {
    if (type.reference) {
      return this.ADDRESS_TYPE
    }

    switch (type.qname) {
      case 'signer': // TODO check this
      case 'address':
      case 'Address':
        return this.ADDRESS_TYPE
      case '0x1::string::String':
        return 'string'
      case 'bool':
      case 'Bool':
        return 'Boolean'
      case 'u8':
      case 'U8':
      case 'u16':
      case 'U16':
      case 'u32':
      case 'U32':
        return 'number'
      case 'u64':
      case 'U64':
      case 'u128':
      case 'U128':
      case 'u256':
      case 'U256':
        return 'bigint'
    }

    if (type.qname.toLowerCase() === VECTOR_STR) {
      // vector<u8> as hex string
      const elementTypeQname = type.typeArgs[0].qname
      if (elementTypeQname === 'u8') {
        // only for aptos
        return 'string'
      }
      if (
        elementTypeQname.startsWith('T') &&
        !elementTypeQname.includes(SPLITTER)
      ) {
        return `${elementTypeQname}[] | string`
      }
      return (
        this.generateTypeForDescriptor(type.typeArgs[0], currentAddress) + '[]'
      )
    }

    const simpleName = this.generateSimpleType(type.qname, currentAddress)
    if (simpleName.length === 0) {
      console.error('unexpected error')
    }
    if (
      simpleName.toLowerCase() === VECTOR_STR ||
      simpleName.toLowerCase().startsWith(VECTOR_STR + SPLITTER)
    ) {
      console.error('unexpected vector type error')
    }
    if (type.typeArgs.length > 0) {
      // return simpleName
      return (
        simpleName +
        '<' +
        type.typeArgs
          .map((t) => this.generateTypeForDescriptor(t, currentAddress))
          .join(',') +
        '>'
      )
    }
    return simpleName
  }

  generateSimpleType(type: string, currentAddress: string): string {
    const parts = type.split(SPLITTER)

    for (let i = 0; i < parts.length; i++) {
      parts[i] = normalizeToJSName(parts[i])
    }

    if (parts.length < 2) {
      return parts[0]
    }
    if (parts[0] === currentAddress) {
      return parts.slice(1).join('.')
    }
    return '_' + parts.join('.')
  }
}

export class AccountCodegen<NetworkType, ModuleType, StructType> {
  modules: InternalMoveModule[]
  config: Config
  abi: ModuleType[]
  loader: AccountRegister
  moduleGen: AbstractCodegen<ModuleType, StructType>

  constructor(
    moduleGen: AbstractCodegen<ModuleType, StructType>,
    loader: AccountRegister,
    abi: ModuleType[],
    modules: InternalMoveModule[],
    config: Config
  ) {
    // const json = fs.readFileSync(config.srcFile, 'utf-8')
    this.moduleGen = moduleGen
    this.abi = abi
    this.modules = modules
    this.config = config
    this.loader = loader
  }

  generate(): OutputFile[] {
    if (!this.modules) {
      return []
    }
    // const baseName = path.basename(this.config.fileName, '.json')

    let address: string | undefined
    for (const module of this.modules) {
      address = module.address
    }
    if (!address) {
      return []
    }

    const dependedAccounts: string[] = []

    const moduleImports: string[] = []

    const info = this.loader.accountImports.get(address)

    if (info) {
      for (const [account] of info.imports.entries()) {
        // Remap to user's filename if possible, TODO codepath not well tested
        const tsAccountModule =
          './' +
          (this.loader.accountImports.get(account)?.moduleName || account)
        if (isFrameworkAccount(account) && !isFrameworkAccount(address)) {
          // Decide where to find runtime library
          moduleImports.push(
            // `import { _${account} } from "@typemove/${this.moduleGen.PREFIX.toLowerCase()}"`
            `import _${account} = builtin._${account} `
          )
        } else {
          moduleImports.push(
            `import * as _${account} from "${tsAccountModule}${this.moduleGen.maybeEsmPrefix()}"`
          )
        }

        dependedAccounts.push(account)
      }
    }

    let loadAllTypes = `loadAllTypes(defaultMoveCoder())`

    if (this.moduleGen.SYSTEM_MODULES.has(address)) {
      loadAllTypes = `
        loadAllTypes(defaultMoveCoder())
      `
    }

    const eventsMap: Map<string, InternalMoveStruct> =
      this.moduleGen.chainAdapter.getAllEventStructs(this.modules)

    const source = `
    /* Autogenerated file. Do not edit manually. */
    /* tslint:disable */
    /* eslint-disable */

    /* Generated modules for account ${address} */

    ${this.generateImports()}

    ${moduleImports.join('\n')}

    ${this.modules
      .map((m) => this.moduleGen.generateModule(m, eventsMap))
      .join('\n')}

    const MODULES = JSON.parse('${JSON.stringify(this.abi)}')

    export function loadAllTypes(coder: MoveCoder) {
      ${dependedAccounts.map((a) => `_${a}.loadAllTypes(coder)`).join('\n')}
      for (const m of Object.values(MODULES)) {
        coder.load(m as any)
      }
    }

    ${loadAllTypes}
    ` // source

    return [
      {
        fileName: this.config.fileName + '.ts',
        fileContent: source,
      },
    ]
  }

  generateImports() {
    const imports = `
    import { TypeDescriptor, ANY_TYPE } from "@typemove/move"
    import {
      MoveCoder, defaultMoveCoder, TypedEventInstance, builtin } from "@typemove/${this.moduleGen.PREFIX.toLowerCase()}"
    import { ${
      this.moduleGen.ADDRESS_TYPE
    }, ModuleClient } from "@typemove/${this.moduleGen.PREFIX.toLowerCase()}"
    `

    return imports
  }
}
