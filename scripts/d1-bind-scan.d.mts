/** 타입 선언 — 시험이 `d1-bind-scan.mjs` 를 import 할 때 implicit any 를 막는다. */
export declare const PH_RE: RegExp
export declare const SSOT_RE: RegExp
export declare const OK_RE: RegExp
export declare const CTX_LINES: number
export declare function countBindSites(
  files: readonly string[],
  read: (f: string) => string,
): Record<string, number>
export declare function totalOf(counts: Record<string, number>): number
export declare function diffAgainst(
  counts: Record<string, number>,
  prev: Record<string, number>,
): { grew: Array<{ file: string; from: number; to: number }>; shrank: Array<{ file: string; from: number; to: number }> }
