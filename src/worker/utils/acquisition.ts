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
}

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

export const CONVERSION_KINDS = ['creator_apply'] as const
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
}

/** fail-soft — 전환 기록이 실패해도 본 동작(신청 접수)은 절대 막지 않는다. 소스가 무효면 아무것도 안 한다. */
export async function recordAcquisitionConversion(DB: D1Database, rawSrc: unknown, kind: ConversionKind): Promise<void> {
  try {
    const src = normalizeAcqSource(rawSrc)
    if (!src || !(CONVERSION_KINDS as readonly string[]).includes(kind)) return
    await ensureConversionTable(DB)
    await DB.prepare('INSERT INTO acquisition_conversions (src, kind) VALUES (?, ?)').bind(src, kind).run()
  } catch { /* fail-soft */ }
}
