/** 타입 선언 — 구현·근거는 check-chunk-cycles.mjs. */
export function findChunkCycles(assetsDir: string): { cycles: string[][]; chunks: number }
