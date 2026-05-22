/**
 * 🛡️ 2026-05-21 정정: 비사업자 인플루언서 원천징수 — default 3.3% (사업소득).
 *
 *   세무 근거:
 *     - 소득세법 §127 — 원천징수 의무
 *     - 사업소득 (반복적 활동 — 대부분 인플루언서): 3.3% (소득세 3% + 지방세 0.3%)
 *     - 기타소득 (일시적 협업 — 단발): 8.8% (소득세 8% + 지방세 0.8%)
 *     - 연 누계 300만원 이하 (기타소득만): 분리과세
 *     - 연 누계 300만원 초과 (양쪽): 종합소득 합산 + 지급조서 제출
 *
 *   sellers.tax_type 컬럼:
 *     - 'business_income' (default — 사업소득 3.3%)
 *     - 'other_income' (기타소득 8.8%)
 *
 *   호출처:
 *     - 정산 송금 시점 (admin 승인) — settlement_cash
 *     - 교환권 발송 시점 — voucher_order
 *     - 딜 환급 시점 — deal_redeem
 *
 *   동작:
 *     1. 셀러의 business_registration_status + tax_type 확인
 *     2. 'verified' or 'exempt' → 원천징수 면제 (사업자가 세금계산서 발행)
 *     3. 그 외 → tax_type 별 비율 차감 + tax_withholding_log INSERT
 */
type Env = { DB: D1Database }

export interface WithholdingResult {
  withheld: boolean
  gross_amount: number
  withholding_amount: number
  withholding_rate: number      // 실제 적용된 비율 (% 단위)
  tax_type: 'business_income' | 'other_income' | 'none'
  net_amount: number
  ytd_gross_amount: number
  reportable: boolean
  log_id?: number
  reason?: string
}

// 🛡️ 한국 세법 비율 — 절대 hardcode 금지, 본 마스터 상수만 사용.
export const WITHHOLDING_RATES = {
  business_income: 0.033,  // 3.3% (소득세 3% + 지방세 0.3%) — 반복적 활동 default
  other_income: 0.088,     // 8.8% (소득세 8% + 지방세 0.8%) — 단발성 협업
} as const

const ANNUAL_THRESHOLD = 3_000_000

/**
 * 셀러 tax_type 조회 (default 'business_income' = 3.3%).
 * sellers.tax_type 컬럼 없으면 default fallback.
 */
async function getSellerTaxType(env: Env, sellerId: number): Promise<'business_income' | 'other_income'> {
  try {
    const row = await env.DB.prepare(
      "SELECT COALESCE(tax_type, 'business_income') as tax_type FROM sellers WHERE id = ?",
    ).bind(sellerId).first<{ tax_type: string }>()
    const t = row?.tax_type
    if (t === 'other_income') return 'other_income'
    return 'business_income'
  } catch {
    return 'business_income'
  }
}

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

  const seller = await env.DB.prepare(
    'SELECT business_registration_status FROM sellers WHERE id = ?'
  ).bind(sellerId).first<{ business_registration_status: string | null }>().catch(() => null)

  const status = seller?.business_registration_status || 'pending'
  if (status === 'verified' || status === 'exempt') {
    return {
      withheld: false,
      gross_amount: gross,
      withholding_amount: 0,
      withholding_rate: 0,
      tax_type: 'none',
      net_amount: gross,
      ytd_gross_amount: 0,
      reportable: false,
      reason: 'business_registered',
    }
  }

  // tax_type 기반 비율 결정
  const taxType = await getSellerTaxType(env, sellerId)
  const rate = WITHHOLDING_RATES[taxType]

  // 연 누계 조회 (현재 연도 기준).
  const now = new Date()
  const year = now.getFullYear()
  const ytdRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(gross_amount), 0) as total
       FROM tax_withholding_log
      WHERE seller_id = ? AND payout_year = ?`
  ).bind(sellerId, year).first<{ total: number }>().catch(() => null)

  const ytdBeforeThis = ytdRow?.total || 0
  const ytdAfterThis = ytdBeforeThis + gross
  // 사업소득은 누계 무관, 기타소득은 300만 초과 시 reportable
  const reportable = taxType === 'business_income' || ytdAfterThis > ANNUAL_THRESHOLD

  const withholding = Math.floor(gross * rate)
  const net = gross - withholding

  // INSERT — withholding_rate 에 실제 비율 (% 단위) 저장.
  const result = await env.DB.prepare(
    `INSERT INTO tax_withholding_log
       (seller_id, payout_year, payout_month, gross_amount, withholding_rate, withholding_amount,
        net_amount, source_type, source_id, ytd_gross_amount, reportable, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    sellerId, year, now.getMonth() + 1,
    gross, rate * 100, withholding, net, sourceType, sourceId || null,
    ytdAfterThis, reportable ? 1 : 0,
  ).run().catch(() => null)

  return {
    withheld: true,
    gross_amount: gross,
    withholding_amount: withholding,
    withholding_rate: rate * 100,
    tax_type: taxType,
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
