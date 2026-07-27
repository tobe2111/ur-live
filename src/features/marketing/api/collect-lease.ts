/**
 * 🔒 수집 실행 단일화 lease — **키/판정만** 담은 초경량 모듈.
 *
 *   lease 획득·해제는 `influencer-auto-collect.ts`(수집 엔진, ur-ads 전용) 안에서만 한다.
 *   그런데 "지금 돌고 있나?" 는 **메인 워커의 어드민 API** 도 알아야 한다(진행 중 표시 · 중복 클릭 안내).
 *   수집 엔진을 메인에 import 하면 유튜브/네이버 수집 코드가 통째로 메인 번들에 딸려온다
 *   (admin-ads-influencers.routes.ts 가 "수집 코드 import 금지, inline SQL 만" 을 지키는 이유).
 *   ⇒ 키 상수와 읽기 전용 판정만 여기로 분리해 **양쪽이 같은 SSOT 를 공유**하되 무게는 0.
 */

/** 값 = 만료시각(ms). CAS 조건부 UPDATE 로 원자 획득 — 문자열 비교가 아니라 CAST(value AS INTEGER). */
export const COLLECT_LEASE_KEY = 'ads_collect_lease'
/** 한 실행 최장 예상(수십 초) 대비 여유 — 크래시로 해제를 못 해도 이 시간 뒤 자동 만료. */
export const COLLECT_LEASE_TTL_MS = 5 * 60_000

/**
 * 지금 수집 실행이 진행 중인가(lease 만료시각이 미래인가) — **읽기 전용, 절대 lease 를 만지지 않음**.
 * self-chain 홉 사이의 짧은 공백(수십 ms)에는 false 가 나올 수 있으므로,
 * 호출부는 단발 판정이 아니라 연속 관측으로 종료를 판단할 것(useCollectRun 의 IDLE_STOP).
 */
export async function isCollectRunning(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare(`SELECT value FROM platform_settings WHERE key = '${COLLECT_LEASE_KEY}'`)
    .first<{ value: string }>().catch(() => null)
  const until = Number(row?.value || 0)
  return Number.isFinite(until) && until > Date.now()
}
