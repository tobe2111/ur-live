/**
 * 🛡️ 2026-05-18: 비사업자 셀러 원천징수 + 지급조서 자동 기록.
 *
 *   세무 근거:
 *     - 소득세법 §21 — 기타소득 (사업자 등록 없는 개인에게 보상 지급).
 *     - 원천징수율: 8.8% (소득세 8% + 지방세 0.8%).
 *     - 연 누계 300만원 이하: 분리과세 가능 (셀러 신고 의무 없음).
 *     - 연 누계 300만원 초과: 종합소득 합산 의무 (셀러) + 지급조서 제출 (지급자).
 *
 *   호출처:
 *     - 정산 송금 시점 (admin 승인) — settlement_cash
 *     - 교환권 발송 시점 — voucher_order
 *     - 딜 환급 시점 — deal_redeem
 *
 *   동작:
 *     1. 셀러의 business_registration_status 확인
 *     2. 'verified' or 'exempt' → 원천징수 면제 (사업자가 세금계산서 발행)
 *     3. 그 외 → 8.8% 차감 + tax_withholding_log INSERT + ytd 누계 갱신
 */
type Env = { DB: D1Database }

export interface WithholdingResult {
  withheld: boolean
  gross_amount: number
  withholding_amount: number
  net_amount: number
  ytd_gross_amount: number
  reportable: boolean         // 누계 300만 초과 → true
  log_id?: number
  reason?: string
}

const WITHHOLDING_RATE = 0.088   // 8.8% (8% 소득세 + 0.8% 지방세)
const ANNUAL_THRESHOLD = 3_000_000  // 300만원 (기타소득 분리과세 한도)

/**
 * 원천징수 + 지급조서 row INSERT.
 * @returns net_amount = 실제 셀러 수령 금액
 */
export async function withholdAndLog(
  env: Env,
  params: {
    sellerId: number
    grossAmount: number
    sourceType: 'settlement_cash' | 'voucher_order' | 'deal_redeem'
    sourceId?: string
  },
): Promise<WithholdingResult> {
  const { sellerId, grossAmount, sourceType, sourceId } = params
  const gross = Math.max(0, Math.floor(grossAmount))

  // 1. 셀러 사업자 등록 확인.
  const seller = await env.DB.prepare(
    'SELECT business_registration_status FROM sellers WHERE id = ?'
  ).bind(sellerId).first<{ business_registration_status: string | null }>().catch(() => null)

  const status = seller?.business_registration_status || 'pending'
  // verified or exempt 셀러는 원천징수 면제 (세금계산서로 별도 처리).
  if (status === 'verified' || status === 'exempt') {
    return {
      withheld: false,
      gross_amount: gross,
      withholding_amount: 0,
      net_amount: gross,
      ytd_gross_amount: 0,
      reportable: false,
      reason: 'business_registered',
    }
  }

  // 2. 연 누계 조회 (현재 연도 기준).
  const now = new Date()
  const year = now.getFullYear()
  const ytdRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(gross_amount), 0) as total
       FROM tax_withholding_log
      WHERE seller_id = ? AND payout_year = ?`
  ).bind(sellerId, year).first<{ total: number }>().catch(() => null)

  const ytdBeforeThis = ytdRow?.total || 0
  const ytdAfterThis = ytdBeforeThis + gross
  const reportable = ytdAfterThis > ANNUAL_THRESHOLD

  // 3. 원천징수 금액 계산.
  const withholding = Math.floor(gross * WITHHOLDING_RATE)
  const net = gross - withholding

  // 4. INSERT.
  const result = await env.DB.prepare(
    `INSERT INTO tax_withholding_log
       (seller_id, payout_year, payout_month, gross_amount, withholding_rate, withholding_amount,
        net_amount, source_type, source_id, ytd_gross_amount, reportable, created_at)
     VALUES (?, ?, ?, ?, 8.8, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    sellerId, year, now.getMonth() + 1,
    gross, withholding, net, sourceType, sourceId || null,
    ytdAfterThis, reportable ? 1 : 0,
  ).run().catch(() => null)

  return {
    withheld: true,
    gross_amount: gross,
    withholding_amount: withholding,
    net_amount: net,
    ytd_gross_amount: ytdAfterThis,
    reportable,
    log_id: result ? Number(result.meta.last_row_id) : undefined,
  }
}

/**
 * 셀러의 현 연도 원천징수 현황 조회 (마이페이지 표시용).
 */
export async function getSellerTaxSummary(env: Env, sellerId: number, year?: number): Promise<{
  year: number;
  total_gross: number;
  total_withheld: number;
  total_net: number;
  payouts_count: number;
  reportable: boolean;
  threshold: number;
}> {
  const y = year || new Date().getFullYear()
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(gross_amount), 0) as gross,
            COALESCE(SUM(withholding_amount), 0) as withheld,
            COALESCE(SUM(net_amount), 0) as net,
            COUNT(*) as cnt
       FROM tax_withholding_log
      WHERE seller_id = ? AND payout_year = ?`
  ).bind(sellerId, y).first<{ gross: number; withheld: number; net: number; cnt: number }>()
    .catch(() => null)

  return {
    year: y,
    total_gross: row?.gross || 0,
    total_withheld: row?.withheld || 0,
    total_net: row?.net || 0,
    payouts_count: row?.cnt || 0,
    reportable: (row?.gross || 0) > ANNUAL_THRESHOLD,
    threshold: ANNUAL_THRESHOLD,
  }
}
