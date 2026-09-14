/**
 * `local-ci-parity.mjs` 의 타입 선언.
 *
 * 스크립트는 CI·훅에서 `node` 로 직접 돌아야 해서 `.mjs` 로 둔다. 그런데 유닛 테스트가
 * 그걸 import 하면 값이 전부 `any`/`unknown` 이 되어 tsc 가 막는다(2026-09-14 실측 —
 * pre-commit 이 TS7006/TS18046 로 커밋을 차단했다). 그래서 선언만 따로 둔다.
 */
/** `verify.yml` 에서 "실패하면 CI 가 막는" 가드 스크립트 이름을 뽑는다. */
export function ciStrictGuards(ymlPath?: string): string[]

/** 로컬 푸시 게이트가 실제로 돌릴 목록 (= strict − EXCLUDE). */
export function localGateGuards(ymlPath?: string): string[]

/** CI 는 막지만 로컬 푸시 게이트에서는 빼는 가드 → 그 사유. 값이 비면 가드가 빨간불. */
export const EXCLUDE: Record<string, string>
