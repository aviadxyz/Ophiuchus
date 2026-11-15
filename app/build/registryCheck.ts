import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { validateIds, type RegistryKind } from '../src/registry/collect.ts'

const ID_PATTERN = /\bid\s*:\s*['"`]([^'"`]*)['"`]/

function readIds(srcDir: string, kind: RegistryKind) {
  const dir = join(srcDir, kind)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'meta.ts')))
    .map((entry) => {
      const source = readFileSync(join(dir, entry.name, 'meta.ts'), 'utf8')
      const match = ID_PATTERN.exec(source)
      if (!match) {
        throw new Error(
          `Registry: ${kind}/${entry.name}/meta.ts must declare \`id\` as a plain text value, for example id: '${entry.name}'.`,
        )
      }
      return { folder: entry.name, id: match[1] }
    })
}

/** Fails the build when a screen or game meta id does not match its folder, or two ids collide. */
export function registryCheck(srcDir: string): Plugin {
  const check = () => {
    validateIds('screens', readIds(srcDir, 'screens'))
    validateIds('games', readIds(srcDir, 'games'))
  }
  return {
    name: 'ophiuchus-registry-check',
    buildStart() {
      check()
    },
    handleHotUpdate({ file, server }) {
      if (!/[\\/](screens|games)[\\/][^\\/]+[\\/]meta\.ts$/.test(file)) return
      try {
        check()
      } catch (error) {
        server.config.logger.error(error instanceof Error ? error.message : String(error))
      }
    },
  }
}
