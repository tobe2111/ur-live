/**
 * `guard-mutations-shard.mjs` 의 타입 선언.
 *
 * 왜 필요한가: 조각 분할은 **테스트가 문자열이 아니라 동작을 재도록** 순수 모듈로 뽑은 것이라
 * `src/tests/unit/guard-mutations-shard.test.ts` 가 직접 import 한다. `.mjs` 는 선언이 없어
 * `noImplicitAny` 에 걸리므로(실제로 tsc 가 잡아 커밋을 막았다) 여기서 계약을 명시한다.
 * 형제: `guard-mutations-scope.d.mts` · `guard-mutations-manifest-diff.d.mts`.
 */

/** 주입 1건당 벽시계(초). 야간 실측 역산 — 낮추지 말 것(낮추면 조각이 줄어 벽시계가 는다). */
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

/** 주입 `i` 번째가 어느 조각인가(색인 나머지 분배 — 조각 크기 차 ≤ 1). */
export declare function shardOf(i: number, total: number): number

/** `--shard k/n` 파싱. 없으면 null(=전수). 잘못된 값은 **던진다**(조용히 전수로 떨어지지 않게). */
export declare function parseShard(argv: string[]): { index: number; total: number } | null
