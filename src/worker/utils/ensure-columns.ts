/**
 * 🧱 "이 테이블에 이미 있는 컬럼" — D1 에는 `ADD COLUMN IF NOT EXISTS` 가 없어서 필요하다.
 *
 * 2026-09-17 (대표 *"내 이용권이 너무 늦게 떠. 로딩이 느려."*).
 *
 * ## 왜 있나
 * 이 레포의 self-heal 보정들은 마이그레이션이 안 돈 환경을 위해 `ALTER TABLE … ADD COLUMN` 을 던진다.
 * 그런데 **이미 있는 컬럼에 던지면 실패하고, 실패도 왕복이다.** 라이브 실측(2026-09-17):
 * `group-buy/api/helpers.ts` 의 `ensureTables` 가 던지던 **20개가 전부 이미 존재**해 100% 실패했고,
 * 셀러 홈의 이용권 목록은 그 20 왕복을 다 기다린 뒤에야 자기 쿼리를 시작했다 — 에러가 없어 안 보였다.
 *
 * `supply/api/supply-visibility.ts` 는 진작부터 이 방식을 손으로 쓰고 있었다. 여기로 모은다.
 *
 * ## ⚠️ 못 읽으면 "전부 없다" 로 떨어진다
 * PRAGMA 가 실패하거나 테이블이 없으면 **빈 집합**을 준다 = 호출부가 전부 시도한다 = 종전 동작.
 * 반대로(못 읽었는데 "다 있다"로) 떨어지면 **새 D1 이 조용히 안 고쳐져** self-heal 이 죽는다.
 */
import type { D1Database } from '@cloudflare/workers-types'

/**
 * @param table 코드 상수만 넘긴다(사용자 입력 금지 — 보간 자리다).
 * @returns 이미 있는 컬럼 이름. 못 읽으면 빈 집합.
 */
export async function existingColumns(DB: D1Database, table: string): Promise<Set<string>> {
  const r = await DB.prepare(`SELECT name FROM pragma_table_info('${table}')`)
    .all<{ name: string }>()
    .catch(() => ({ results: [] as { name: string }[] }))
  return new Set((r.results || []).map((x) => x.name))
}

/** `'group_buy_target INTEGER DEFAULT 0'` → `'group_buy_target'`. 정의 첫 토큰이 이름이다. */
export function columnNameOf(def: string): string {
  return def.trim().split(/\s+/)[0]
}
