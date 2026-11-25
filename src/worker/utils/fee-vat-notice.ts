/**
 * 📣 수수료 부가세 별도 — 시작 전 매장 사전 안내 (2026-11-25 대표 *"1번 부가세 별도로 하자. 그렇게 구현도 해줘"*)
 *
 * 판매자 약관 제(거래조건 변경) 조항: 판매자에게 불리한 변경은 **시행 30일 전 고지**. 시작일(기본 2027-01-01)
 * 전까지 매일 돌며, 승인된 매장마다 **한 번씩** 마이 '내 가게' 알림을 보낸다(그 사이 새로 승인된 매장도 받는다).
 *
 * 멱등: `fee_vat_notices(seller_id, from_date)` UNIQUE + `INSERT OR IGNORE` — 선점에 성공한 쪽만 알림.
 * 시작일이 지났거나 꺼져 있으면(`off`) 아무것도 안 한다. 돈을 옮기지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { FEE_VAT_FROM_KEY, feeVatApplies, resolveFeeVatFrom } from '../../shared/fee-vat'

/** 순수 — 알림 문장. */
export function feeVatNoticeMessage(from: string): { title: string; message: string } {
  const [y, m, d] = from.split('-').map(Number)
  const when = `${y}년 ${m}월 ${d}일`
  return {
    title: `🧾 ${when}부터 수수료는 부가세 별도입니다`,
    message: `${when} 이후 사용된 이용권부터 수수료에 부가세(수수료의 10%)가 더해져 정산금에서 함께 빠집니다. 유어딜이 매달 수수료 세금계산서를 발행하므로, 일반과세 매장은 부가세 신고 때 그 부가세를 공제받습니다(실부담은 수수료율 그대로). 수수료율은 바뀌지 않습니다.`,
  }
}

export async function sendFeeVatNotices(DB: D1Database, nowMs: number = Date.now()): Promise<{ sent: number; skipped: string | null }> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ? LIMIT 1')
    .bind(FEE_VAT_FROM_KEY).first<{ value: string }>().catch(() => null)
  const from = resolveFeeVatFrom(row?.value)
  if (!from) return { sent: 0, skipped: 'off' }
  if (feeVatApplies(nowMs, from)) return { sent: 0, skipped: 'started' }

  await DB.prepare(`CREATE TABLE IF NOT EXISTS fee_vat_notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    from_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_vat_notices_seller_from ON fee_vat_notices(seller_id, from_date)').run()

  const { results } = await DB.prepare(
    `SELECT s.id FROM sellers s
      WHERE s.status = 'approved'
        AND NOT EXISTS (SELECT 1 FROM fee_vat_notices n WHERE n.seller_id = s.id AND n.from_date = ?)
      ORDER BY s.id LIMIT 300`,
  ).bind(from).all<{ id: number }>()
  const msg = feeVatNoticeMessage(from)
  const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
  let sent = 0
  for (const r of results || []) {
    const sellerId = Number(r.id)
    if (!Number.isInteger(sellerId) || sellerId <= 0) continue
    // 선점이 먼저 — 알림은 선점에 성공한 쪽만(재실행해도 한 장).
    const ins = await DB.prepare('INSERT OR IGNORE INTO fee_vat_notices (seller_id, from_date) VALUES (?, ?)')
      .bind(sellerId, from).run()
    if (!ins.meta?.changes) continue
    await createDashboardNotification(DB, 'seller', String(sellerId), 'fee_vat_notice', msg.title, msg.message, '/seller/settlements')
      .catch((e) => console.error('[fee-vat-notice] notify failed', e))
    sent++
  }
  return { sent, skipped: null }
}
