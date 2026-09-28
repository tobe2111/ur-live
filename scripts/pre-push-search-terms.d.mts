/**
 * `pre-push-search-terms.mjs` 의 타입 선언.
 *
 * 왜 필요한가: 이 함수는 **테스트가 문자열이 아니라 동작을 재도록** 순수 모듈로 뽑은 것이라
 * `src/tests/unit/pre-push-search-terms-2026-09-28.test.ts` 가 직접 import 한다. `.mjs` 는
 * 선언이 없어 `noImplicitAny`(TS7016)에 걸리므로(실제로 pre-commit 의 tsc 가 잡았다)
 * 여기서 계약을 명시한다 — `guard-mutations-scope.d.mts` 와 같은 처방.
 */

/** 가드가 본문에 *폴더*를 들고 있는 영역 — 여기만 폴더로 매칭한다. */
export declare const DIR_MATCHED: string[]

/**
 * 바뀐 파일 경로들 → pre-push 그물이 시험 본문에서 찾을 **검색어**(중복 제거).
 *
 * `src/` 는 파일 경로 그대로, non-src 는 담긴 폴더(**끝 슬래시 없이**), 루트 파일은 그대로.
 */
export declare function searchTermsFor(files: string[]): string[]
