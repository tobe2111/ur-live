/**
 * 🤝💰 에이전시 소개비 계약 — 총 마케팅 비용 상한 안에서 (2026-11-11 대표 확정 *"응 그걸로 확정하고 진행해줘"* → *"계속 진행해"*)
 *   결재 `docs/decisions/2026-11-11-agency-share-auto-split.md` 후속 절 ⑤.
 *
 * ## 규칙
 * - 에이전시 수수료와 소개비는 **따로** 받는다. 대신 둘의 합이 사장님이 동의한 **총 마케팅 비용 상한**을 못 넘는다.
 * - 에이전시가 인플루언서(유어샵 아이디)에게 소개비 % 를 건다 →
 *     수수료 + % ≤ 상한  ⇒ **바로 발효**(`active`)
 *     넘거나 상한 미정    ⇒ **사장님 승인 대기**(`pending_owner`) + 사장님께 앱 알림 · 알림톡(카카오 검수 전엔 앱 알림만)
 * - 계약은 **그 에이전시가 맡은 이용권에만** 붙는다(가게 전체가 아니다 — 사장님·다른 에이전시 이용권엔 안 붙는다).
 * - 정산 때 상한을 다시 본다: 사장님이 나중에 상한을 낮추면, 사장님이 따로 승인하지 않은 계약은 **남는 폭까지만** 붙는다.
 *
 * ## 🔴 스위치 뒤 — `agency_influencer_deals_enabled`(기본 OFF)
 * 머니 경로(소개비 적립)라 단독 세션 + staging 실결제(S-AGENCYDEAL) 뒤에 대표가 켠다. OFF 면 만들기 API 가 403 이고
 * 정산 함수는 null(= 종전 동작, 가게 단위 계약만)이다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { ensureAgencyConsoleTables } from './agency-schema'
import { AGENCY_SHARE_PCT_MAX, currentBudgetPctSql, currentSharePctSql } from './agency-share'
import { findActiveDealPct } from '../../../worker/utils/influencer-deal'

export const AGENCY_DEAL_GATE = 'agency_influencer_deals_enabled'
/** 알림톡 템플릿 이름 — 카카오 검수 후 어드민 `alimtalk_approved_templates` 에 적으면 나간다. 문안: docs/alimtalk-register-list.md */
export const AGENCY_DEAL_TPL = 'agency_deal_approval'

export type AgencyDealStatus = 'active' | 'pending_owner' | 'rejected' | 'ended'

export async function isAgencyDealsEnabled(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ? LIMIT 1')
    .bind(AGENCY_DEAL_GATE).first<{ value: string }>().catch(() => null)
  return String(row?.value) === 'true'
}

const _ensured = new WeakSet<object>()
export async function ensureAgencyDealTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  await ensureAgencyConsoleTables(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agency_influencer_deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    agency_id INTEGER NOT NULL,
    influencer_id TEXT NOT NULL,
    pct REAL NOT NULL,
    status TEXT NOT NULL,
    owner_approved INTEGER NOT NULL DEFAULT 0,
    proposed_by_staff_id INTEGER,
    decided_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT
  )`).run()
  // 한 (매장, 에이전시, 인플루언서) 에 열린 계약은 하나 — 동시에 두 번 눌러도 둘째는 막힌다(머니 룰 #3).
  await DB.prepare(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_deals_open ON agency_influencer_deals(seller_id, agency_id, influencer_id) WHERE status IN ('active','pending_owner')",
  ).run()
  _ensured.add(DB)
}

/** 상한 판정 — 순수 함수. 상한을 정하지 않았으면(0) 언제나 사장님 승인. */
export function fitsBudget(feePct: number, budgetPct: number, dealPct: number): boolean {
  if (!(budgetPct > 0)) return false
  return Math.round((feePct + dealPct) * 10) <= Math.round(budgetPct * 10)
}

/** 정산 때 쓸 % — 사장님이 승인한 계약은 그대로, 아니면 상한에서 수수료를 뺀 폭까지만. */
export function capDealPct(dealPct: number, feePct: number, budgetPct: number, ownerApproved: boolean): number {
  if (!(dealPct > 0)) return 0
  if (ownerApproved) return Math.min(dealPct, AGENCY_SHARE_PCT_MAX)
  if (!(budgetPct > 0)) return 0
  return Math.max(0, Math.min(dealPct, budgetPct - feePct))
}

async function feeAndBudget(DB: D1Database, sellerId: number, agencyId: number): Promise<{ fee: number; budget: number }> {
  const r = await DB.prepare(
    `SELECT ${currentSharePctSql('?', '?')} AS fee, ${currentBudgetPctSql('?', '?')} AS budget`,
  ).bind(sellerId, agencyId, sellerId, agencyId).first<{ fee: number | null; budget: number | null }>().catch(() => null)
  return { fee: Number(r?.fee) || 0, budget: Number(r?.budget) || 0 }
}

export type ProposeResult =
  | { ok: true; id: number; status: 'active' | 'pending_owner'; fee: number; budget: number }
  | { ok: false; status: 400 | 403 | 404 | 409; code: string; error: string }

/** 에이전시가 소개비를 건다. 호출부가 "이 직원이 이 매장을 맡았나" 를 먼저 확인한다. */
export async function proposeAgencyDeal(
  DB: D1Database,
  p: { sellerId: number; agencyId: number; staffId: number; influencerUserId: number; pct: number },
): Promise<ProposeResult> {
  if (!(await isAgencyDealsEnabled(DB))) return { ok: false, status: 403, code: 'FEATURE_OFF', error: '아직 열리지 않은 기능이에요.' }
  if (!Number.isFinite(p.pct) || p.pct <= 0 || p.pct > AGENCY_SHARE_PCT_MAX) {
    return { ok: false, status: 400, code: 'BAD_PCT', error: `소개비는 0 초과 ~ ${AGENCY_SHARE_PCT_MAX}% 사이로 적어 주세요.` }
  }
  await ensureAgencyDealTables(DB)
  const user = await DB.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').bind(p.influencerUserId).first<{ id: number }>().catch(() => null)
  if (!user) return { ok: false, status: 404, code: 'NO_USER', error: '그 유어샵을 찾지 못했어요.' }
  const { fee, budget } = await feeAndBudget(DB, p.sellerId, p.agencyId)
  const status: 'active' | 'pending_owner' = fitsBudget(fee, budget, p.pct) ? 'active' : 'pending_owner'
  const pct = Math.round(p.pct * 10) / 10
  const ins = await DB.prepare(
    `INSERT OR IGNORE INTO agency_influencer_deals (seller_id, agency_id, influencer_id, pct, status, proposed_by_staff_id, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'active' THEN datetime('now') ELSE NULL END)`,
  ).bind(p.sellerId, p.agencyId, String(p.influencerUserId), pct, status, p.staffId, status).run()
  if ((ins.meta?.changes ?? 0) === 0) {
    return { ok: false, status: 409, code: 'ALREADY_OPEN', error: '이 인플루언서와 이미 맺었거나 승인을 기다리는 계약이 있어요. 끝낸 뒤 다시 걸어 주세요.' }
  }
  return { ok: true, id: Number(ins.meta?.last_row_id) || 0, status, fee, budget }
}

/** 사장님 승인/거절 — CAS(대기일 때만). */
export async function decideAgencyDeal(
  DB: D1Database, p: { sellerId: number; dealId: number; approve: boolean; userId: number },
): Promise<boolean> {
  await ensureAgencyDealTables(DB)
  const r = await DB.prepare(
    `UPDATE agency_influencer_deals
        SET status = ?, owner_approved = ?, decided_by_user_id = ?, decided_at = datetime('now')
      WHERE id = ? AND seller_id = ? AND status = 'pending_owner'`,
  ).bind(p.approve ? 'active' : 'rejected', p.approve ? 1 : 0, p.userId, p.dealId, p.sellerId).run()
  return (r.meta?.changes ?? 0) > 0
}

/** 끝내기 — 에이전시(자기 계약) 또는 사장님(자기 매장 계약). 끝낸 다음 판매부터 안 붙는다. */
export async function endAgencyDeal(
  DB: D1Database, p: { dealId: number; sellerId: number; agencyId?: number },
): Promise<boolean> {
  await ensureAgencyDealTables(DB)
  const r = await DB.prepare(
    `UPDATE agency_influencer_deals SET status = 'ended', decided_at = datetime('now')
      WHERE id = ? AND seller_id = ? ${p.agencyId ? 'AND agency_id = ?' : ''} AND status IN ('active','pending_owner')`,
  ).bind(...(p.agencyId ? [p.dealId, p.sellerId, p.agencyId] : [p.dealId, p.sellerId])).run()
  return (r.meta?.changes ?? 0) > 0
}

export interface AgencyDealRow {
  id: number; seller_id: number; agency_id: number; influencer_id: string; pct: number; status: AgencyDealStatus
  owner_approved: number; created_at: string; decided_at: string | null; handle: string | null; influencer_name: string | null
  agency_name?: string | null
}

export async function listAgencyDeals(
  DB: D1Database, where: { sellerId: number; agencyId?: number },
): Promise<AgencyDealRow[]> {
  await ensureAgencyDealTables(DB)
  const { results } = await DB.prepare(
    `SELECT d.id, d.seller_id, d.agency_id, d.influencer_id, d.pct, d.status, d.owner_approved, d.created_at, d.decided_at,
            u.handle AS handle, u.name AS influencer_name, a.name AS agency_name
       FROM agency_influencer_deals d
       LEFT JOIN users u ON CAST(u.id AS TEXT) = d.influencer_id
       LEFT JOIN agency_accounts a ON a.id = d.agency_id
      WHERE d.seller_id = ? ${where.agencyId ? 'AND d.agency_id = ?' : ''} AND d.status IN ('active','pending_owner')
      ORDER BY d.id DESC LIMIT 100`,
  ).bind(...(where.agencyId ? [where.sellerId, where.agencyId] : [where.sellerId])).all<AgencyDealRow>()
  return results || []
}

/**
 * 💰 정산 SSOT — 이 판매에 붙을 **에이전시 소개비 %**. 없으면 null(호출부는 종전대로 가게 단위 계약을 본다).
 *   ① 스위치 ON ② 이 이용권을 지금 맡은 에이전시가 있고(맡은 기간 + 맡김 active) ③ 그 에이전시가 이 인플루언서와 active 계약
 *   ④ 상한 재확인(사장님 승인 계약은 그대로, 아니면 상한 − 수수료 까지). 실패는 null(= 종전 동작 — 지어내지 않는다).
 */
export async function agencyDealPctForSale(
  DB: D1Database, sellerId: number, productId: number, influencerId: string | number | null | undefined,
): Promise<number | null> {
  const inf = String(influencerId ?? '').trim()
  if (!inf || !(sellerId > 0) || !(productId > 0)) return null
  try {
    if (!(await isAgencyDealsEnabled(DB))) return null
    const row = await DB.prepare(
      `SELECT d.pct, d.owner_approved, d.agency_id
         FROM agency_product_periods pr
         JOIN agency_store_links l ON l.seller_id = pr.seller_id AND l.agency_id = pr.agency_id AND l.status = 'active'
         JOIN agency_influencer_deals d ON d.seller_id = pr.seller_id AND d.agency_id = pr.agency_id
                                       AND d.influencer_id = ? AND d.status = 'active'
        WHERE pr.product_id = ? AND pr.seller_id = ? AND pr.ended_at IS NULL
        LIMIT 1`,
    ).bind(inf, productId, sellerId).first<{ pct: number; owner_approved: number; agency_id: number }>()
    if (!row) return null
    const { fee, budget } = await feeAndBudget(DB, sellerId, Number(row.agency_id))
    const pct = capDealPct(Number(row.pct) || 0, fee, budget, Number(row.owner_approved) === 1)
    return pct > 0 ? pct : null
  } catch {
    return null
  }
}

/**
 * 🎁 표시 전용 — 이용권 상세 "내 링크로 팔리면 N%". **결제와 같은 순서**: 그 이용권을 맡은 에이전시의 계약 먼저
 *   (스위치 OFF 면 null), 없으면 가게 단위 계약. 갈리면 화면은 0 인데 정산은 붙는다. 이용권 번호가 없으면 가게 단위만.
 */
export async function dealPctForDisplay(DB: D1Database, sellerId: number, productId: number, userId: string): Promise<number | null> {
  const agency = Number.isInteger(productId) && productId > 0 ? await agencyDealPctForSale(DB, sellerId, productId, userId) : null
  return agency ?? await findActiveDealPct(DB, sellerId, userId)
}

/** 알림톡·앱 알림 문안(사장님) — 검수 신청서와 같은 문장이어야 한다(docs/alimtalk-register-list.md). */
export function msgAgencyDealApproval(v: { store: string; agency: string; influencer: string; pct: number; fee: number; budget: number }): string {
  const budgetLine = v.budget > 0 ? `동의하신 총 마케팅 비용 상한: ${v.budget}% (에이전시 수수료 ${v.fee}% 포함)` : '총 마케팅 비용 상한: 정하지 않음'
  return `[유어딜] 소개비 승인 요청\n\n${v.store} 사장님, ${v.agency} 에이전시가 ${v.influencer}님에게 소개비 ${v.pct}%를 제안했어요.\n${budgetLine}\n\n상한을 넘는 제안이라 사장님 승인이 필요해요. 승인하기 전에는 소개비가 붙지 않아요.`
}
