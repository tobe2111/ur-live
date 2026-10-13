/** 타입 선언 — 구현·근거는 lucide-deep-imports.mjs. */
export function buildLucideIconMap(barrelSource: string): Map<string, string>
export function rewriteLucideImports(code: string, iconMap: Map<string, string>): string | null
export function lucideDeepImportsPlugin(): { name: string; enforce: 'pre'; transform(code: string, id: string): { code: string; map: null } | null }
