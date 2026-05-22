/**
 * 🛡️ 2026-05-16: 인플루언서 매월 정산 cron — 매월 1일 KST 18시.
 *
 * 1) influencer_attributions 중 status='pending' AND available_at <= now → status='available'
 *    + balance pending → available 전환
 * 2) influencer_balances 중 available_amount >= influencer_payout_min (default 10만원)
 *    인플루언서에게 송금:
 *    - 사업자번호 있음 → 사업소득 3.3% 원천징수
 *    - 사업자번호 없음 → 기타소득 8.8% 원천징수
 *    - 무신고 (수동 등록) → 원천징수 X, dashboard alert
 *
 * NOTE: 실제 송금은 외부 PG (Toss / 페이올드 등) 연동 필요. 이 cron 은 status 전환 + alert 만.
 *       실제 송금 트리거는 어드민 페이지에서 [송금 처리] 수동 클릭 또는 PG 연동 후.
 */

import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'
import { swallow } from '../utils/swallow'

interface InfluencerToPayout {
  influencer_id: string
  available_amount: number
  tax_type: string | null
  business_number: string | null
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
}

const DEFAULT_PAYOUT_MIN = 100_000  // 10만원

export async function handleInfluencerPayout(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return

  try {
    // 1) Pending → Available 전환 (T+7 이상)
    const pendingToAvail = await DB.prepare(`
      UPDATE influencer_attributions
         SET status = 'available'
       WHERE status = 'pending'
         AND available_at IS NOT NULL
         AND available_at <= datetime('now')
    `).run().catch(() => ({ meta: { changes: 0 } }))

    let transitioned = pendingToAvail.meta?.changes ?? 0

    // balance 도 동기화 — 각 인플루언서별 pending 분 중 위에서 available 된 액수만큼 이동
    //   정확히 하려면 위 UPDATE 의 attribution row 별 amount 합산 필요. 간단화: 다시 집계.
    const balanceUpdates = await DB.prepare(`
      SELECT influencer_id, SUM(commission_amount) AS amt
      FROM influencer_attributions
      WHERE status = 'available' AND paid_at IS NULL
      GROUP BY influencer_id
    `).all<{ influencer_id: string; amt: number }>().catch(() => ({ results: [] as any[] }))

    for (const row of balanceUpdates.results || []) {
      // 정확한 동기: available_amount 를 모든 'available' 의 SUM 으로 다시 설정
      // (pending → available 이동이 누적되므로 누적 보정)
      await DB.prepare(`
        INSERT INTO influencer_balances (influencer_id, available_amount, pending_amount, updated_at)
        VALUES (?, ?, COALESCE((SELECT SUM(commission_amount) FROM influencer_attributions WHERE influencer_id = ? AND status = 'pending'), 0), datetime('now'))
        ON CONFLICT(influencer_id) DO UPDATE SET
          available_amount = ?,
          pending_amount = COALESCE((SELECT SUM(commission_amount) FROM influencer_attributions WHERE influencer_id = ? AND status = 'pending'), 0),
          updated_at = datetime('now')
      `).bind(row.influencer_id, row.amt, row.influencer_id, row.amt, row.influencer_id).run().catch(swallow('cron:influencer-payout:balance-upsert'))
    }

    // 2) 송금 대상 인플루언서 추출
    const minRow = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'influencer_payout_min'"
    ).first<{ value: string }>().catch(() => null)
    const payoutMin = Number(minRow?.value ?? DEFAULT_PAYOUT_MIN) || DEFAULT_PAYOUT_MIN

    const toPayout = await DB.prepare(`
      SELECT influencer_id, available_amount, tax_type, business_number,
             bank_name, bank_account, account_holder
      FROM influencer_balances
      WHERE available_amount >= ?
      ORDER BY available_amount DESC
      LIMIT 100
    `).bind(payoutMin).all<InfluencerToPayout>().catch(() => ({ results: [] as InfluencerToPayout[] }))

    let payoutCount = 0
    let payoutTotal = 0
    const missingBank: string[] = []

    for (const inf of toPayout.results || []) {
      // 계좌 정보 누락 → 송금 보류 + alert
      if (!inf.bank_name || !inf.bank_account || !inf.account_holder) {
        missingBank.push(inf.influencer_id)
        continue
      }
      // 원천징수 계산
      let withholdingPct = 0
      if (inf.business_number) withholdingPct = 3.3
      else if (inf.tax_type === 'other_income') withholdingPct = 8.8
      // 무신고: 0 (수동)
      const withholding = Math.floor(inf.available_amount * withholdingPct / 100)
      const netAmount = inf.available_amount - withholding

      // 실제 송금은 PG 연동 필요 — 여기선 어드민 dashboard 에 송금 대기 notification
      try {
        await DB.prepare(
          `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
           VALUES ('admin', 'all', 'influencer_payout_pending', ?, ?, '/admin/influencer-payouts', datetime('now'))`
        ).bind(
          `💰 인플 송금 대기: ${inf.influencer_id}`,
          `${inf.available_amount.toLocaleString()}원 (원천징수 ${withholdingPct}% = ${withholding.toLocaleString()}, 실송금 ${netAmount.toLocaleString()})`,
        ).run().catch(swallow('cron:influencer-payout:admin-notify'))
        payoutCount++
        payoutTotal += netAmount
      } catch { /* notification 실패는 무시 */ }
    }

    // 누락 계좌 alert
    if (missingBank.length > 0) {
      const webhookUrl = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `⚠️ 인플루언서 ${missingBank.length}명 계좌정보 누락 → 송금 보류:\n${missingBank.slice(0, 10).join(', ')}`,
            }),
            signal: AbortSignal.timeout(5000),
          }).catch(swallow('cron:influencer-payout:missing-bank-alert'))
        } catch { /* silent */ }
      }
    }

    logInfo(`[cron:influencer-payout] transitioned=${transitioned} payouts_queued=${payoutCount} total_net=${payoutTotal} missing_bank=${missingBank.length}`)
  } catch (e) {
    logError('[cron:influencer-payout] failed', { error: String(e) })
  }
}
