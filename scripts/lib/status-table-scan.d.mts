/**
 * 🚦 `status-table-scan.mjs` 의 타입 — 유닛시험이 이 모듈을 **직접 돌려** 판정을 재기 때문에
 *   선언이 필요하다(`allowJs` 가 꺼져 있어 `.mjs` 는 암묵 any 가 된다).
 */
export declare const NEUTRALIZED: string
export declare const HUE: RegExp
export declare const MAX_OBJ: number
export declare function objectLiterals(src: string): string[]
export declare function violations(src: string): number
export declare const FIXTURES: Record<string, { src: string; expect: number }>
