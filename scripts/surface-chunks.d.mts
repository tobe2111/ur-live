/** 타입 선언 — 구현·근거는 surface-chunks.mjs. */
export interface ChunkMeta {
  getModuleIds(): IterableIterator<string>
  getModuleInfo(id: string): { isEntry?: boolean; importedIds: readonly string[]; code?: string | null } | null
}
export function createSurfaceChunker(opts: {
  routes: Record<string, string[]>
  root: string
  commonMin?: number
  minGroupBytes?: number
}): (id: string, name: string | undefined, meta: ChunkMeta) => string | undefined
