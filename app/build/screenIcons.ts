import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:screen-icons'
const RESOLVED_ID = '\0' + VIRTUAL_ID
const ICON_PATTERN = /\bicon\s*:\s*['"`]([a-z0-9-]+)['"`]/

function iconNames(srcDir: string): string[] {
  const names = new Set<string>()
  for (const kind of ['screens', 'games']) {
    const dir = join(srcDir, kind)
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name, 'meta.ts')
      if (!entry.isDirectory() || !existsSync(file)) continue
      const match = ICON_PATTERN.exec(readFileSync(file, 'utf8'))
      if (match?.[1]) names.add(match[1])
    }
  }
  return [...names].sort()
}

/**
 * `virtual:screen-icons` maps each icon name used in a screens/ or games/ meta.ts to its lucide
 * component, so the sidebar bundles only the icons it shows. Rebuilt when a meta.ts changes.
 */
export function screenIcons(srcDir: string, lucideIconsDir: string): Plugin {
  return {
    name: 'ophiuchus-screen-icons',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined
      const names = iconNames(srcDir).filter((name) =>
        existsSync(join(lucideIconsDir, `${name}.mjs`)),
      )
      const imports = names.map((name, i) => `import I${i} from 'lucide-react/icons/${name}'`)
      const entries = names.map((name, i) => `  ${JSON.stringify(name)}: I${i},`)
      return `${imports.join('\n')}\nexport default {\n${entries.join('\n')}\n}\n`
    },
    configureServer(server) {
      const refresh = (file: string) => {
        if (!/[\\/](screens|games)[\\/][^\\/]+[\\/]meta\.ts$/.test(file)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) void server.reloadModule(mod)
      }
      server.watcher.on('add', refresh)
      server.watcher.on('change', refresh)
      server.watcher.on('unlink', refresh)
    },
  }
}
