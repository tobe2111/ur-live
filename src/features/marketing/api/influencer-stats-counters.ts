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
 * - **처음 채우기는 조각으로**(`bootStep`) — id 25만 칸씩, 한 조각 = batch 하나(원자적). 🩸 왜 조각인가(2026-11-18 라이브):
 *   풀 전체를 한 번에 세면 D1 이 `D1 DB is overloaded. Too many resources consumed within a 10 second window.` 로
 *   거부했다 — 옛 통계가 44분 넘게 안 갱신된 진짜 원인이 이것이었다(`ads_influencer_stats_cache_fail` 원문).
 *   한 번에 세는 대조(약 8초 · 290만 행)도 같은 벽에 닿는다.
 * - 채우는 동안의 규칙: 트리거는 **이미 센 구간(id < 커서)과 채우기 시작 뒤 새로 들어온 행(id > 상한)** 에만 반응한다.
 *   아직 안 센 행이 바뀌면 숫자표는 그대로 두고, 그 조각을 셀 때 **그 순간의 상태**로 한 번만 센다 — 이중 계산이 없다.
 * - **한 시간에 한 번 어긋남 검사**(한 문장 — 숫자표의 `total` 과 실제 행 수를 같은 순간에 비교). 다르면 처음부터 다시 채운다.
 *   채우기가 끝나기 전에는 숫자표를 **안 쓴다**(옛 경로로 센다).
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
 *    시험이 소스 전수로 그걸 고정한다. 그래도 어긋나면 한 시간마다 도는 어긋남 검사가 잡아 다시 채운다(단, total 이 맞고
 *    다른 숫자만 틀어진 경우는 못 잡는다 — 그런 경로가 없다는 것을 위 두 시험이 지킨다).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { personalEmailSqlClause } from './influencer-email-rules'

export const COUNTER_TABLE = 'ad_influencer_stats_counter'
/** 정의가 바뀌면 올린다 — 트리거 이름이 버전을 달고 있어 옛 트리거를 내리고, 새 트리거를 깔면서 처음부터 다시 채운다. */
export const COUNTER_VERSION = 1
/** 채우기 상태 키 — 커서(다음에 셀 id) · 상한(채우기 시작 때의 최대 id) · 조각 소유 표식. 커서 > 상한 이면 다 채운 것. */
export const BOOT_CURSOR = '__boot_cursor'
export const BOOT_MAX = '__boot_max'
export const BOOT_TOKEN = '__boot_token'
export const CHECKED_AT = '__checked_at'
/**
 * 한 조각의 id 폭. 🔬 라이브 실측(2026-11-18): 행 58.8만인데 최대 id 439만(id 가 성기다) — 25만 폭에 행이 가장 많은 구간이
 * 10.9만(맨 앞), 대개 3~5만. 1만 행 조각 세기가 23~47ms 였으니 가장 무거운 조각도 1초 안팎 · 읽기 33만 행 이하.
 * 약 18조각, 응답 뒤에 두 조각씩 20초 간격 → 화면을 연 뒤 3분 안팎에 다 찬다.
 */
export const BOOT_STEP_IDS = 250_000
/** 어긋남 검사 간격. */
export const DRIFT_CHECK_EVERY_MS = 60 * 60_000
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

/** 이 행이 이미 숫자표에 들어가 있는가(센 구간이거나 채우기 시작 뒤에 들어온 행). 키가 없으면 NULL → 반응 안 함. */
const counted = (r: string) => `(${r}id < (SELECT n FROM ${COUNTER_TABLE} WHERE k = '${BOOT_CURSOR}') OR ${r}id > (SELECT n FROM ${COUNTER_TABLE} WHERE k = '${BOOT_MAX}'))`

export function counterTableDdl(): string {
  return `CREATE TABLE IF NOT EXISTS ${COUNTER_TABLE} (k TEXT PRIMARY KEY NOT NULL, n INTEGER NOT NULL DEFAULT 0)`
}

/** 트리거 3개. ⚠️ 고치기는 id 가 안 바뀐다(코드 전수에 id UPDATE 0건)는 전제로 NEW.id 하나로 판정한다. */
export function counterDdl(): string[] {
  const [ins, upd, del] = TRIGGER_NAMES
  return [
    counterTableDdl(),
    `CREATE TRIGGER IF NOT EXISTS ${ins} AFTER INSERT ON ad_influencer_leads WHEN ${counted('NEW.')} BEGIN ${upsertBody(arms('NEW.', 1))} END`,
    `CREATE TRIGGER IF NOT EXISTS ${upd} AFTER UPDATE OF ${WATCHED_COLUMNS.join(', ')} ON ad_influencer_leads WHEN ${counted('NEW.')} BEGIN ${upsertBody([...arms('NEW.', 1), ...arms('OLD.', -1)])} END`,
    `CREATE TRIGGER IF NOT EXISTS ${del} AFTER DELETE ON ad_influencer_leads WHEN ${counted('OLD.')} BEGIN ${upsertBody(arms('OLD.', -1))} END`,
  ]
}

/** 옛 버전 트리거 이름(버전을 올리면 내린다). */
export function staleTriggerNames(): string[] {
  const out: string[] = []
  for (let v = 1; v < COUNTER_VERSION; v++) for (const s of ['ins', 'upd', 'del']) out.push(`trg_inf_stats_v${v}_${s}`)
  return out
}

/** 처음부터 다시 채우기 시작 — 숫자를 비우고 커서 0 · 상한 = 지금의 최대 id. **트리거 설치와 같은 batch** 로 보낸다(그 사이 행을 놓치지 않게). */
export function rebuildStatements(): Array<{ sql: string; binds: unknown[] }> {
  return [
    { sql: `DELETE FROM ${COUNTER_TABLE}`, binds: [] },
    { sql: `INSERT INTO ${COUNTER_TABLE} (k, n) VALUES (?, 0), (?, 0)`, binds: [BOOT_CURSOR, BOOT_TOKEN] },
    { sql: `INSERT INTO ${COUNTER_TABLE} (k, n) SELECT ?, COALESCE(MAX(id), 0) FROM ad_influencer_leads`, binds: [BOOT_MAX] },
  ]
}

/**
 * 조각 하나(id `lo`~`lo+폭-1`)를 센다 — 한 batch. 여러 isolate 가 같은 조각을 동시에 잡아도 **이긴 쪽만** 센다:
 * ① 커서가 아직 `lo` 일 때만 소유 표식을 내 것(token)으로 ② 표식이 내 것일 때만 더하고 ③ 커서를 넘긴다.
 * 진 쪽은 ①에서 커서가 이미 넘어가 있어 표식이 안 바뀌고, ②③이 아무것도 안 한다.
 */
export function bootStepStatements(lo: number, max: number, token: number, width = BOOT_STEP_IDS): Array<{ sql: string; binds: unknown[] }> {
  // 🩸 상한(max)을 넘겨 세면 안 된다 — 그 위는 채우기 시작 뒤 들어온 행이라 트리거가 이미 셌다(시험이 잡은 이중 계산).
  const hi = Math.min(lo + width - 1, max)
  const mine = `EXISTS (SELECT 1 FROM ${COUNTER_TABLE} WHERE k = '${BOOT_TOKEN}' AND n = ?)`
  const st = STATE_COUNTERS.map(([, c], i) => `COALESCE(SUM(CASE WHEN ${c('')} THEN 1 ELSE 0 END), 0) AS c${i}`).join(',\n        ')
  const stPairs = STATE_COUNTERS.map(([k], i) => `'${k}', c${i}`).join(', ')
  const ct = CATEGORY_METRICS.map(([m, c]) => `SUM(CASE WHEN ${c('')} THEN 1 ELSE 0 END) AS m_${m}`).join(', ')
  const ctPairs = CATEGORY_METRICS.map(([m]) => `'${m}', m_${m}`).join(', ')
  const dy = DAY_METRICS.map(([m, c]) => `SUM(CASE WHEN ${c('')} THEN 1 ELSE 0 END) AS m_${m}`).join(', ')
  const dyPairs = DAY_METRICS.map(([m]) => `'${m}', m_${m}`).join(', ')
  const add = 'ON CONFLICT(k) DO UPDATE SET n = n + excluded.n'
  return [
    { sql: `UPDATE ${COUNTER_TABLE} SET n = ? WHERE k = '${BOOT_TOKEN}' AND (SELECT n FROM ${COUNTER_TABLE} WHERE k = '${BOOT_CURSOR}') = ?`, binds: [token, lo] },
    { sql: `WITH agg AS MATERIALIZED (SELECT ${st} FROM ad_influencer_leads WHERE id BETWEEN ? AND ? AND account_id = ${POOL})
      INSERT INTO ${COUNTER_TABLE} (k, n) SELECT j.key, j.value FROM agg, json_each(json_object(${stPairs})) j WHERE j.value != 0 AND ${mine} ${add}`, binds: [lo, hi, token] },
    { sql: `WITH cats AS MATERIALIZED (SELECT COALESCE(category, '미분류') AS g, ${ct} FROM ad_influencer_leads WHERE id BETWEEN ? AND ? AND account_id = ${POOL} GROUP BY g)
      INSERT INTO ${COUNTER_TABLE} (k, n) SELECT 'cat|' || cats.g || '|' || j.key, j.value FROM cats, json_each(json_object(${ctPairs})) j WHERE j.value != 0 AND ${mine} ${add}`, binds: [lo, hi, token] },
    { sql: `WITH days AS MATERIALIZED (SELECT DATE(collected_at, '+9 hours') AS g, ${dy} FROM ad_influencer_leads
        WHERE id BETWEEN ? AND ? AND account_id = ${POOL} AND collected_at IS NOT NULL GROUP BY g)
      INSERT INTO ${COUNTER_TABLE} (k, n) SELECT 'day|' || days.g || '|' || j.key, j.value FROM days, json_each(json_object(${dyPairs})) j WHERE j.value != 0 AND ${mine} ${add}`, binds: [lo, hi, token] },
    { sql: `UPDATE ${COUNTER_TABLE} SET n = ? WHERE k = '${BOOT_CURSOR}' AND n = ? AND ${mine}`, binds: [hi + 1, lo, token] },
  ]
}

/** 어긋남 검사 — 숫자표의 total 과 실제 행 수를 **한 문장**(같은 순간)에서 읽는다. */
export const DRIFT_SQL = `SELECT (SELECT n FROM ${COUNTER_TABLE} WHERE k = 'total') AS counted,
    (SELECT COUNT(*) FROM ad_influencer_leads WHERE account_id = ${POOL}) AS actual`

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
 * 숫자표·트리거를 준비한다(isolate 당 1회). 트리거를 **새로 만들었으면** 처음부터 다시 채운다
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
    await DB.prepare(counterTableDdl()).run()
    await DB.prepare(CONTACT_TODO_INDEX).run()
    for (const old of staleTriggerNames()) await DB.prepare(`DROP TRIGGER IF EXISTS ${old}`).run()
    if (missing.length) {
      // 트리거가 없던 동안의 쓰기는 숫자표에 없다 → 처음부터 다시 채운다. 트리거 설치와 **같은 batch**(그 사이 행을 놓치지 않게).
      for (const n of TRIGGER_NAMES) await DB.prepare(`DROP TRIGGER IF EXISTS ${n}`).run()
      const [, ...triggers] = counterDdl()
      await DB.batch([...rebuildStatements(), ...triggers.map(t => ({ sql: t, binds: [] }))].map(s => DB.prepare(s.sql).bind(...s.binds)))
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

/** 조각을 최대 `steps` 개 센다. 다 채웠으면 0. 반환 = 실제로 센 조각 수. */
export async function runBootSteps(DB: D1Database, steps = 2, width = BOOT_STEP_IDS): Promise<number> {
  let done = 0
  for (let i = 0; i < steps; i++) {
    const st = await DB.prepare(`SELECT k, n FROM ${COUNTER_TABLE} WHERE k IN (?, ?)`).bind(BOOT_CURSOR, BOOT_MAX).all<{ k: string; n: number }>().catch(() => null) // d1-bind-ok: 키 2개 고정
    const cur = Number(st?.results?.find(x => x.k === BOOT_CURSOR)?.n)
    const max = Number(st?.results?.find(x => x.k === BOOT_MAX)?.n)
    if (!Number.isFinite(cur) || !Number.isFinite(max) || cur > max) break
    const token = 1 + Math.floor(Math.random() * 2 ** 50)
    try {
      await DB.batch(bootStepStatements(cur, max, token, width).map(s => DB.prepare(s.sql).bind(...s.binds)))
      done++
    } catch (e) {
      await recordCounterError(DB, 'boot', e)
      break
    }
  }
  return done
}

/** 어긋났으면 처음부터 다시 채운다(트리거는 그대로 — 다시 채우는 동안 WHEN 이 안 센 구간을 거른다). 반환 = 어긋남 여부. */
export async function checkDrift(DB: D1Database, nowMs = Date.now()): Promise<boolean> {
  const r = await DB.prepare(DRIFT_SQL).first<{ counted: number | null; actual: number }>().catch(() => null)
  if (!r) return false
  await DB.prepare(`INSERT INTO ${COUNTER_TABLE} (k, n) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET n = excluded.n`).bind(CHECKED_AT, nowMs).run().catch(() => null)
  if (Number(r.counted ?? -1) === Number(r.actual)) return false
  await recordCounterError(DB, 'drift', new Error(`counted=${r.counted} actual=${r.actual}`))
  await DB.batch(rebuildStatements().map(s => DB.prepare(s.sql).bind(...s.binds))).catch(e => recordCounterError(DB, 'rebuild', e))
  return true
}

export type CounterSnapshot = {
  /** 다 채웠는가(커서 > 상한). 아니면 숫자표를 쓰지 않는다. */
  complete: boolean
  checkedAt: number | null
  state: Record<string, number>
  categories: Array<{ category: string; total: number; reached: number; replied: number; contracted: number; consented: number }>
  days: Map<string, { n: number; reachable: number }>
}

/** 숫자표 → 화면 모양. 순수함수(시험 대상). */
export function parseCounters(rows: Array<{ k: string; n: number }>): CounterSnapshot {
  const state: Record<string, number> = {}
  const cats = new Map<string, Record<string, number>>()
  const days = new Map<string, { n: number; reachable: number }>()
  const meta: Record<string, number> = {}
  for (const { k, n } of rows) {
    const v = Number(n) || 0
    if (k.startsWith('__')) { meta[k] = v; continue }
    if (k.startsWith('cat|')) {
      const i = k.lastIndexOf('|'); const name = k.slice(4, i); const m = k.slice(i + 1)
      if (!cats.has(name)) cats.set(name, {})
      cats.get(name)![m] = v
    } else if (k.startsWith('day|')) {
      const i = k.lastIndexOf('|'); const d = k.slice(4, i); const m = k.slice(i + 1)
      const cur = days.get(d) || { n: 0, reachable: 0 }
      if (m === 'n' || m === 'reachable') cur[m] = v
      days.set(d, cur)
    } else state[k] = v
  }
  for (const [k] of STATE_COUNTERS) state[k] ??= 0
  const categories = [...cats.entries()].map(([category, m]) => ({
    category, total: m.total || 0, reached: m.reached || 0, replied: m.replied || 0, contracted: m.contracted || 0, consented: m.consented || 0,
  }))
  const complete = BOOT_CURSOR in meta && BOOT_MAX in meta && meta[BOOT_CURSOR] > meta[BOOT_MAX]
  return { complete, checkedAt: CHECKED_AT in meta ? meta[CHECKED_AT] : null, state, categories, days }
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
