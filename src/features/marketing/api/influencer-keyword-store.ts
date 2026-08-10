/**
 * 🗂️ 발굴 **키워드 테이블 저장소** — `influencer-auto-collect.ts` 에서 추출 (2026-07-29, 600줄 캡).
 *
 *   수집 엔진 파일은 여러 세션이 계속 블록을 얹는 자리다(저장 → `influencer-save.ts`,
 *   설정 → `influencer-settings.ts`, 시드 → `influencer-seed-keywords.ts` 에 이어 네 번째 분리).
 *   키워드 *테이블의 수명주기*(스키마·시드·목록·추가/토글·1회성 복구)는 그 자체로 하나의 관심사라
 *   여기가 제자리다. 동작은 이전과 동일(로직 이동만) — 호출부 호환은 원 파일의 재수출이 유지한다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { runDdlOnce, ddlChecksum } from './ads-schema-guard'
import { SEED, REGION_SEED, BANGBAE_SEED } from './influencer-seed-keywords'
// 🧱 DDL 은 **한 벌만** — 아래 `runDdlOnce` 키(`ads_ddl_discovery_keywords`)를 이 파일과
//   `influencer-auto-collect` 가 **공유**하는데, 각자 KW_DDL 을 들고 있었다. 내용이 같아 오늘은 무해했지만
//   한쪽만 고치는 순간 체크섬이 매 인보케이션 엇갈려 **DDL + 시드 200문장이 영원히 재실행**된다
//   (그 재실행을 없애려고 2026-07-29 에 만든 최적화가 통째로 뒤집힌다).
import { KW_DDL } from './influencer-keyword-ddl'

export interface DiscoveryKeyword { id: number; keyword: string; category: string | null; active: number; hits: number; source: string; created_at: string }

const _kwSchemaPromise = new WeakMap<D1Database, Promise<void>>()

/**
 * 키워드 테이블 보장 + 시드(멱등 INSERT OR IGNORE).
 *
 * 🧱 2026-07-29 — **매 인보케이션 7 쿼리 → 1 쿼리**. D1 호출도 서브리퀘스트 한도에 포함되는데(#784),
 *   이 함수는 CREATE 1 + ALTER 6 + 시드 batch 1 을 *매시간 영원히* 재실행하고 있었다. 몇 달 전에 만들어진
 *   테이블에 대한 no-op 이 발굴 fetch 예산을 먹은 것이다 — `ensureInfluencerSchema` 가 이미 같은 이유로
 *   `runDdlOnce` 로 바뀌었는데(2026-07-28) 이 함수만 남아 있었다.
 *
 *   시드는 별도 문장으로 넣지 않는다(키워드 200개 = 200 서브리퀘스트 = 그 실행이 즉사). DDL 체크섬에
 *   **시드 목록의 체크섬을 마커로 섞어** 시드가 바뀐 회차에만 1 batch 로 적용한다.
 */
export function ensureDiscoveryKeywords(DB: D1Database): Promise<void> {
  const cached = _kwSchemaPromise.get(DB)
  if (cached) return cached
  const p = (async () => {
    const seeds = [...SEED, ...REGION_SEED, ...BANGBAE_SEED]
    const seedSum = ddlChecksum(seeds.flatMap(g => g.keywords.map(kw => `${g.category}:${kw}`)))
    // 마커는 실행돼도 무해한 SELECT — 체크섬 입력에 섞이는 것이 목적(시드 변경 감지).
    const { ran } = await runDdlOnce(DB, 'ads_ddl_discovery_keywords', [...KW_DDL, `SELECT '${seedSum}' AS seed_marker`])
    if (!ran) return // ✅ 최신 — DDL·시드 전부 생략(읽기 1회로 끝)
    // 시드(일반 ~90 + 지역그리드 100 + 방배 11) — 개별 INSERT 대신 1 batch (Free 한도 절약). 멱등 INSERT OR IGNORE.
    const stmts = seeds.flatMap(g => g.keywords.map(kw =>
      DB.prepare('INSERT OR IGNORE INTO ad_discovery_keywords (keyword, category, active, source) VALUES (?, ?, 1, ?)')
        .bind(kw, g.category, 'seed')))
    await DB.batch(stmts).catch(() => null)
  })()
  _kwSchemaPromise.set(DB, p)
  return p
}

/**
 * 🩹 **1회성 복구 — 오염된 고갈 카운터 초기화** (2026-07-29).
 *
 *   기록부가 "검색하고 0명"과 "검색을 못 함"을 구분하지 못하던 동안 `barren_streak` 은
 *   **물어보지도 않은 회차**를 세면서 자랐다(수집 루프의 `starved` 주석 참조). 그래서 지금 DB 에 남아
 *   있는 값은 신뢰할 수 없다 — 그대로 두면 고쳐진 회계 위에서도 옛 오염이 계속 벌을 준다
 *   (점수 −25/회 · 쿨다운 +6h/회 · auto 는 8회면 영구 비활성).
 *
 *   **카운터 전면 리셋만 한다** — 진짜 고갈이면 고쳐진 회계로 8회 만에 다시 쌓인다(손실 없음).
 *
 *   🚫 **은퇴한 키워드를 되살리지는 않는다.** 처음엔 "streak 로만 꺼진 productive auto 를 복구"하려 했다
 *   (`saved_total > 0` 이면 다른 은퇴 규칙에 안 걸리므로 꺼진 이유가 카운터뿐이라는 논리). 그런데
 *   **배포 전에 라이브에서 그 대상 50개를 실제로 뽑아 보니** 전부 `단타`·`인문학`·`독서습관`·`배당투자`·
 *   `나스닥`·`주린이` 였다 — 사람은 잘 모으지만(saved 400+) **유어딜과 무관한 사람들**이다
 *   (엑셀 `coreFirst` 주석이 기록한 "연락 대상 상위 20명이 전부 '기타'"의 원인이 바로 이 부류다).
 *   되살렸다면 희소한 YT 검색 슬롯을 저 키워드들이 먹고 풀이 더 오염됐을 것이다.
 *   ⚠️ auto 키워드는 `category` 가 전부 `'자동'` 이라 **카테고리로는 선별할 수 없다** — 그래서
 *   조건을 좁히는 대신 복구 자체를 뺐다. 잘못 은퇴한 온-타깃 태그는 승격 자리가 40개 비어 있으므로
 *   (auto 20/60) 정상 해시태그 경로로 다시 올라온다.
 *
 *   `runDdlOnce` 체크섬으로 **딱 한 번만** 실행된다(적용 후엔 읽기 1회 — 무료 플랜 예산 보호).
 */
export async function healBarrenStreakOnce(DB: D1Database): Promise<void> {
  await runDdlOnce(DB, 'ads_kw_barren_reset_v1', [
    'UPDATE ad_discovery_keywords SET barren_streak = 0 WHERE COALESCE(barren_streak, 0) > 0',
  ])
}

export async function listDiscoveryKeywords(DB: D1Database): Promise<DiscoveryKeyword[]> {
  await ensureDiscoveryKeywords(DB)
  const r = await DB.prepare('SELECT id, keyword, category, active, hits, source, created_at FROM ad_discovery_keywords ORDER BY active DESC, hits DESC, id ASC LIMIT 1000')
    .all<DiscoveryKeyword>().catch(() => null)
  return r?.results || []
}

export async function addDiscoveryKeyword(DB: D1Database, keyword: string, category?: string): Promise<{ ok: boolean; error?: string }> {
  const kw = (keyword || '').trim()
  if (kw.length < 2 || kw.length > 40) return { ok: false, error: 'INVALID' }
  await ensureDiscoveryKeywords(DB)
  await DB.prepare('INSERT OR IGNORE INTO ad_discovery_keywords (keyword, category, active, source) VALUES (?, ?, 1, ?)')
    .bind(kw, (category || '수동').slice(0, 40), 'manual').run().catch(() => null)
  return { ok: true }
}

export async function setKeywordActive(DB: D1Database, id: number, active: boolean): Promise<{ ok: boolean }> {
  // 🕐 켤 때 activated_at 스탬프 — 순환 나이 판정이 활성화 시각부터 세게(끄기는 시각 보존).
  await DB.prepare("UPDATE ad_discovery_keywords SET active = ?, activated_at = CASE WHEN ? = 1 THEN datetime('now') ELSE activated_at END WHERE id = ?")
    .bind(active ? 1 : 0, active ? 1 : 0, id).run().catch(() => null)
  return { ok: true }
}
