/**
 * 🤝 파트너 매장 소개(리퍼럴) 접수·추적 — 격리 테이블 `ad_partner_referrals` (2026-07-27 대표 "모두 진행").
 *   파트너(대행사·POS·식자재상 등)가 소개한 매장을 기록하고 입점 여부를 추적 — 리퍼럴 프로그램의 접수함.
 *
 *   ⚠️ **머니 무접촉(의도된 반쪽)**: 커미션 *지급* 배선은 머니 룰(claim-before-credit·역전 대칭·스테이징
 *   실결제 검증) 대상이라 **별도 세션**에서 기존 커미션 축(영입 커미션)에 연결한다. 여기는 접수/추적만 —
 *   지급액·원장 컬럼을 아예 두지 않아 우회 지급이 구조적으로 불가능(커미션 예산 아비터 [INV-CB] 존중).
 */

export const REFERRAL_STATUSES = ['new', 'contacted', 'onboarded', 'rejected'] as const

export interface ReferralRow {
  id: number; partner_lead_id: number | null; partner_name: string
  store_name: string; region: string | null; phone: string | null; memo: string | null
  status: string; created_at: string
}

const _done = new WeakSet<object>()
export async function ensureReferralSchema(DB: D1Database): Promise<void> {
  if (_done.has(DB)) return
  _done.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_partner_referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partner_lead_id INTEGER,
    partner_name TEXT NOT NULL,
    store_name TEXT NOT NULL,
    region TEXT,
    phone TEXT,
    memo TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_partner_referrals_status ON ad_partner_referrals(status, id)').run().catch(() => null)
}

export async function addReferral(DB: D1Database, r: { partner_lead_id?: number | null; partner_name: string; store_name: string; region?: string | null; phone?: string | null; memo?: string | null }): Promise<{ ok: boolean; error?: string }> {
  await ensureReferralSchema(DB)
  const partner = (r.partner_name || '').trim().slice(0, 120)
  const store = (r.store_name || '').trim().slice(0, 120)
  if (partner.length < 2 || store.length < 2) return { ok: false, error: '파트너명·매장명을 입력하세요' }
  const pid = Number(r.partner_lead_id)
  await DB.prepare('INSERT INTO ad_partner_referrals (partner_lead_id, partner_name, store_name, region, phone, memo) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(Number.isFinite(pid) && pid > 0 ? pid : null, partner, store,
      (r.region || '').trim().slice(0, 60) || null, (r.phone || '').trim().slice(0, 40) || null, (r.memo || '').trim().slice(0, 300) || null)
    .run().catch(() => null)
  return { ok: true }
}

export async function listReferrals(DB: D1Database, limit = 100): Promise<ReferralRow[]> {
  await ensureReferralSchema(DB)
  const r = await DB.prepare(
    `SELECT id, partner_lead_id, partner_name, store_name, region, phone, memo, status, created_at
     FROM ad_partner_referrals ORDER BY (CASE WHEN status = 'new' THEN 0 ELSE 1 END), id DESC LIMIT ?`)
    .bind(Math.min(300, Math.max(10, limit))).all<ReferralRow>().catch(() => null)
  return r?.results || []
}

export async function updateReferralStatus(DB: D1Database, id: number, status: string): Promise<{ ok: boolean; error?: string }> {
  await ensureReferralSchema(DB)
  if (!(REFERRAL_STATUSES as readonly string[]).includes(status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
  const r = await DB.prepare('UPDATE ad_partner_referrals SET status = ? WHERE id = ?').bind(status, id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '소개 건을 찾을 수 없습니다' }
  return { ok: true }
}
