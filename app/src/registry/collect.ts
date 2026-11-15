// Pure checks and pairing used by the registry at runtime and by the build check in
// build/registryCheck.ts. No imports from the app, so Node can load it during the build.

export type RegistryKind = 'screens' | 'games'

export type FolderId = { folder: string; id: string | undefined }

/** Folder name from a path like `../screens/<folder>/meta.ts` or `src/games/<folder>/meta.ts`. */
export function folderFromPath(path: string): string {
  const parts = path.split(/[\\/]/)
  const folder = parts[parts.length - 2]
  if (!folder) throw new Error(`Registry: cannot read a folder name from "${path}".`)
  return folder
}

/** Throws one clear message for the first problem found. Collisions are reported before mismatches. */
export function validateIds(kind: RegistryKind, entries: FolderId[]): void {
  const seen = new Map<string, string>()
  for (const { folder, id } of entries) {
    if (id === undefined) continue
    const other = seen.get(id)
    if (other !== undefined) {
      throw new Error(
        `Registry: ${kind}/${other}/meta.ts and ${kind}/${folder}/meta.ts both use the id "${id}". Every id must be unique.`,
      )
    }
    seen.set(id, folder)
  }
  for (const { folder, id } of entries) {
    if (id === undefined || id === '') {
      throw new Error(
        `Registry: ${kind}/${folder}/meta.ts must export \`meta\` with a text \`id\`.`,
      )
    }
    if (id !== folder) {
      throw new Error(
        `Registry: ${kind}/${folder}/meta.ts has id "${id}" but its folder is "${folder}". The id must equal the folder name.`,
      )
    }
  }
}

export type Loader<T> = () => Promise<T>

export type Collected<M, C> = { metas: M[]; loaders: Map<string, Loader<C>> }

/**
 * Pairs every `meta.ts` module with the `index.tsx` loader in the same folder, after validating ids.
 * Keys are the file paths produced by `import.meta.glob`.
 */
export function collect<M extends { id: string }, C>(
  kind: RegistryKind,
  metaModules: Record<string, { meta?: M }>,
  componentLoaders: Record<string, Loader<C>>,
): Collected<M, C> {
  const entries = Object.entries(metaModules).map(([path, mod]) => ({
    path,
    folder: folderFromPath(path),
    meta: mod.meta,
  }))
  validateIds(
    kind,
    entries.map(({ folder, meta }) => ({ folder, id: meta?.id })),
  )

  const byFolder = new Map<string, Loader<C>>()
  for (const [path, loader] of Object.entries(componentLoaders)) {
    byFolder.set(folderFromPath(path), loader)
  }

  const metas: M[] = []
  const loaders = new Map<string, Loader<C>>()
  for (const { folder, meta } of entries) {
    if (!meta) continue
    const loader = byFolder.get(folder)
    if (!loader) {
      throw new Error(`Registry: ${kind}/${folder}/ has a meta.ts but no index.tsx.`)
    }
    metas.push(meta)
    loaders.set(meta.id, loader)
  }
  return { metas, loaders }
}
