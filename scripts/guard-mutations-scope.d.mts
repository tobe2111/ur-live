/**
 * `guard-mutations-scope.mjs` 의 타입 선언.
 *
 * 왜 필요한가: 이 판정은 **테스트가 문자열이 아니라 동작을 재도록** 순수 모듈로 뽑은 것이라
 * `src/tests/unit/guard-mutations-scope.test.ts` 가 직접 import 한다. `.mjs` 는 선언이 없어
 * `noImplicitAny` 에 걸리므로(실제로 tsc 가 잡았다) 여기서 계약을 명시한다.
 */
export declare const ALWAYS_FULL: string[]

/** 바뀐 파일 집합 → 전수로 돌 사유(좁혀도 되면 null). */
export declare function fullReasonFor(files: Set<string> | string[] | null | undefined): string | null

export interface MutationRef { file: string; test: string }
export type Scope = { full: true; why?: string } | { full: false; files: Set<string> }

/** 주입 하나가 이 스코프에 드는가. */
export declare function inScope(m: MutationRef, scope: Scope): boolean

/** git 을 불러 스코프를 정한다. 실패하면 전수로 폴백. `run` 은 `git <args>` 의 stdout. */
export declare function changedScope(o: {
  enabled: boolean
  run: (args: string[]) => string
  baseRef?: string
}): Scope
