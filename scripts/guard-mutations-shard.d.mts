/**
 * `guard-mutations-shard.mjs` 의 타입 선언.
 *
 * 왜 필요한가: 조각 분할은 **테스트가 문자열이 아니라 동작을 재도록** 순수 모듈로 뽑은 것이라
 * `src/tests/unit/guard-mutations-shard.test.ts` 가 직접 import 한다. `.mjs` 는 선언이 없어
 * `noImplicitAny` 에 걸리므로(실제로 tsc 가 잡아 커밋을 막았다) 여기서 계약을 명시한다.
 * 형제: `guard-mutations-scope.d.mts` · `guard-mutations-manifest-diff.d.mts`.
 */

/** 주입 1건당 벽시계(초). **GitHub 러너** 실측 역산 — 낮추지 말 것, 로컬 컨테이너 값(2.5~3배 느림)은 쓰지 말 것. */
export declare const SECONDS_PER_INJECTION: number

/** 조각 하나의 목표 벽시계(분). */
export declare const TARGET_SHARD_MINUTES: number

/** 조각 수 상한. 여기에 닿으면 조각이 아니라 주입 자체의 비용을 봐야 한다는 신호다. */
export declare const MAX_SHARDS: number

/** 주입 수 → 조각 계획. `perShard × total ≥ count` 를 보장한다. */
export declare function planShards(count: number): {
  total: number
  perShard: number
  estMinutes: number
}

/**
 * 주입 목록을 조각에 배분한다 — **테스트 파일 단위로 묶어서**(baseline 중복 제거, 실측 −38%).
 * 반환 배열은 `items` 와 같은 길이·순서. 같은 입력이면 항상 같은 결과(결정론).
 */
export declare function assignShards(
  items: { name?: string; test?: string }[],
  total: number,
): number[]

/** `--shard k/n` 파싱. 없으면 null(=전수). 잘못된 값은 **던진다**(조용히 전수로 떨어지지 않게). */
export declare function parseShard(argv: string[]): { index: number; total: number } | null
