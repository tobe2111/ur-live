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

/** 🧰 정비 파이프라인(병합·재추출·재분류·점수·재보정·재조회) 단일화 — 수집 lease 와 별개 키(둘은 동시 실행 OK). */
export const MAINTAIN_LEASE_KEY = 'ads_maintain_lease'
export const MAINTAIN_LEASE_TTL_MS = 15 * 60_000 // 정비 전체(2단계)는 수집 1회보다 길다

/** lease 보유 여부 — **읽기 전용, 절대 lease 를 만지지 않음**. */
export async function isLeaseHeld(DB: D1Database, key: string): Promise<boolean> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(key).first<{ value: string }>().catch(() => null)
  const until = Number(row?.value || 0)
  return Number.isFinite(until) && until > Date.now()
}

/**
 * lease 원자 획득 — 만료시각 CAS(단일 UPDATE = D1 원자). true 면 내가 잡은 것.
 * 획득 실패(false) = 다른 실행이 진행 중 → 호출부는 **아무것도 하지 말고** 그대로 반환할 것.
 */
export async function acquireLease(DB: D1Database, key: string, ttlMs: number): Promise<boolean> {
  await DB.prepare('CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run().catch(() => null)
  await DB.prepare('INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)').bind(key, '0').run().catch(() => null)
  const now = Date.now()
  const r = await DB.prepare('UPDATE platform_settings SET value = ? WHERE key = ? AND CAST(value AS INTEGER) < ?')
    .bind(String(now + ttlMs), key, now).run().catch(() => null)
  return r?.meta?.changes === 1
}

/**
 * 🪦 획득 + **직전 실행이 유기됐는지** 동시 판정 (2026-07-29).
 *
 *   정상 종료는 lease 를 `'0'` 으로 반납한다. 인보케이션이 통째로 사라지면(서브리퀘스트 한도 등) 반납이
 *   없어 만료된 타임스탬프가 남는다 — **말없이 죽었다는 유일한 흔적**이다. 죽은 회차는 아무것도 못 남기므로
 *   그 사실은 다음 회차가 대신 읽어야 한다(예산 상한 하향의 트리거 — `capAfterAbandonedRun` 참조).
 *
 *   seed 와 직전값 읽기를 **1 batch(=1 서브리퀘스트)** 로 묶어 `acquireLease` 대비 추가 비용 0.
 *   ⚠️ `abandoned` 는 **CAS 를 이겼을 때만** 참이다 — 졌으면 그 값은 살아 있는 실행의 것이지 시체가 아니다.
 *   ⚠️ 오탐: 한 회차가 TTL 보다 오래 정상 실행되면 다음 회차가 유기로 오독한다(안전한 방향의 오차).
 */
export async function acquireLeaseDetect(DB: D1Database, key: string, ttlMs: number): Promise<{ acquired: boolean; abandoned: boolean }> {
  await DB.prepare('CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run().catch(() => null)
  const seed = await DB.batch<{ value: string }>([
    DB.prepare('INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)').bind(key, '0'),
    DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key),
  ]).catch(() => null)
  const prior = parseInt(String(seed?.[1]?.results?.[0]?.value ?? '0'), 10) || 0
  const now = Date.now()
  const r = await DB.prepare('UPDATE platform_settings SET value = ? WHERE key = ? AND CAST(value AS INTEGER) < ?')
    .bind(String(now + ttlMs), key, now).run().catch(() => null)
  const acquired = r?.meta?.changes === 1
  return { acquired, abandoned: acquired && prior > 0 }
}

/** lease 해제 — 반드시 finally 에서(크래시 시엔 TTL 만료가 백스톱). */
export async function releaseLease(DB: D1Database, key: string): Promise<void> {
  await DB.prepare("UPDATE platform_settings SET value = '0' WHERE key = ?").bind(key).run().catch(() => null)
}

/**
 * 지금 수집 실행이 진행 중인가 — self-chain 홉 사이의 짧은 공백(수십 ms)에는 false 가 나올 수 있으므로,
 * 호출부는 단발 판정이 아니라 연속 관측으로 종료를 판단할 것(useCollectRun 의 IDLE_STOP).
 */
export const isCollectRunning = (DB: D1Database) => isLeaseHeld(DB, COLLECT_LEASE_KEY)
/** 지금 정비 파이프라인이 진행 중인가. */
export const isMaintainRunning = (DB: D1Database) => isLeaseHeld(DB, MAINTAIN_LEASE_KEY)
