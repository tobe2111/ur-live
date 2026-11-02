/** 타입 선언 — 구현·근거는 i18n-split.mjs. */
type Dict = Record<string, unknown>
type Refs = { exact: Set<string>; prefixes: Set<string> }
export const DASH_NAMESPACES: string[]
export const KO_DEFAULT_ONLY_NS: string[]
export function isDashOnlyFile(rel: string): boolean
export function collectConsumerDashKeys(root: string): Refs
export function collectReferencedKeys(root: string): Refs
export function splitTranslation(obj: Dict, used: Refs, refs?: Refs): { core: Dict; dash: Dict; rest: Dict }
export function collectDefaultValueUses(root: string): { literal: Map<string, number>; dv: Map<string, string[]>; prefixes: Set<string> }
export function koDefaultOnlyKeys(koObj: Dict, uses: { literal: Map<string, number>; dv: Map<string, string[]>; prefixes: Set<string> }): string[]
export function moveKeysToRest<T extends { core: Dict; dash: Dict; rest: Dict }>(parts: T, keys: string[]): T
export function i18nSplitPlugin(root: string): { name: string; enforce: 'pre'; buildStart(): void; transform(code: string, id: string): { code: string; map: null } | null }
