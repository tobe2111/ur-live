/**
 * 🛡️ 2026-05-21 Phase C: 주 1회 정산 일괄 생성 cron.
 *
 * 매주 월요일 새벽 (KST 09 = UTC 00) 실행:
 *   - 지난주 ledger credit 집계
 *   - 이미 payouts 처리된 amount 차감
 *   - 잔액 10,000원 이상 payee 별 pending payouts row INSERT
 *
 * admin 이 /admin/payouts 페이지에서 검토 후 송금 처리.
 *
 * 멱등 (2026-06-11 머니 감사): 같은 (payee_type, payee_id, period_start, period_end) 조합은
 *   pre-check 로 skip + payouts UNIQUE index 기반 INSERT OR IGNORE 로 이중 차단 →
 *   cron 이 두 번 돌거나 수동 재실행돼도 중복 pending payout 이 생기지 않음.
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'
import { resolvePayoutHold } from '../utils/payout-hold'
// 💸 2026-10-01 (결재 voucher-credit-double-rail): `merchant:N` 과 `seller:N` 은 **같은 가게**다.
//   계정 문자열로 GROUP BY 하면 한 가게에 payout 이 두 개 생긴다(실측 185% 과다지급) — 집계에서 접는다.
import { canonicalPayee, payoutCreditsSql, payoutPaidSql } from '../utils/payout-account'
// 🏦 2026-10-10: 계좌 스냅샷(은행·번호·예금주)은 SSOT 하나로 — 수동 생성·손바뀜 마감과 같은 함수.
import { resolvePayeeAccount } from '../utils/payout-payee-account'

// 🔎 2026-07-28: 반환값 추가 — safeCron 이 하트비트에 '무엇을 했나'로 기록한다(#826).
//   0건이 '이번 주 정산할 게 없었다' 인지 '조용히 실패했다' 인지 구분하려면 실행 사실만으론 부족하다.
export async function handlePayoutsGenerate(env: Env): Promise<{ created: number; period: string } | void> {
  const DB = env.DB
  if (!DB) return
  try {
    const now = new Date()
    const lastMonday = new Date(now)
    lastMonday.setUTCDate(now.getUTCDate() - 7 - ((now.getUTCDay() + 6) % 7))
    const lastSunday = new Date(lastMonday)
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6)
    const periodStart = lastMonday.toISOString().slice(0, 10)
    const periodEnd = lastSunday.toISOString().slice(0, 10)
    // 🛡️ 2026-05-22 정책 중앙화 — REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL
    const { REFUND_POLICY } = await import('../../shared/constants/policy')
    const MIN_AMOUNT = REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL

    // 🛡️ 2026-06-26 [머니수정] credit 집계를 '지난주만' → '전기간 누적' 으로 변경.
    //   기존엔 credit 은 1주치인데 차감(paid)은 전기간이라, 누적 payout 이 1주 credit 을
    //   넘는 기성 payee 는 pending 이 음수→skip(만성 미지급) + 누락된 주/MIN 미만 주의 credit 은
    //   영영 재포착 못 함(각 run 이 자기 7일 창만 봄). 이제 getPayablePending(ledger.ts) 의 정식
    //   공식 = (전기간 credit − 전기간 미완료 payout) 으로 실외상 잔액을 반영.
    // 💸 2026-07-01 (정산 정합 — 대표 승인): 이전엔 credit-only 합산이라 (A) 공구 seller 의 gross credit
    //   에서 수수료 미차감 + (B) seller:N 의 기존 debit(환불 역전·인플루언서/추천 커미션)을 무시 → 과다지급.
    //   정식 net 잔액 = (credit − fee_amount) − debit. getLedgerReceivable(ledger.ts) 와 동일 공식.
    //   (fee_amount 는 공구 seller credit 에만 존재 → 다른 payee/이용권 무영향. debit 는 payee receivable 차감.)
    // 🕙 2026-09-21 (대표 확정 — 유보 10일): 토스가 우리에게 주기 전에 우리가 먼저 주지 않는다.
    //   ⚠️ credit 에만 건다. debit(환불 역전)은 **즉시** 빼야 한다 — 빼는 걸 미루면 과다지급이다.
    //   ⚠️ 기존 WHERE 를 **괄호로 감쌌다**: `A OR B OR C AND D` 는 `A OR B OR (C AND D)` 로 묶여
    //     유보가 마지막 LIKE 에만 걸리고 나머지 계정은 통째로 샌다. OR 만 있을 땐 괄호가 무해하므로
    //     유보 0(빈 문자열)이어도 종전과 결과가 같다.
    const hold = await resolvePayoutHold(DB)
    const credits = await DB.prepare(payoutCreditsSql(hold.sql)).all<{ account: string; total: number }>()
      .then(r => ({ results: (r.results || []).map(x => ({ credit_account: x.account, total: x.total })) }))
      .catch(() => ({ results: [] as Array<{ credit_account: string; total: number }> }))

    // 이미 payout 처리됐거나(완료) 처리 대기중인(pending) amount.
    // 🛡️ credit 이 전기간 누적이 됐으므로 차감도 전기간 — 'pending' 도 포함해야 직전 run 이 만든
    //   미승인 pending payout 이 다음 주(다른 period) run 에서 같은 외상으로 재생성되는 이중 pending 을 차단.
    //   (rejected/failed/cancelled 는 미차감 → 그 외상은 다음 run 에서 정상 재포착.)
    const paid = await DB.prepare(payoutPaidSql()).all<{ account: string; total: number }>().catch(() => ({ results: [] as Array<{ account: string; total: number }> }))
    const paidMap = new Map((paid.results || []).map(r => [r.account, r.total]))

    let created = 0
    for (const c of credits.results || []) {
      const pending = c.total - (paidMap.get(c.credit_account) || 0)
      if (pending < MIN_AMOUNT) continue
      // 🔐 2026-09-07 / 2026-10-01: 계정 해석은 `canonicalPayee`(SSOT)가 한다. 그 함수가 id 숫자 검사도
      //   같이 한다 — `'seller:null'` 은 `split(':')` 이 `id='null'`(truthy)을 내므로 가드 없는 호출부를
      //   통과해 **계좌 없는 유령 payout** 을 만든다(실측으로 그런 원장 행이 있었다). 근본 수리는
      //   구매 적립이 애초에 그 이름을 안 쓰는 것(`purchaseCreditAccount`)이고 이건 두 번째 방어선이다.
      const payee = canonicalPayee(c.credit_account)
      if (!payee) continue
      const id = payee.id
      // userdeal:N 은 비사업자 딜 적립 audit 전용 → 현금 payout 대상 아님 (위 WHERE 의 user:% 와 구분됨).
      // 💸 2026-10-01: payee_type 을 **계정 접두어가 아니라 셀러 역할**에서 정한다. 접두어로 정하면
      //   `merchant:`→store_owner / `seller:`→seller 로 갈려 **같은 가게가 두 payee** 가 됐다(이번 결함).
      //   접은 뒤엔 접두어가 사라지므로, 매장인지 여부는 `sellers.seller_type` 이 말한다
      //   (`weekly-metrics-summary` 의 이중레일 경보가 `payee_type='store_owner'` 를 보므로 이 라벨은 살려야 한다).
      // 🏦 2026-10-10: 계좌 조회는 `resolvePayeeAccount` 하나로 — 종전엔 `bank_name` 을 안 읽어(항상 NULL)
      //   cron payout 이 전부 은행 일괄이체 CSV 에서 빠졌고, 예금주에 상호(business_name)를 적었다.
      //   payee_type 은 계좌 접두어가 아니라 셀러 역할에서 정한다(`payoutPayeeType`, 그 함수 안에서).
      // 🔒 2026-09-20 (승인 게이트): 돈은 **사람이 등록증을 보고 승인한 매장**에만 나간다
      //   (`isPayoutEligibleSellerStatus` — `eligible`). 원장 credit 은 그대로 쌓이고 승인되는 순간
      //   다음 run 이 전기간 외상을 잡는다. ⚠️ 이 줄이 없으면 승인 전 매장이 직링크로 팔고 스스로
      //   사용 처리해 payout 이 생긴다.
      // ⚠️ 계좌 미재확인(`accountVerified=false`)이어도 **생성은 한다** — 받을 돈은 실재한다.
      //   송금 직전(`checkPayeeAccountCurrent`)이 막는다.
      const acct = await resolvePayeeAccount(DB, payee).catch(() => null)
      if (!acct) continue
      if (!acct.eligible) { logInfo(`[payouts-cron] skip unapproved seller ${id} (${acct.sellerStatus ?? 'null'})`); continue }
      const payeeType: string = acct.payeeType

      // 🛡️ 2026-06-11 멱등: 같은 (payee, period) payout 이 이미 있으면 재생성 skip (재실행/이중실행 방어).
      const dup = await DB.prepare(
        `SELECT id FROM payouts WHERE payee_type = ? AND payee_id = ? AND period_start = ? AND period_end = ? LIMIT 1`,
      ).bind(payeeType, id, periodStart, periodEnd).first<{ id: number }>().catch(() => null)
      if (dup) continue

      try {
        // INSERT OR IGNORE + payouts UNIQUE index (repair-schema) → 동시 재실행에도 중복 0.
        const ins = await DB.prepare(
          `INSERT OR IGNORE INTO payouts (payee_type, payee_id, amount, period_start, period_end, status, bank_name, account_number, account_holder)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        ).bind(payeeType, id, pending, periodStart, periodEnd, acct.bankName, acct.accountNumber, acct.accountHolder).run()
        if ((ins.meta?.changes ?? 0) > 0) created++
      } catch (e) {
        logError('[payouts-cron] insert failed', { account: c.credit_account, error: (e as Error).message })
      }
    }
    if (created > 0) logInfo(`[payouts-cron] created ${created} pending payouts for ${periodStart} ~ ${periodEnd} (hold ${hold.days}d)`)

    // 🔔 2026-07-08 (무인운영 감사): 성공 하트비트 — 주간 정산 생성이 조용히 멈추면(무소식)
    //   운영자가 알아채도록 매 run 요약을 어드민 벨 + Discord 로 push. 리포트가 "안 오는 것"이
    //   곧 이상신호가 되게 한다. 집계/INSERT 로직은 불변 — 요약 통지 1블록만 추가.
    try {
      const summary = `주간 정산 생성: ${created}건 (${periodStart} ~ ${periodEnd})`
      try {
        const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
        await createDashboardNotification(DB, 'admin', null, 'payouts_generated', '💸 주간 정산 생성', summary, '/admin/payouts')
      } catch { /* 벨 실패 무시 */ }
      const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
      if (webhook) {
        const { sendDiscordAlert } = await import('../utils/discord-alert')
        await sendDiscordAlert(webhook, '💸 주간 정산 생성', summary, 'info').catch(() => {})
      }
    } catch { /* 하트비트 실패는 정산 생성에 영향 없음 */ }

    return { created, period: periodStart }
  } catch (e) {
    // 🔔 2026-07-08: 이전엔 여기서 삼켜 safeCron 의 실패 알림 경로에 안 닿았음(무음).
    //   재throw → scheduled.ts safeCron → notifyCronFailure(Discord + cron_failures + 어드민 벨).
    logError('[payouts-cron] failed', { error: (e as Error).message })
    throw e
  }
}
