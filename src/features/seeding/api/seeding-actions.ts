/**
 * 🎁 무상 체험 제공 — 상태 전이 동작 (사장님 화면 · 어드민 대행이 **같은 함수**를 부른다)
 *
 * 두 벌이면 어드민이 대신 승인한 신청과 사장님이 직접 승인한 신청의 뒷일이 갈린다(알림·발급·반환).
 * 모든 전이는 `transition()` CAS 를 먼저 잡고, 잡혔을 때만 돈(신청권)·이용권·알림을 움직인다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import {
  PENALTY_LABEL, SEEDING_TPL, kstWall, msgApproved, msgPenalty, msgRejected, msgRequestStore, msgScheduled,
  penaltyBlockDays, type SeedingPlatform,
} from '../../../shared/seeding'
import { addPenalty, loadOffer, penaltyState, refundPass, transition } from './seeding-db'
import { toInfluencer, toStore } from './seeding-notify'
import { issueExperienceVoucher } from '../../group-buy/api/experience-campaign.routes'

export interface AppRow {
  id: number; product_id: number; seller_id: number | null; user_id: number; platform: SeedingPlatform
  sns_username: string | null; follower_count: number | null; status: string; visit_slots: string | null
  visit_at: string | null; voucher_id: number | null; post_deadline: string | null; post_url: string | null
  product_name: string | null; store_name: string | null
}

export const APP_SELECT = `SELECT a.id, a.product_id, a.seller_id, a.user_id, a.platform, a.sns_username, a.follower_count,
  a.status, a.visit_slots, a.visit_at, a.voucher_id, a.post_deadline, a.post_url, a.created_at, a.updated_at,
  p.name AS product_name, COALESCE(NULLIF(p.restaurant_name, ''), s.business_name, s.name) AS store_name
  FROM seeding_applications a LEFT JOIN products p ON p.id = a.product_id LEFT JOIN sellers s ON s.id = a.seller_id`

export async function loadApp(DB: D1Database, id: number): Promise<AppRow | null> {
  return DB.prepare(`${APP_SELECT} WHERE a.id = ?`).bind(id).first<AppRow>().catch(() => null)
}

type Ok = { ok: true } | { ok: false; error: string; status: 400 | 404 | 409 }
const stale: Ok = { ok: false, error: '이미 처리됐거나 지금 할 수 없는 상태예요', status: 409 }
const labels = (a: AppRow) => ({ store: a.store_name || '매장', product: a.product_name || '이용권' })

/** 운영자 확인 → 사장님께 보내기. */
export async function sendToStore(env: unknown, DB: D1Database, a: AppRow): Promise<Ok> {
  if (!(await transition(DB, a.id, ['pending'], 'sent', { sent_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }))) return stale
  await toStore(env, DB, { sellerId: a.seller_id, productId: a.product_id, appId: a.id }, SEEDING_TPL.requestStore,
    msgRequestStore({ ...labels(a), platform: a.platform, followers: Number(a.follower_count) || 0, handle: a.sns_username || '-' }),
    '무상 체험 신청이 도착했어요')
  return { ok: true }
}

/** 사장님(또는 운영자 대행) 승인/거절. */
export async function respond(env: unknown, DB: D1Database, a: AppRow, decision: 'approve' | 'reject'): Promise<Ok> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  if (decision === 'approve') {
    if (!(await transition(DB, a.id, ['pending', 'sent'], 'approved', { decided_at: now }))) return stale
    await toInfluencer(env, DB, { userId: a.user_id, appId: a.id }, SEEDING_TPL.approved, msgApproved(labels(a)), '무상 체험이 승인됐어요')
  } else {
    if (!(await transition(DB, a.id, ['pending', 'sent'], 'rejected', { decided_at: now }))) return stale
    await toInfluencer(env, DB, { userId: a.user_id, appId: a.id }, SEEDING_TPL.rejected, msgRejected(labels(a)), '무상 체험 신청 결과')
  }
  return { ok: true }
}

/** 게시 기한 = 방문일 + N일(KST 날짜). */
function deadlineFrom(visitAt: string, days: number): string {
  const d = new Date(`${visitAt.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 사장님(또는 대행)이 희망 일정 하나를 확정 → 0원 체험 이용권 발급. */
export async function pickSlot(env: unknown, DB: D1Database, a: AppRow, slot: string): Promise<Ok> {
  const slots: string[] = (() => { try { return JSON.parse(a.visit_slots || '[]') } catch { return [] } })()
  if (!slots.includes(slot)) return { ok: false, error: '인플루언서가 낸 일정 중에서 골라 주세요', status: 400 }
  const offer = await loadOffer(DB, a.product_id)
  const deadline = deadlineFrom(slot, offer?.post_deadline_days ?? 7)
  if (!(await transition(DB, a.id, ['scheduling'], 'scheduled', { visit_at: slot, post_deadline: deadline }))) return stale
  const voucherId = await issueExperienceVoucher(DB, { id: a.id, seller_id: Number(a.seller_id) || 0, product_id: a.product_id }, String(a.user_id), 'SEED')
  if (voucherId) {
    await DB.prepare(`UPDATE seeding_applications SET voucher_id = ? WHERE id = ?`).bind(voucherId, a.id).run().catch(() => null)
  } else {
    // 발급 실패를 숨기지 않는다 — 운영자가 어드민에서 다시 발급할 수 있게 표시만 남긴다.
    await DB.prepare(`UPDATE seeding_applications SET admin_note = '체험 이용권 발급 실패 — 재발급 필요' WHERE id = ?`).bind(a.id).run().catch(() => null)
  }
  await toInfluencer(env, DB, { userId: a.user_id, appId: a.id }, SEEDING_TPL.scheduled, msgScheduled({
    ...labels(a), visitAt: kstWall(slot), deadline, requirement: offer?.post_requirement || '방문 후 게시물 1개',
  }), '체험 방문이 확정됐어요')
  return { ok: true }
}

/** 아직 안 쓴 0원 체험 이용권 회수 — 쓴 것은 건드리지 않는다. */
async function revokeVoucher(DB: D1Database, voucherId: number | null): Promise<void> {
  if (!voucherId) return
  await DB.prepare(`UPDATE vouchers SET status = 'expired' WHERE id = ? AND status = 'unused' AND COALESCE(is_experience, 0) = 1`)
    .bind(voucherId).run().catch(() => null)
}

/** 사장님 사정으로 취소 — 보증금(신청권) 반환 + 이용권 회수. */
export async function storeCancel(DB: D1Database, a: AppRow): Promise<Ok> {
  if (!(await transition(DB, a.id, ['approved', 'scheduling', 'scheduled'], 'store_cancelled'))) return stale
  await refundPass(DB, a.user_id, a.id, '매장 사정으로 취소 — 보증금 반환').catch(() => false)
  await revokeVoucher(DB, a.voucher_id)
  return { ok: true }
}

/**
 * 인플루언서 취소.
 *  - 일정 확정 전(신청~일정 제출): 신청권 반환
 *  - 일정 확정 후: 보증금은 돌려주지 않는다(그게 노쇼 방지 보증금의 뜻이다) · 이용권 회수
 */
export async function influencerCancel(DB: D1Database, a: AppRow): Promise<Ok & { refunded?: boolean }> {
  if (!(await transition(DB, a.id, ['pending', 'sent', 'approved', 'scheduling', 'scheduled'], 'cancelled'))) return stale
  let refunded = false
  if (a.status === 'scheduling') refunded = await refundPass(DB, a.user_id, a.id, '일정 확정 전 취소 — 보증금 반환').catch(() => false)
  if (a.status === 'scheduled') await revokeVoucher(DB, a.voucher_id)
  return { ok: true, refunded }
}

/** 패널티 기록 + 알림. 같은 신청은 한 번만. */
async function penalize(env: unknown, DB: D1Database, a: AppRow, reason: 'no_show' | 'post_missed'): Promise<void> {
  const added = await addPenalty(DB, a.user_id, a.id, reason)
  if (!added) return
  const st = await penaltyState(DB, a.user_id)
  const days = penaltyBlockDays(st.strikes)
  const blockedText = days ? `${days}일 동안 무상 체험 신청이 제한됩니다(경고 ${st.strikes}회)` : `경고 ${st.strikes}회 — 다음부터는 신청이 제한될 수 있습니다`
  await toInfluencer(env, DB, { userId: a.user_id, appId: a.id }, SEEDING_TPL.penalty,
    msgPenalty({ store: a.store_name || '매장', reason: PENALTY_LABEL[reason], blockedText }), '체험 이용 안내')
}

/** 노쇼 — 사장님 신고 또는 운영자. 보증금은 돌려주지 않는다. */
export async function markNoShow(env: unknown, DB: D1Database, a: AppRow): Promise<Ok> {
  if (!(await transition(DB, a.id, ['scheduled'], 'no_show'))) return stale
  await revokeVoucher(DB, a.voucher_id)
  await penalize(env, DB, a, 'no_show')
  return { ok: true }
}

/** 게시 기한이 지남(cron). */
export async function markPostMissed(env: unknown, DB: D1Database, a: AppRow): Promise<Ok> {
  if (!(await transition(DB, a.id, ['scheduled'], 'post_missed'))) return stale
  await penalize(env, DB, a, 'post_missed')
  return { ok: true }
}
