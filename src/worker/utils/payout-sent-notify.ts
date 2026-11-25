/**
 * 📣 정산 송금 완료 알림 — 건별 완료와 일괄 완료가 **같은 길**로 알린다 (2026-11-25 대표 *"나머지 빠짐없이 모두 해줘야지."*)
 *
 * 종전: 건별 '송금 완료' 만 알림톡을 보냈고 일괄 완료는 아무에게도 알리지 않았다. 건별도 매장은 `sellers.phone`(매장 대표번호)
 *   으로 보냈는데 그 칸은 대부분 유선 번호라 알림톡이 조용히 건너뛰어졌다(라이브 13곳 중 12곳 — `seller-notify-phone.ts`).
 * 지금: 매장은 담당자 휴대폰(`resolveSellerNotifyTarget`)으로 보내고, 번호가 없어도 **사장님 알림함**에는 남긴다.
 *
 * 실패해도 본 동작(장부 마감)을 막지 않는다. 계좌번호는 끝 4자리만 적는다.
 */
import { resolveSellerNotifyTarget, toMobile } from './seller-notify-phone'
import { sendSystemAlimtalk } from '../../lib/system-alimtalk'

export interface PayoutSentInfo {
  payee_type: string
  payee_id: string | number
  amount: number
  bank_name?: string | null
  account_number?: string | null
}

const maskAccount = (acc?: string | null) => (acc && acc.length >= 4 ? `****${acc.slice(-4)}` : (acc || ''))

export function payoutSentMessage(name: string | null, row: PayoutSentInfo, txId: string): string {
  return `[유어딜] 정산 송금 완료\n${name || ''} 님 ${Number(row.amount).toLocaleString('ko-KR')}원이 ${row.bank_name || ''} ${maskAccount(row.account_number)} 계좌로 입금되었습니다.\nTX: ${txId}`
}

/** 받는 사람의 알림 번호와 이름. 매장은 담당자 휴대폰 우선, 유선 번호는 돌려주지 않는다. */
export async function resolvePayoutRecipient(DB: D1Database, row: PayoutSentInfo): Promise<{ phone: string | null; name: string | null; sellerId: number | null }> {
  if (row.payee_type === 'seller' || row.payee_type === 'store_owner') {
    const t = await resolveSellerNotifyTarget(DB, row.payee_id).catch(() => null)
    return { phone: t?.phone ?? null, name: t?.businessName ?? t?.name ?? null, sellerId: Number(row.payee_id) || null }
  }
  if (row.payee_type === 'user') {
    const r = await DB.prepare('SELECT phone, name FROM users WHERE id = ?').bind(row.payee_id).first<{ phone: string | null; name: string | null }>().catch(() => null)
    return { phone: toMobile(r?.phone), name: r?.name ?? null, sellerId: null }
  }
  if (row.payee_type === 'agency') {
    const r = await DB.prepare('SELECT phone, name FROM agencies WHERE id = ?').bind(row.payee_id).first<{ phone: string | null; name: string | null }>().catch(() => null)
    return { phone: toMobile(r?.phone), name: r?.name ?? null, sellerId: null }
  }
  return { phone: null, name: null, sellerId: null }
}

/** 송금 완료 한 건을 알린다 — 알림톡(번호가 있을 때) + 사장님 알림함(매장일 때). 무엇을 했는지 돌려준다(시험이 본다). */
export async function notifyPayoutSent(
  env: Record<string, unknown>, DB: D1Database, row: PayoutSentInfo, txId: string,
): Promise<{ alimtalk: boolean; bell: boolean }> {
  const out = { alimtalk: false, bell: false }
  try {
    const who = await resolvePayoutRecipient(DB, row)
    if (who.sellerId) {
      const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
      await createDashboardNotification(DB, 'seller', String(who.sellerId), 'payout_sent',
        `💸 정산 ${Number(row.amount).toLocaleString('ko-KR')}원을 보냈어요`, `${row.bank_name || ''} ${maskAccount(row.account_number)} 계좌로 입금했어요.`, '/seller/payouts')
        .then(() => { out.bell = true }).catch(() => undefined)
    }
    if (who.phone) {
      await sendSystemAlimtalk(env, who.phone, 'payout_completed', payoutSentMessage(who.name, row, txId))
      out.alimtalk = true
    }
  } catch (e) { if ((env as { ENVIRONMENT?: string }).ENVIRONMENT !== 'production') console.warn('[payout-sent-notify]', e) /* 알림이 장부 마감을 막지 않는다 */ }
  return out
}
