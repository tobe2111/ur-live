/**
 * 🗓️ 이번 주 매장 영입 20곳 — 결재 `docs/decisions/2026-09-07-store-acquisition-pipeline.md` 선택지 1 (2026-09-08 대표 "모두 기본안대로").
 *   "매주 후보 N건(지역·카테고리·연락처 보유 기준) 추출 → 매장별 제안 문구 초안 → 응답·등록 추적표 → 등록 링크 안내. 발송은 대표."
 *
 *   이미 있는 것 위에 얹는다(결재 실행기 규칙 "집기 전에 코드를 먼저 연다"): 후보 풀 = `store_prospects`(인허가·카카오 수집),
 *   상태 추적 = 그 테이블의 status/contact_channel/follow_up_at, 개업 브리핑 = opening-briefing. 여기서 새로 만드는 것은
 *   **한 주 단위 고정 묶음**(같은 주엔 같은 20곳 — 그래야 추적표가 된다)과 그 묶음의 응답·등록 집계뿐이다.
 *
 *   선정 규칙(결정론 · 허위 0): 영업중 · 미접촉(status='new') · 연락처 보유 · 최근 8주 묶음에 안 들어간 매장 중
 *   우선업종(음식점·카페·미용·숙박) → 신규 개업 → 이메일 보유 → 최근 인허가 순. 지역/업종 제한은 설정으로(기본 없음).
 *   ⚠️ 수집 ≠ 발송 — 이 모듈은 발송 코드가 없다. 대표가 문구를 복사해 직접 보낸다(CLAUDE.md 유어애즈 방향 "출구는 내가").
 */
import { runDdlOnce } from './ads-schema-guard'
import { ensureProspectSchema, PRIORITY_UPJONG_SQL, type StoreProspectRow } from './store-prospects'

export const WEEKLY_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS store_weekly_picks (
    week TEXT NOT NULL,
    prospect_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    picked_at DATETIME DEFAULT (datetime('now')),
    PRIMARY KEY (week, prospect_id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_weekly_picks_prospect ON store_weekly_picks(prospect_id, week)',
]

const _done = new WeakSet<object>()
export async function ensureWeeklySchema(DB: D1Database): Promise<void> {
  if (_done.has(DB)) return
  await ensureProspectSchema(DB)
  await runDdlOnce(DB, 'ads_ddl_store_weekly_picks', WEEKLY_DDL)
  _done.add(DB)
}

/** 주 키 = 그 주 **월요일(KST)** 의 YYYY-MM-DD. 일요일 밤 11시(KST)도 같은 주로 묶인다. 순수 함수(테스트 대상). */
export function weekKeyKST(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const dow = kst.getUTCDay() // 0=일 … 6=토 (KST 기준 요일)
  const back = (dow + 6) % 7   // 월=0, 화=1, …, 일=6
  const mon = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - back))
  return `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}`
}

export interface WeeklyConfig { n: number; categories: string[]; regions: string[] }
export const WEEKLY_CONFIG_KEY = 'ads_store_weekly_config'
export const WEEKLY_N_DEFAULT = 20 // 결재 기본안 "N 은 주 20건으로 시작(응답률을 보고 조정)"
export function clampWeeklyConfig(raw: unknown): WeeklyConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const n = Math.min(100, Math.max(1, Math.trunc(Number(r.n)) || WEEKLY_N_DEFAULT))
  const arr = (v: unknown) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => String(x).trim()).slice(0, 20) : []
  return { n, categories: arr(r.categories), regions: arr(r.regions) }
}
export async function getWeeklyConfig(DB: D1Database): Promise<WeeklyConfig> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(WEEKLY_CONFIG_KEY).first<{ value: string }>().catch(() => null)
  let parsed: unknown = null
  try { parsed = row?.value ? JSON.parse(row.value) : null } catch { parsed = null }
  return clampWeeklyConfig(parsed)
}
export async function setWeeklyConfig(DB: D1Database, raw: unknown): Promise<WeeklyConfig> {
  const cfg = clampWeeklyConfig(raw)
  await DB.prepare("INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
    .bind(WEEKLY_CONFIG_KEY, JSON.stringify(cfg)).run()
  return cfg
}

export interface WeeklyPickRow extends Pick<StoreProspectRow,
  'id' | 'biz_name' | 'category' | 'uptae' | 'region' | 'addr_road' | 'phone' | 'email' | 'website' | 'apv_perm_ymd' | 'is_new_open' | 'status' | 'contact_channel' | 'follow_up_at' | 'memo'> {
  rank: number
}

export interface WeeklyTracker {
  total: number
  contacted: number   // 어떤 식으로든 접촉함(new 가 아님)
  responded: number   // 관심·입점·거절 = 응답이 있었던 것
  interested: number
  onboarded: number
  rejected: number
  hold: number
}

/** 순수 집계 — 행 상태에서 추적표 숫자를 낸다(테스트 대상). */
export function trackerOf(rows: Array<{ status: string }>): WeeklyTracker {
  const t: WeeklyTracker = { total: rows.length, contacted: 0, responded: 0, interested: 0, onboarded: 0, rejected: 0, hold: 0 }
  for (const r of rows) {
    if (r.status !== 'new') t.contacted++
    if (r.status === 'interested') { t.interested++; t.responded++ }
    else if (r.status === 'onboarded') { t.onboarded++; t.responded++ }
    else if (r.status === 'rejected') { t.rejected++; t.responded++ }
    else if (r.status === 'hold') t.hold++
  }
  return t
}

const PICK_COLS = 'p.id, p.biz_name, p.category, p.uptae, p.region, p.addr_road, p.phone, p.email, p.website, p.apv_perm_ymd, p.is_new_open, p.status, p.contact_channel, p.follow_up_at, p.memo'

/** 이번 주 묶음을 읽는다(없으면 규칙대로 만든다). 같은 주에 두 번 불러도 같은 20곳. */
export async function getOrCreateWeeklyPicks(DB: D1Database, week: string, cfg: WeeklyConfig): Promise<{ rows: WeeklyPickRow[]; created: boolean }> {
  await ensureWeeklySchema(DB)
  const existing = await listWeeklyPicks(DB, week)
  if (existing.length > 0) return { rows: existing, created: false }

  const where: string[] = [
    'p.active = 1', "p.status = 'new'",
    "((p.phone IS NOT NULL AND p.phone != '') OR (p.email IS NOT NULL AND p.email != ''))",
    // 최근 8주 묶음에 들어갔던 매장은 제외 — 같은 사장님께 두 번 가지 않는다.
    'p.id NOT IN (SELECT prospect_id FROM store_weekly_picks WHERE week >= ?)',
  ]
  const binds: (string | number)[] = [weekKeyKST(new Date(Date.now() - 8 * 7 * 86400_000))]
  if (cfg.categories.length) { where.push(`p.category IN (${cfg.categories.map(() => '?').join(',')})`); binds.push(...cfg.categories) }
  if (cfg.regions.length) { where.push(`(${cfg.regions.map(() => 'p.region LIKE ?').join(' OR ')})`); binds.push(...cfg.regions.map(r => `${r}%`)) }
  binds.push(cfg.n)
  const cand = (await DB.prepare(
    `SELECT ${PICK_COLS} FROM store_prospects p WHERE ${where.join(' AND ')}
     ORDER BY ${PRIORITY_UPJONG_SQL.replace(/category/g, 'p.category')}, p.is_new_open DESC,
       (CASE WHEN p.email IS NOT NULL AND p.email != '' THEN 0 ELSE 1 END), p.apv_perm_ymd DESC, p.id DESC
     LIMIT ?`).bind(...binds).all<Omit<WeeklyPickRow, 'rank'>>().catch(() => null))?.results || []
  if (cand.length === 0) return { rows: [], created: false }
  const stmts = cand.map((r, i) => DB.prepare('INSERT OR IGNORE INTO store_weekly_picks (week, prospect_id, rank) VALUES (?, ?, ?)').bind(week, r.id, i + 1))
  await DB.batch(stmts)
  return { rows: cand.map((r, i) => ({ ...r, rank: i + 1 })), created: true }
}

export async function listWeeklyPicks(DB: D1Database, week: string): Promise<WeeklyPickRow[]> {
  await ensureWeeklySchema(DB)
  return (await DB.prepare(
    `SELECT w.rank, ${PICK_COLS} FROM store_weekly_picks w JOIN store_prospects p ON p.id = w.prospect_id WHERE w.week = ? ORDER BY w.rank`)
    .bind(week).all<WeeklyPickRow>().catch(() => null))?.results || []
}

/** 최근 몇 주의 추적표 — 주별 숫자만(대표가 "응답률을 보고 N 조정"할 근거). */
export async function weeklyHistory(DB: D1Database, weeks = 8): Promise<Array<{ week: string } & WeeklyTracker>> {
  await ensureWeeklySchema(DB)
  const rows = (await DB.prepare(
    `SELECT w.week, p.status FROM store_weekly_picks w JOIN store_prospects p ON p.id = w.prospect_id
     WHERE w.week >= ? ORDER BY w.week DESC`).bind(weekKeyKST(new Date(Date.now() - weeks * 7 * 86400_000)))
    .all<{ week: string; status: string }>().catch(() => null))?.results || []
  const by = new Map<string, Array<{ status: string }>>()
  for (const r of rows) { const a = by.get(r.week) || []; a.push(r); by.set(r.week, a) }
  return [...by.entries()].map(([week, rs]) => ({ week, ...trackerOf(rs) }))
}
