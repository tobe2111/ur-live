/**
 * 🧮 **인플루언서 풀 통계 — 증분 집계** (2026-11-18 대표 *"증분 집계도 이어서 해줘"*).
 *
 * ## 왜
 * 통계 화면은 매번(캐시 30분) 풀 전체를 다시 셌다 — 회당 약 190만 행, 3.7초. 라이브 실측(2026-11-17, 리드 DB):
 * 하루 읽기 약 2억 행 중 **이 통계가 약 9,200만 행(절반 가까이)**이었고, 수집이 계속되니 행 수에 비례해 늘어난다.
 * ⇒ 행이 바뀔 때 **DB 트리거가 숫자 몇 개만 ±1** 한다. 화면은 숫자표(수백 행)만 읽는다 — 풀이 아무리 커져도 같다.
 *
 * ## 구조
 * - `ad_influencer_stats_counter(k, n)` — 키 하나에 숫자 하나. 키 셋 종류:
 *   전체 집계(`total` · `youtube` …) · 카테고리별(`cat|맛집|total` …) · 날짜별 유입(`day|2026-11-18|n` · `|reachable`).
 * - 트리거 3개(INSERT·UPDATE·DELETE). **바뀐 숫자만** 쓴다(변화량 0 은 안 쓴다) — 보강이 칸 하나를 고치면 쓰기 1행.
 * - **하루 한 번 전수 대조**(`reconcile`) — 한 batch(원자적)로 숫자표를 통째로 다시 만든다. 트리거가 잠시 빠졌거나
 *   (테이블 재생성 등) 무엇이 어긋나도 하루 안에 스스로 맞춰진다. 전수 대조 전에는 숫자표를 **안 쓴다**(옛 경로로 센다).
 *
 * ## 🛡️ 수집을 절대 멈추지 않게
 * 트리거가 런타임에 오류를 내면 그 테이블의 **모든 쓰기가 실패한다**(수집 전멸). 그래서 설치 직후 자가 시험을 한다 —
 * 풀 밖 시험 행(account_id = -1) 하나를 넣고·고치고·지우는 batch 를 돌려 세 트리거를 실제로 태운다. 하나라도 실패하면
 * **트리거를 즉시 내린다**(옛 경로로 계속 센다). 숫자표 테이블은 트리거보다 먼저 만들고 절대 지우지 않는다.
 *
 * ## 시간에 따라 변하는 숫자는 숫자표에 넣지 않는다
 * `오늘`·`최근 7일`은 날짜별 유입 키에서 더한다(KST 날짜 기준). `7일 안 컨택`·`팔로업 필요`는 날짜가 흐르면 행이 안 바뀌어도
 * 값이 바뀌므로 부분 인덱스(`idx_ad_inf_leads_contact_todo` — 컨택·팔로업 기록이 있는 행만)로 매번 센다.
 *
 * ⚠️ 이 파일이 못 막는 것: `INSERT OR REPLACE` 는 지우는 쪽 트리거를 안 태운다(SQLite 기본). 이 테이블엔 현재 0건이고
 *    시험이 소스 전수로 그걸 고정한다. 그래도 어긋나면 하루 대조가 고친다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { personalEmailSqlClause } from './influencer-email-rules'

export const COUNTER_TABLE = 'ad_influencer_stats_counter'
/** 정의가 바뀌면 올린다 — 트리거 이름과 대조 표식이 버전을 달고 있어 옛 트리거를 내리고 다시 대조한다. */
export const COUNTER_VERSION = 1
export const RECONCILED_KEY = `__reconciled_v${COUNTER_VERSION}`
/** 하루 한 번 전수 대조. */
export const RECONCILE_EVERY_MS = 24 * 60 * 60_000
const POOL = 0

type Cond = (r: string) => string
/** 전체 집계 — 행의 **상태만** 보는 숫자(시간이 흘러도 안 바뀌는 것). 이름은 화면이 읽는 키와 같다. */
export const STATE_COUNTERS: Array<[string, Cond]> = [
  ['total', () => '1=1'],
  ['youtube', r => `${r}platform='youtube'`],
  ['naver_blog', r => `${r}platform='naver_blog'`],
  ['with_contact', r => `${r}email IS NOT NULL OR ${r}instagram IS NOT NULL OR ${r}tiktok IS NOT NULL OR ${r}links IS NOT NULL`],
  ['with_email', r => `${r}email IS NOT NULL`],
  ['yt_with_email', r => `${r}platform='youtube' AND ${r}email IS NOT NULL`],
  ['yt_email_personal', r => `${r}platform='youtube' AND ${r}email IS NOT NULL AND (${personalEmailSqlClause(`${r}email`)})`],
  ['naver_cafe', r => `${r}platform='naver_cafe'`],
  ['nb_unmeasured', r => `${r}platform='naver_blog' AND ${r}perf_checked_at IS NULL`],
  ['st_new', r => `${r}status='new'`],
  ['st_contacted', r => `${r}status='contacted'`],
  ['st_interested', r => `${r}status='interested'`],
  ['st_contracted', r => `${r}status='contracted'`],
  ['st_rejected', r => `${r}status='rejected'`],
  ['st_hold', r => `${r}status='hold'`],
  ['reached', r => `${r}status IN ('contacted','interested','contracted')`],
  ['replied', r => `${r}status IN ('interested','contracted')`],
  ['opened', r => `${r}email_status='opened'`],
  ['bounced', r => `${r}email_status IN ('bounced','complained')`],
  ['ch_email', r => `${r}contact_channel='email'`],
  ['ch_dm', r => `${r}contact_channel='dm'`],
  ['ch_note', r => `${r}contact_channel='note'`],
  ['ch_kakao', r => `${r}contact_channel='kakao'`],
  ['ch_call', r => `${r}contact_channel='call'`],
  ['ch_other', r => `${r}contact_channel='other'`],
  ['consented', r => `${r}consented_at IS NOT NULL`],
  ['brand_tagged', r => `${r}is_brand = 1`],
  ['opted_out', r => `${r}opted_out = 1`],
  ['scored', r => `${r}lead_score IS NOT NULL`],
  ['score_hot', r => `${r}lead_score >= 70`],
  ['categorized', r => `${r}category IS NOT NULL`],
  ['cat_content', r => `${r}category IS NOT NULL AND ${r}category_source = 'content'`],
  ['cat_topic', r => `${r}category IS NOT NULL AND ${r}category_source = 'topic'`],
  ['cat_keyword', r => `${r}category IS NOT NULL AND COALESCE(${r}category_source, 'keyword') = 'keyword'`],
  ['region_filled', r => `${r}region IS NOT NULL AND ${r}region != ''`],
  ['region_none', r => `${r}region = ''`],
  ['region_pending', r => `${r}region IS NULL`],
  ['nb_with_subs', r => `${r}platform = 'naver_blog' AND ${r}subscriber_count > 0`],
  ['yt_with_subs', r => `${r}platform = 'youtube' AND ${r}subscriber_count > 0`],
  ['recruited', r => `${r}recruited_at IS NOT NULL`],
  ['recruit_converted', r => `${r}recruited_at IS NOT NULL AND ${r}consented_at IS NOT NULL`],
]
/** 카테고리별 전환(화면의 '카테고리별 전환' 표). */
export const CATEGORY_METRICS: Array<[string, Cond]> = [
  ['total', () => '1=1'],
  ['reached', r => `${r}status IN ('contacted','interested','contracted')`],
  ['replied', r => `${r}status IN ('interested','contracted')`],
  ['contracted', r => `${r}status = 'contracted'`],
  ['consented', r => `${r}consented_at IS NOT NULL`],
]
/** 날짜별 유입(KST) — 14일 그래프·오늘·최근 7일. */
export const DAY_METRICS: Array<[string, Cond]> = [
  ['n', () => '1=1'],
  ['reachable', r => `${r}email IS NOT NULL AND ${r}email != ''`],
]
/** 트리거가 반응하는 칸 — 위 조건이 읽는 칸 전부(시험이 조건 문자열과 대조한다). */
export const WATCHED_COLUMNS = [
  'account_id', 'platform', 'email', 'instagram', 'tiktok', 'links', 'perf_checked_at', 'status', 'email_status',
  'contact_channel', 'consented_at', 'is_brand', 'opted_out', 'lead_score', 'category', 'category_source', 'region',
  'subscriber_count', 'recruited_at', 'collected_at',
] as const

const catKey = (r: string, m: string) => `'cat|' || COALESCE(${r}category, '미분류') || '|${m}'`
const dayKey = (r: string, m: string) => `'day|' || DATE(${r}collected_at, '+9 hours') || '|${m}'`
const one = (r: string, c: Cond) => `(CASE WHEN ${r}account_id = ${POOL} AND (${c(r)}) THEN 1 ELSE 0 END)`

/** 한 쪽(NEW. 또는 OLD.) 행이 내는 (키, 변화량) 줄들. */
function arms(r: string, sign: 1 | -1): string[] {
  const s = sign === 1 ? '' : '-'
  return [
    ...STATE_COUNTERS.map(([k, c]) => `SELECT '${k}' AS k, ${s}${one(r, c)} AS d`),
    ...CATEGORY_METRICS.map(([m, c]) => `SELECT ${catKey(r, m)} AS k, ${s}${one(r, c)} AS d`),
    ...DAY_METRICS.map(([m, c]) => `SELECT ${dayKey(r, m)} AS k, ${s}${one(r, c)} AS d`),
  ]
}

/** 트리거 본문 — 같은 키를 합치고 **0 이 아닌 것만** 쓴다(쓰기 = 실제로 바뀐 숫자 수). */
function upsertBody(parts: string[]): string {
  return `INSERT INTO ${COUNTER_TABLE} (k, n)
      SELECT k, d FROM (SELECT k, SUM(d) AS d FROM (${parts.join(' UNION ALL ')}) GROUP BY k)
      WHERE k IS NOT NULL AND d != 0
      ON CONFLICT(k) DO UPDATE SET n = n + excluded.n;`
}

export const TRIGGER_NAMES = ['ins', 'upd', 'del'].map(s => `trg_inf_stats_v${COUNTER_VERSION}_${s}`)

export function counterDdl(): string[] {
  const [ins, upd, del] = TRIGGER_NAMES
  return [
    `CREATE TABLE IF NOT EXISTS ${COUNTER_TABLE} (k TEXT PRIMARY KEY NOT NULL, n INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TRIGGER IF NOT EXISTS ${ins} AFTER INSERT ON ad_influencer_leads BEGIN ${upsertBody(arms('NEW.', 1))} END`,
    `CREATE TRIGGER IF NOT EXISTS ${upd} AFTER UPDATE OF ${WATCHED_COLUMNS.join(', ')} ON ad_influencer_leads BEGIN ${upsertBody([...arms('NEW.', 1), ...arms('OLD.', -1)])} END`,
    `CREATE TRIGGER IF NOT EXISTS ${del} AFTER DELETE ON ad_influencer_leads BEGIN ${upsertBody(arms('OLD.', -1))} END`,
  ]
}

/** 옛 버전 트리거 이름(버전을 올리면 내린다). */
export function staleTriggerNames(): string[] {
  const out: string[] = []
  for (let v = 1; v < COUNTER_VERSION; v++) for (const s of ['ins', 'upd', 'del']) out.push(`trg_inf_stats_v${v}_${s}`)
  return out
}

/** 전수 대조 — **한 batch** 로 실행한다(원자적: 그 사이 트리거가 끼어들지 못한다). */
export function reconcileStatements(nowMs: number): Array<{ sql: string; binds: unknown[] }> {
  // 열 → 행 펼치기는 json_each(json_object(…)) 로 한다 — 키 목록 하나로 한 번만 읽고(MATERIALIZED) 여러 행을 낸다.
  const st = STATE_COUNTERS.map(([, c], i) => `COALESCE(SUM(CASE WHEN ${c('')} THEN 1 ELSE 0 END), 0) AS c${i}`).join(',\n        ')
  const stPairs = STATE_COUNTERS.map(([k], i) => `'${k}', c${i}`).join(', ')
  const ct = CATEGORY_METRICS.map(([m, c]) => `SUM(CASE WHEN ${c('')} THEN 1 ELSE 0 END) AS m_${m}`).join(', ')
  const ctPairs = CATEGORY_METRICS.map(([m]) => `'${m}', m_${m}`).join(', ')
  const dy = DAY_METRICS.map(([m, c]) => `SUM(CASE WHEN ${c('')} THEN 1 ELSE 0 END) AS m_${m}`).join(', ')
  const dyPairs = DAY_METRICS.map(([m]) => `'${m}', m_${m}`).join(', ')
  return [
    { sql: `DELETE FROM ${COUNTER_TABLE}`, binds: [] },
    { sql: `WITH agg AS MATERIALIZED (SELECT ${st} FROM ad_influencer_leads WHERE account_id = ${POOL})
      INSERT INTO ${COUNTER_TABLE} (k, n) SELECT j.key, j.value FROM agg, json_each(json_object(${stPairs})) j`, binds: [] },
    { sql: `WITH cats AS MATERIALIZED (SELECT COALESCE(category, '미분류') AS g, ${ct} FROM ad_influencer_leads WHERE account_id = ${POOL} GROUP BY g)
      INSERT INTO ${COUNTER_TABLE} (k, n) SELECT 'cat|' || cats.g || '|' || j.key, j.value FROM cats, json_each(json_object(${ctPairs})) j WHERE j.value != 0`, binds: [] },
    { sql: `WITH days AS MATERIALIZED (SELECT DATE(collected_at, '+9 hours') AS g, ${dy} FROM ad_influencer_leads
        WHERE account_id = ${POOL} AND collected_at IS NOT NULL GROUP BY g)
      INSERT INTO ${COUNTER_TABLE} (k, n) SELECT 'day|' || days.g || '|' || j.key, j.value FROM days, json_each(json_object(${dyPairs})) j WHERE j.value != 0`, binds: [] },
    { sql: `INSERT INTO ${COUNTER_TABLE} (k, n) VALUES (?, ?)`, binds: [RECONCILED_KEY, nowMs] },
  ]
}

/** 시험 행 — 풀 밖(account_id = -1)이라 숫자를 안 바꾸고, 같은 batch 안에서 사라진다. */
const SELFTEST_CHANNEL = '__stats_trigger_selftest__'
export function selfTestStatements(): Array<{ sql: string; binds: unknown[] }> {
  return [
    { sql: `INSERT INTO ad_influencer_leads (account_id, platform, channel_id, name, url) VALUES (-1, 'youtube', ?, 'selftest', 'selftest')`, binds: [SELFTEST_CHANNEL] },
    { sql: `UPDATE ad_influencer_leads SET status = 'hold', category = '맛집', email = 'a@b.c' WHERE account_id = -1 AND channel_id = ?`, binds: [SELFTEST_CHANNEL] },
    { sql: `DELETE FROM ad_influencer_leads WHERE account_id = -1 AND channel_id = ?`, binds: [SELFTEST_CHANNEL] },
  ]
}

/** `7일 안 컨택`·`팔로업 필요` — 시간이 흐르면 바뀌는 숫자. 이 부분 인덱스 덕에 컨택 기록이 있는 행만 읽는다. */
export const CONTACT_TODO_INDEX = `CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_contact_todo ON ad_influencer_leads(account_id, contacted_at)
  WHERE contacted_at IS NOT NULL OR follow_up_at IS NOT NULL`
export const CONTACT_TODO_SQL = `SELECT
    COALESCE(SUM(CASE WHEN contacted_at >= datetime('now','-7 days') THEN 1 ELSE 0 END), 0) AS contacted7,
    COALESCE(SUM(CASE WHEN (follow_up_at IS NOT NULL AND follow_up_at <= date('now')) OR (status='contacted' AND contacted_at <= datetime('now','-5 days')) THEN 1 ELSE 0 END), 0) AS need_followup,
    DATE('now','+9 hours') AS today_kst
  FROM ad_influencer_leads WHERE account_id = ${POOL} AND (contacted_at IS NOT NULL OR follow_up_at IS NOT NULL)`

const ready = new WeakSet<object>()
const failed = new WeakSet<object>()

/**
 * 숫자표·트리거를 준비한다(isolate 당 1회). 트리거를 **새로 만들었으면** 대조 표식을 지워 다시 대조하게 한다
 * (트리거가 없던 동안의 쓰기는 숫자표에 안 들어갔다). 자가 시험이 실패하면 트리거를 내리고 false.
 */
export async function ensureStatsCounters(DB: D1Database): Promise<boolean> {
  if (ready.has(DB)) return true
  if (failed.has(DB)) return false
  try {
    // ⚠️ SQL 에 리드 테이블 이름이 있어야 라우터가 리드 DB 로 보낸다(없으면 메인 DB 의 sqlite_master 를 본다).
    const have = await DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'ad_influencer_leads' AND name IN (${TRIGGER_NAMES.map(() => '?').join(',')})`) // d1-bind-ok: 트리거 이름 3개 고정(한도 100 에 닿을 수 없다)
      .bind(...TRIGGER_NAMES).all<{ name: string }>()
    const missing = TRIGGER_NAMES.filter(n => !(have.results || []).some(x => x.name === n))
    const [table, ...triggers] = counterDdl()
    await DB.prepare(table).run()
    await DB.prepare(CONTACT_TODO_INDEX).run()
    for (const old of staleTriggerNames()) await DB.prepare(`DROP TRIGGER IF EXISTS ${old}`).run()
    if (missing.length) {
      await DB.prepare(`DELETE FROM ${COUNTER_TABLE} WHERE k = ?`).bind(RECONCILED_KEY).run()
      for (const t of triggers) await DB.prepare(t).run()
      try {
        await DB.batch(selfTestStatements().map(s => DB.prepare(s.sql).bind(...s.binds)))
      } catch (e) {
        for (const n of TRIGGER_NAMES) await DB.prepare(`DROP TRIGGER IF EXISTS ${n}`).run().catch(() => null)
        await recordCounterError(DB, 'selftest', e)
        failed.add(DB)
        return false
      }
    }
    ready.add(DB)
    return true
  } catch (e) {
    await recordCounterError(DB, 'ensure', e)
    failed.add(DB)
    return false
  }
}

export const COUNTER_ERROR_KEY = 'ads_influencer_stats_counter_error'
async function recordCounterError(DB: D1Database, stage: string, e: unknown): Promise<void> {
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(COUNTER_ERROR_KEY, JSON.stringify({ at: Date.now(), stage, error: String((e as Error)?.message || e).slice(0, 300) })).run().catch(() => null)
}

export async function reconcileStatsCounters(DB: D1Database, nowMs = Date.now()): Promise<boolean> {
  try {
    await DB.batch(reconcileStatements(nowMs).map(s => DB.prepare(s.sql).bind(...s.binds)))
    return true
  } catch (e) {
    await recordCounterError(DB, 'reconcile', e)
    return false
  }
}

export type CounterSnapshot = {
  reconciledAt: number | null
  state: Record<string, number>
  categories: Array<{ category: string; total: number; reached: number; replied: number; contracted: number; consented: number }>
  days: Map<string, { n: number; reachable: number }>
}

/** 숫자표 → 화면 모양. 순수함수(시험 대상). */
export function parseCounters(rows: Array<{ k: string; n: number }>): CounterSnapshot {
  const state: Record<string, number> = {}
  const cats = new Map<string, Record<string, number>>()
  const days = new Map<string, { n: number; reachable: number }>()
  let reconciledAt: number | null = null
  for (const { k, n } of rows) {
    const v = Number(n) || 0
    if (k === RECONCILED_KEY) { reconciledAt = v; continue }
    if (k.startsWith('cat|')) {
      const i = k.lastIndexOf('|'); const name = k.slice(4, i); const m = k.slice(i + 1)
      if (!cats.has(name)) cats.set(name, {})
      cats.get(name)![m] = v
    } else if (k.startsWith('day|')) {
      const i = k.lastIndexOf('|'); const d = k.slice(4, i); const m = k.slice(i + 1)
      const cur = days.get(d) || { n: 0, reachable: 0 }
      if (m === 'n' || m === 'reachable') cur[m] = v
      days.set(d, cur)
    } else if (!k.startsWith('__')) state[k] = v
  }
  for (const [k] of STATE_COUNTERS) state[k] ??= 0
  const categories = [...cats.entries()].map(([category, m]) => ({
    category, total: m.total || 0, reached: m.reached || 0, replied: m.replied || 0, contracted: m.contracted || 0, consented: m.consented || 0,
  }))
  return { reconciledAt, state, categories, days }
}

/** 화면의 '카테고리별 전환' — 옛 쿼리와 같은 규칙(컨택 있는 카테고리만, 컨택 많은 순 8개). */
export function topCategoryFunnel(cats: CounterSnapshot['categories']): CounterSnapshot['categories'] {
  return cats.filter(c => c.reached > 0).sort((a, b) => b.reached - a.reached || (a.category < b.category ? -1 : 1)).slice(0, 8)
}

/** 최근 14일(KST) 유입 — 오늘부터 거꾸로. 숫자가 없는 날은 빼지 않고 0 으로 둔다(수집이 멈춘 날이 보이게). */
export function lastDays(days: CounterSnapshot['days'], todayKst: string, count = 14): Array<{ d: string; n: number; reachable: number }> {
  const out: Array<{ d: string; n: number; reachable: number }> = []
  const base = Date.parse(`${todayKst}T00:00:00Z`)
  if (!Number.isFinite(base)) return out
  for (let i = 0; i < count; i++) {
    const d = new Date(base - i * 86_400_000).toISOString().slice(0, 10)
    const v = days.get(d) || { n: 0, reachable: 0 }
    out.push({ d, n: v.n, reachable: v.reachable })
  }
  return out
}

export async function readStatsCounters(DB: D1Database): Promise<CounterSnapshot | null> {
  const r = await DB.prepare(`SELECT k, n FROM ${COUNTER_TABLE}`).all<{ k: string; n: number }>().catch(() => null)
  return r ? parseCounters(r.results || []) : null
}
