/**
 * 🧩 2026-11-18 서버(워커) 타입 검사 전용 전역 선언 — `tsconfig.worker.json` 이 읽는다.
 *
 * 📁 `src/` 밖에 두는 이유: 브라우저 검사(`tsconfig.json`, include `src/**`)가 이 파일을 읽으면 DOM 의 `window` 등과 겹친다.
 *
 * 1) **nodejs_compat**(`wrangler.toml` compatibility_flags) 로 실제로 있는 것: `process` · `Buffer`.
 *    `@types/node` 를 통째로 넣으면 workers-types 와 fetch/Request 정의가 부딪힌다 — 쓰는 모양만 선언한다.
 * 2) **서버·브라우저 공용 코드**(src/shared · src/lib 일부)가 `typeof document !== 'undefined'` 처럼 확인하고 쓰는
 *    브라우저 전역: 서버에서는 **없을 수 있다**. 정식 타입 검사는 브라우저 쪽(`tsconfig.json`, DOM 포함)이 한다 —
 *    여기서는 "이름이 없다" 로 서버 검사가 멎지 않게만 한다. ⚠️ 서버 전용 코드(src/worker)에서 이것들을 쓰지 말 것.
 */
declare const process: { env: Record<string, string | undefined> }
declare const Buffer: {
  from(input: string | ArrayBuffer | ArrayLike<number>, encoding?: string): { toString(encoding?: string): string; length: number }
  byteLength(input: string, encoding?: string): number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const window: any
declare const document: any
declare const localStorage: any
declare const sessionStorage: any
declare const navigator: any
declare const Node: any
type Node = any
type HTMLImageElement = any
declare const requestAnimationFrame: any
declare const cancelAnimationFrame: any
declare const getComputedStyle: any
