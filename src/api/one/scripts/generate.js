const fs = require('fs')
const util = require('util')
const glob = require('glob')
const globAsync = util.promisify(glob)
const path = require('path')
const prettier = require('prettier')
const prettierRC = require('../../../../prettier.config')
prettierRC['parser'] = 'typescript'
const { pascalCase, camelCase } = require('change-case')

const msg = `
/**
 * Copyright 2020 jhaemin
 *
 * Refresh One API Schemas & Functions
 *
 * This file is automatically generated
 * by the script "generate".
 * Do not modify this file manually.
 * If there comes a situation where this file
 * should move to other place,
 * please update the source "dev/generate.js".
 */
`

/**
 * @param {string} fTSPath
 */
function getPascalName(fTSPath) {
  const fileName = path.parse(fTSPath).name.replace(/\.f$/g, '')
  const pascal = pascalCase(fileName)

  return pascal
}

/**
 * @param {string} fTSPath
 */
function importType(fTSPath) {
  const pathWithoutExt = fTSPath.replace(/\.f\.ts$/g, '')
  const schemaInterface = getPascalName(fTSPath)

  return `import { ${schemaInterface} } from '${pathWithoutExt}'
export { ${schemaInterface} } from '${pathWithoutExt}'`
}

/**
 * @param {string} fTSPath
 */
function exportFunction(fTSPath) {
  const pathWithoutExt = fTSPath.replace(/\.ts$/g, '')
  const fileName = path.parse(fTSPath).name.replace(/\.f$/g, '')
  const funcName = camelCase(fileName)

  return `export { ${funcName} } from '${pathWithoutExt}'`
}

;(async () => {
  // New method interfaces
  const interfacesPaths = (
    await globAsync('actions/**/*.action/interface.ts')
  ).map((path) => path.replace(/^actions/g, '.'))
  let interfacesNames = []
  let importStmts = []
  interfacesPaths.forEach((path) => {
    const name = pascalCase(/([a-z-]*)\.action\/interface.ts$/g.exec(path)[1])
    interfacesNames.push(name)
    const pathWithoutExt = path.replace(/\.ts$/g, '')
    const stmt = `import { Action as ${name}Raw } from '${pathWithoutExt}'
export type ${name} = ${name}Raw & { action: '${camelCase(name)}' }
`
    importStmts.push(stmt)
  })

  // New method functions
  const newFuncExports = (
    await globAsync('actions/**/*.action/function.ts')
  ).map((path) => {
    return `export { default as ${camelCase(
      /([a-z-]*)\.action\/function.ts$/g.exec(path)[1]
    )} } from '${path.replace(/^actions/g, '.').replace(/\.ts$/g, '')}'`
  })

  /*********************************************************
   *                                                       *
   * Legacy method using [api-name].ts and [api-name].f.ts *
   *                                                       *
   *********************************************************/

  let legacyFTSFiles = await globAsync('actions/**/*.f.ts')
  legacyFTSFiles = legacyFTSFiles.map((file) => file.replace(/^actions/g, '.'))

  // Interfaces
  const interfaceImports = legacyFTSFiles
    .map((file) => importType(file))
    .concat(importStmts)
    .join('\n')
  const OneApiActionMix = `export type OneApiAction = ${legacyFTSFiles
    .map((file) => getPascalName(file))
    .concat(interfacesNames)
    .join(' | ')}
`
  const interfaceFile = prettier.format(
    `${msg}

${interfaceImports}
`,
    prettierRC
  )

  fs.writeFileSync('./actions/index.ts', interfaceFile)

  // Functions
  const functionExports = legacyFTSFiles
    .map((file) => exportFunction(file))
    .concat(newFuncExports)
    .join('\n')
  const functionExportFile = prettier.format(
    `${msg}

${functionExports}
`,
    prettierRC
  )

  fs.writeFileSync('./actions/functions.ts', functionExportFile)

  /**
   * Client auto import interfaces for function overloadings
   */
  const allInterfacesNames = legacyFTSFiles
    .map((file) => getPascalName(file))
    .concat(interfacesNames) // Combine legacy interface names and new interface.ts
  // !!! Insert 'OneApiAction' at the beginning for regular expression matching
  const clientImportStatements = `import {${[...allInterfacesNames.sort()].join(
    ','
  )}} from '../actions'`
  let clientSource = fs.readFileSync('client/index.ts', 'utf8')
  clientSource = clientSource.replace(
    /import {[\s\S]*?} from '\.\.\/actions'/g,
    clientImportStatements
  )
  const clientSourceSplitted = clientSource.split('\n')
  const overloadingBegin = clientSourceSplitted.indexOf(
    '// ** AUTOMATICALLY GENERATED FUNCTION OVERLOADINGS, DO NOT MODIFY HERE MANUALLY **'
  )
  if (overloadingBegin === -1) {
    throw new Error(
      'Could not find eodiro client function overloading beginning line'
    )
  }
  const overloadingEnd = clientSourceSplitted.indexOf(
    '// ** AUTOMATICALLY GENERATED FUNCTION OVERLOADINGS, DO NOT MODIFY HERE MANUALLY **',
    overloadingBegin + 1
  )
  if (overloadingEnd === -1) {
    throw new Error(
      'Could not find eodiro client function overloading ending line'
    )
  }

  // Generate overloading functions
  const overloadings = allInterfacesNames.map(
    (interfaceName) =>
      `export async function oneApiClient(host: string, request: Omit<${interfaceName}, 'payload'>): Promise<${interfaceName}['payload']>`
  )

  // Remove old overloadings
  const overloadingLinesCount = overloadingEnd - overloadingBegin - 1
  clientSourceSplitted.splice(
    overloadingBegin + 1,
    overloadingLinesCount,
    ...overloadings
  )

  const newClientSource = prettier.format(
    clientSourceSplitted.join('\n'),
    prettierRC
  )

  // Save the file
  fs.writeFileSync('client/index.ts', newClientSource, 'utf8')
})()
