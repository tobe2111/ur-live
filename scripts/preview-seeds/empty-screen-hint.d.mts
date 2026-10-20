/**
 * `empty-screen-hint.mjs` 의 타입 선언.
 * 테스트(`src/tests/unit/phone-audit-empty-hint.test.ts`)가 직접 import 하므로
 * `noImplicitAny` 를 위해 필요하다. 형제: `seller-lists.d.mts` · `../guard-mutations-shard.d.mts`.
 */

/** 빈 상태·오류 화면의 말투. 맨 `없습니다` 는 들어가지 않는다(안내 문장에 걸린다). */
export declare const EMPTY_HINT: RegExp

/** 잴 내용이 없었는가(🟡 판정 보류). 말투 + `firstScreen < 8` 안전판. */
export declare function looksEmpty(bodyText: string, firstScreenLines: number): boolean

/** 무엇 때문에 🟡 인지 — 걸린 자리의 앞뒤 조각(안 걸렸으면 ''). */
export declare function emptyHintMatch(bodyText: string): string
