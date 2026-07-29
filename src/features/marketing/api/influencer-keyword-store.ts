/**
 * 🗂️ 유어애즈 발굴 **키워드 저장소** — 테이블 DDL · 시드 · CRUD.
 *
 * `influencer-auto-collect.ts` 에서 분리(600줄 래칫). 같은 파일의 `influencer-keyword-rotation.ts`
 * (성과 가중 선택)와 짝이다 — **여기는 "무엇이 있는가"(저장), 저기는 "무엇을 쓸까"(선택)**.
 *
 * 이동만 했고 로직은 byte-불변이다. 기존 import 경로 호환을 위해 auto-collect 가 재수출한다.
 */
import { runDdlOnce, ddlChecksum } from './ads-schema-guard'
import { SEED, REGION_SEED, BANGBAE_SEED } from './influencer-seed-keywords'
import type { DiscoveryKeyword } from './influencer-collect-types'

/** 키워드 테이블 DDL — 체크섬 1회 조회로 갈음(`runDdlOnce`). 문장을 바꾸면 체크섬이 바뀌어 자동 재적용. */
const KW_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS ad_discovery_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    category TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    hits INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'seed',
    created_at DATETIME DEFAULT (datetime('now'))
  )`,
  // 📊 키워드별 성과(누적 발굴/저장 + 직전 실행 저장 + 마지막 실행 시각) — "어느 지역 키워드가 잘 무는지" 관측용.
  'ALTER TABLE ad_discovery_keywords ADD COLUMN found_total INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE ad_discovery_keywords ADD COLUMN saved_total INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE ad_discovery_keywords ADD COLUMN last_saved INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE ad_discovery_keywords ADD COLUMN last_run_at DATETIME',
  // 🌵 2026-07-29 고갈 카운터 — **연속** 무수확 횟수. `last_saved`(직전 1회)만으로는 "한때 잘 물었지만
  //   이제 다 훑은" 키워드를 구분할 수 없다. 실측: 유튜브가 `found 5 → saved 0` 인데 쿼터는 39/90만 씀 —
  //   `saved_total` 이 큰 옛 성공 키워드가 점수 상위를 계속 차지해 **이미 수확한 채널을 재방문**하고 있었다.
  //   (기존 은퇴 조건은 `saved_total = 0` 이라 이 부류를 영원히 못 걸러낸다.)
  'ALTER TABLE ad_discovery_keywords ADD COLUMN barren_streak INTEGER NOT NULL DEFAULT 0',
]

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
  await DB.prepare('UPDATE ad_discovery_keywords SET active = ? WHERE id = ?').bind(active ? 1 : 0, id).run().catch(() => null)
  return { ok: true }
}

