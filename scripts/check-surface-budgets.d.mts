/** 타입 선언 — 구현·근거는 check-surface-budgets.mjs. */
export const TOLERANCE_KB: number
export const LOCK_SLACK_KB: number
export function brKB(buf: Buffer): number
export function surfacesFrom(html: string, mapSrc: string): {
  surfaces: Record<string, string[]>; bootCount: number; cssCount: number; mapCount: number
}
type M = Record<string, { totalKB: number; chunks: Record<string, number> }>
export function judge(measured: M, baseline: { surfaces?: M }, opts?: { tolerance?: number; slack?: number }):
  Array<{ s: string; kind: 'new' | 'grew' | 'slack' | 'gone'; msg: string }>
export function dashboardSurfacesFrom(
  manifest: Record<string, { file: string; name?: string; src?: string; isDynamicEntry?: boolean; imports?: string[]; css?: string[] }>,
  bootFiles: string[],
  cssFiles: string[],
  dashboards: Record<string, string[]>,
): Record<string, string[]>
type Manifest = Record<string, { file: string; name?: string; src?: string; isDynamicEntry?: boolean; imports?: string[]; css?: string[] }>
export function routeSurfacesFrom(manifest: Manifest, bootFiles: string[], cssFiles: string[], routes: Record<string, string[]>): Record<string, string[]>
export function closureSurfacesFrom(manifest: Manifest, bootFiles: string[], cssFiles: string[], table: Record<string, string[]>, prefix: string): Record<string, string[]>
export function mapSubsetErrors(mapSurfaces: Record<string, string[]>, closureSurfaces: Record<string, string[]>): string[]
type Doc = { _doc: string; toleranceKB: number; lockSlackKB: number; surfaces: M; history: unknown[] }
export function nextBaselineDoc(
  measured: M,
  baseline: { surfaces?: M; history?: unknown[] },
  errs: Array<{ s: string; kind: string; msg: string }>,
  opts?: { reason?: string; date?: string; all?: boolean },
): { doc: Doc; entry: { date?: string; reason: string; surfaces: string[]; changes: string[] } | null }
export function historyFileName(entry: { date?: string; surfaces: string[] }, exists: (name: string) => boolean): string
