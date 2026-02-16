import * as fs from 'fs'
import * as path from 'path'

const sourceDir = path.resolve('../sui/src')
const targetDir = path.resolve('src')

function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (fullPath.includes('builtin')) {
        return
      }
      if (fullPath.includes('types')) {
        return
      }
      walkDir(fullPath, callback)
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      callback(fullPath)
    }
  })
}

function ensureDirExist(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function copyAndReplace(filePath: string) {
  const blacklist = new Set<string>([
    'run.ts',
    'tests/move-call.test.ts',
    'tests/move-coder.test.ts',
    'move-coder.test.ts'
  ])

  const relativePath = path.relative(sourceDir, filePath)
  const targetPath = path.join(targetDir, relativePath)

  if (blacklist.has(relativePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  let replacedContent = content
  replacedContent = replacedContent.replaceAll('@typemove/sui', '@typemove/iota')
  replacedContent = replacedContent.replaceAll('@mysten/sui', '@iota/iota-sdk')
  replacedContent = replacedContent.replaceAll('Sui', 'Iota')
  replacedContent = replacedContent.replaceAll('sui_', 'iota_')
  replacedContent = replacedContent.replaceAll('https://fullnode.mainnet.sui.io', 'https://api.mainnet.iota.cafe')
  replacedContent = replacedContent.replaceAll('https://fullnode.testnet.sui.io', 'https://api.testnet.iota.cafe')

  ensureDirExist(path.dirname(targetPath))
  fs.writeFileSync(targetPath, replacedContent, 'utf-8')
  console.log(`Copied and transformed: ${relativePath}`)
}

walkDir(sourceDir, copyAndReplace)
