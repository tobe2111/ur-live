export const NEAR_LINES: number
export function parseHunks(diff: string): Map<string, Array<[number, number]>>
export function pickNearEdits(x: {
  mutations: Array<{ name: string; file: string; find: string; test: string }>
  files: Set<string>
  hunks: Map<string, Array<[number, number]>>
  readSrc: (file: string) => string | null
  near?: number
}): Set<string>
