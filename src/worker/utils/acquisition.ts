/**
 * 📡 2026-07-05 유입 소스 어트리뷰션 (B2G 상권 패키지 — "시설물별 스캔·유입 성과 측정" 약속 이행).
 *
 * URL 규격 (인쇄물 SSOT — 시설물 QR 은 이 형식으로 제작):
 *   https://urdeal.kr/local/{지역코드}?src={소스}
 *   소스 네이밍: 소문자·숫자·하이픈 (예: photozone, banner-01, flag-1234, insta, danggn).
 *   광고 UTM 유입은 src 부재 시 utm_source 를 같은 체계로 흡수 (클라 acquisition.ts).
 *
 * 데이터 모델 (first-touch 30일 고정 — 클라 localStorage 가 첫 소스를 보존):
 *   - acquisition_landings: 소스별 랜딩(첫 접촉) 이벤트 — 퍼널의 분모. 비로그인 포함.
 *   - user_acquisition: 유저당 1행(UNIQUE user_id = first-touch 고정) — 가입 귀속.
 *     first_order_at/first_order_ref = 첫 구매 스냅샷 (구매 전환 퍼널).
 *
 * 퍼널: 랜딩(acquisition_landings) → 가입(user_acquisition) → 첫구매(first_order_at NOT NULL)
 * — 어드민 상권 리포트(region.routes /report)의 sources 축이 이 두 테이블을 집계.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** 소스 식별자 검증 — 소문자/숫자/하이픈 1~40자 (인쇄물 네이밍 규칙과 동일). */
export function normalizeAcqSource(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(s)) return null
  return s
}

const _ensured = new WeakSet<D1Database>()
export async function ensureAcquisitionTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS acquisition_landings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        src TEXT NOT NULL,
        region_code TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run()
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_acq_landings_src ON acquisition_landings(src)').run().catch(() => {})
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS user_acquisition (
        user_id TEXT PRIMARY KEY,
        src TEXT NOT NULL,
        region_code TEXT,
        landed_at TEXT,
        claimed_at TEXT DEFAULT (datetime('now')),
        first_order_at TEXT,
        first_order_ref TEXT
      )
    `).run()
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_acq_src ON user_acquisition(src)').run().catch(() => {})
  } catch { /* exists */ }
  await addUtmColumns(DB, 'acquisition_landings')
  await addUtmColumns(DB, 'user_acquisition')
}

/**
 * 📣 2026-10-19 SNS 봇 UTM 귀속 — src(=utm_source, 플랫폼)만으로는 "어느 카테고리 글이 데려왔나"를 못 센다.
 * utm_campaign(카테고리)·utm_content(글 id) 두 칸을 덧붙인다. 이미 있으면 ALTER 가 실패하고 그대로 넘어간다(멱등).
 */
async function addUtmColumns(DB: D1Database, table: 'acquisition_landings' | 'user_acquisition' | 'acquisition_conversions'): Promise<void> {
  for (const col of ['utm_campaign', 'utm_content']) {
    await DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`).run().catch(() => { /* exists */ })
  }
}

export interface AcqUtm { campaign?: unknown; content?: unknown }

/**
 * 첫 구매 스냅샷 — 구매 확정 시 호출 (멱등: first_order_at IS NULL 인 첫 1회만 기록).
 * fail-soft: 결제 흐름을 절대 막지 않음 (waitUntil side-effect 권장).
 */
export async function markAcquisitionFirstPurchase(
  DB: D1Database,
  userId: string | number,
  orderRef?: string | null,
): Promise<void> {
  try {
    const uid = String(userId ?? '')
    if (!uid) return
    await ensureAcquisitionTables(DB)
    await DB.prepare(
      `UPDATE user_acquisition
          SET first_order_at = datetime('now'), first_order_ref = ?
        WHERE user_id = ? AND first_order_at IS NULL`,
    ).bind(orderRef != null ? String(orderRef).slice(0, 60) : null, uid).run()
  } catch { /* fail-soft */ }
}

// ── 🎯 2026-10-15 비로그인 전환 이벤트 ───────────────────────────────────
//   가입 귀속(user_acquisition)은 **로그인한 사람**만 잡힌다. 소개 파트너 신청(/creators/apply)은
//   비로그인 공개 폼이라 그 사슬에 안 걸려서, 소셜 글이 신청을 몇 건 만들었는지 셀 방법이 없었다.
//   ⇒ 전환 순간 first-touch 소스를 한 줄 남긴다. 개인정보는 싣지 않는다(소스·종류·시각뿐).

export const CONVERSION_KINDS = ['creator_apply', 'store_apply'] as const
export type ConversionKind = typeof CONVERSION_KINDS[number]

const _convEnsured = new WeakSet<D1Database>()
export async function ensureConversionTable(DB: D1Database): Promise<void> {
  if (_convEnsured.has(DB)) return
  _convEnsured.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS acquisition_conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        src TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run()
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_acq_conv_src ON acquisition_conversions(src, kind)').run().catch(() => {})
  } catch { /* exists */ }
  await addUtmColumns(DB, 'acquisition_conversions')
}

/** fail-soft — 전환 기록이 실패해도 본 동작(신청 접수)은 절대 막지 않는다. 소스가 무효면 아무것도 안 한다. */
export async function recordAcquisitionConversion(DB: D1Database, rawSrc: unknown, kind: ConversionKind, utm: AcqUtm = {}): Promise<void> {
  try {
    const src = normalizeAcqSource(rawSrc)
    if (!src || !(CONVERSION_KINDS as readonly string[]).includes(kind)) return
    await ensureConversionTable(DB)
    await DB.prepare('INSERT INTO acquisition_conversions (src, kind, utm_campaign, utm_content) VALUES (?, ?, ?, ?)')
      .bind(src, kind, normalizeAcqSource(utm.campaign), normalizeAcqSource(utm.content)).run()
  } catch { /* fail-soft */ }
}

/**
 * env 를 받는 판 — **메인 D1** 에 쓴다는 결정을 이 한 곳에 둔다. 유어애즈 리드 DB 를 함께 쓰는 라우트
 * (`influencer-apply.routes`)가 `env.DB` 를 직접 만지지 않게 하려는 것이다(`ads-leads-db.test` R1 —
 * 리드 테이블을 만지는 파일에서 맨 `env.DB` 는 "리드 DB 를 잘못 고른 것" 과 구분이 안 된다).
 */
export async function recordAcquisitionConversionMain(env: { DB: D1Database }, rawSrc: unknown, kind: ConversionKind, utm: AcqUtm = {}): Promise<void> {
  await recordAcquisitionConversion(env.DB, rawSrc, kind, utm)
}

/**
 * 📣 2026-10-19 주간 SNS 리포트용 UTM 집계 — 소스(플랫폼)×캠페인(카테고리) 별 랜딩·가입·입점 신청·크리에이터 신청.
 * 집계 숫자만(개인정보 없음). utm_campaign 이 있는 행만 센다(봇 글이 아닌 유입은 빠진다).
 */
export const UTM_REPORT_SQL = {
  landings: `SELECT src, utm_campaign AS campaign, COUNT(*) AS n FROM acquisition_landings
              WHERE utm_campaign IS NOT NULL AND datetime(created_at) >= datetime('now', ?) GROUP BY src, utm_campaign`,
  signups: `SELECT src, utm_campaign AS campaign, COUNT(*) AS n FROM user_acquisition
             WHERE utm_campaign IS NOT NULL AND datetime(claimed_at) >= datetime('now', ?) GROUP BY src, utm_campaign`,
  storeApplies: `SELECT src, utm_campaign AS campaign, COUNT(*) AS n FROM acquisition_conversions
                  WHERE kind = 'store_apply' AND utm_campaign IS NOT NULL AND datetime(created_at) >= datetime('now', ?) GROUP BY src, utm_campaign`,
  creatorApplies: `SELECT src, utm_campaign AS campaign, COUNT(*) AS n FROM acquisition_conversions
                    WHERE kind = 'creator_apply' AND utm_campaign IS NOT NULL AND datetime(created_at) >= datetime('now', ?) GROUP BY src, utm_campaign`,
} as const

export interface UtmReportRow { source: string; campaign: string; landings: number; signups: number; store_applies: number; creator_applies: number }

/** 순수 — 네 집계를 (source, campaign) 한 표로. */
export function mergeUtmReport(parts: Record<keyof typeof UTM_REPORT_SQL, Array<{ src: string; campaign: string; n: number }>>): UtmReportRow[] {
  const map = new Map<string, UtmReportRow>()
  const field = { landings: 'landings', signups: 'signups', storeApplies: 'store_applies', creatorApplies: 'creator_applies' } as const
  for (const [k, rows] of Object.entries(parts) as Array<[keyof typeof field, Array<{ src: string; campaign: string; n: number }>]>) {
    for (const r of rows) {
      const key = `${r.src}|${r.campaign}`
      let row = map.get(key)
      if (!row) { row = { source: r.src, campaign: r.campaign, landings: 0, signups: 0, store_applies: 0, creator_applies: 0 }; map.set(key, row) }
      row[field[k]] += Number(r.n) || 0
    }
  }
  return [...map.values()].sort((a, b) => a.campaign.localeCompare(b.campaign) || a.source.localeCompare(b.source))
}

export async function loadUtmReport(DB: D1Database, days: number): Promise<UtmReportRow[]> {
  await ensureAcquisitionTables(DB)
  await ensureConversionTable(DB)
  const since = `-${Math.max(1, Math.min(90, Math.floor(days) || 7))} days`
  const q = async (sql: string) =>
    (await DB.prepare(sql).bind(since).all<{ src: string; campaign: string; n: number }>().catch(() => ({ results: [] as Array<{ src: string; campaign: string; n: number }> }))).results || []
  const [landings, signups, storeApplies, creatorApplies] = await Promise.all([
    q(UTM_REPORT_SQL.landings), q(UTM_REPORT_SQL.signups), q(UTM_REPORT_SQL.storeApplies), q(UTM_REPORT_SQL.creatorApplies),
  ])
  return mergeUtmReport({ landings, signups, storeApplies, creatorApplies })
}

/** 리포트 토큰 비교 — 길이 노출 외 상수 시간. 토큰 미설정이면 늘 false(엔드포인트 닫힘). */
export function reportTokenOk(expected: string | undefined, header: string | undefined | null): boolean {
  if (!expected || expected.length < 16) return false
  const got = String(header || '').replace(/^Bearer\s+/i, '')
  if (got.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
