/**
 * 📊 사장님 일일 리포트 메일 — 어제 이용권이 몇 장 팔리고 몇 장 쓰였는지.
 *
 * 매일 18:40 UTC(= 한국 새벽 3:40) growth 배치에서 돈다 → 사장님은 아침에 확인한다.
 *
 * 🩸 2026-10-18 수리 (대표 "4번 하자") — 이 리포트는 **한 통도 나간 적이 없었다**:
 *   ① 수신 대상이 `daily_report_enabled = 1` 인데 기본값이 0 이고 켜는 화면이 없었다 → 0명
 *   ② `status = 'active'` 만 봐서 승인된 사장님(`approved`)이 빠졌다
 *   ③ 시간 비교를 ISO 문자열(`…T…Z`)로 해서 D1 형식(`… HH:MM:SS`)과 하루 경계가 어긋났다
 *   ④ 날짜 표시가 `getUTCDate() + 1` 이라 월말에 "10-32" 가 됐다
 *   ⑤ 내용이 라이브 방송·시청자(영구 중단 기능)였고 정작 이용권 판매·사용이 없었다
 * ⇒ 대상은 게이트 `seller_daily_report_enabled`(기본 OFF — 켜면 승인된 사장님 전원, `seller_meta.daily_report_opt_out='1'` 은 제외).
 *   게이트가 꺼져 있으면 예전 개별 동의(`daily_report_enabled = 1`)만 받는다.
 *
 * 활동이 0 인 날은 보내지 않는다(스팸 방지). 머니 경로 무접촉 — 읽기와 메일 발송뿐.
 */

import type { Env } from '../types/env'
import { sendEmail } from '../../services/email'
import { transactionalMailReady } from '../../lib/ncp-sens-mail'
import { chunkForBinds } from '../../shared/db/d1-binds'
import { getSellerMeta } from '../utils/seller-meta'
import { settingOn, yesterdayKstRange, escHtml, SELLER_DAILY_REPORT_GATE } from '../utils/owner-nudges'

interface SellerRow { id: number; business_name: string | null; email: string | null }
export type DailyReportStats = { sold: number; soldAmount: number; used: number; orders: number; orderAmount: number; newReviews: number; avgRating: number }

export function buildReportHTML(sellerName: string, date: string, s: DailyReportStats): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:10px 0;color:#666c72;font-size:14px">${label}</td><td style="padding:10px 0;text-align:right;font-size:17px;font-weight:700;color:#16181c">${value}</td></tr>`
  const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
  const tip = s.sold === 0 && s.used > 0
    ? '어제는 새로 팔린 이용권은 없었지만 손님이 다녀갔어요. 사진이나 가격을 한 번 점검해 보세요.'
    : s.sold > 0 ? '어제 판매가 있었어요. 손님이 오면 QR 로 사용 처리를 꼭 해 주세요(정산 근거가 됩니다).'
      : '새 후기를 확인해 보세요.'
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${escHtml(sellerName)} 일일 리포트</title></head>
<body style="margin:0;padding:24px;background:#f8f7fc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#16181c">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:#1c69ef;color:#fff;padding:20px 24px"><div style="font-size:13px;opacity:.85">${escHtml(date)} 일일 리포트</div><div style="font-size:20px;font-weight:700;margin-top:4px">${escHtml(sellerName)}</div></div>
<div style="padding:8px 24px 20px"><table style="width:100%;border-collapse:collapse">
${row('팔린 이용권', `${s.sold}장`)}${row('이용권 판매액', won(s.soldAmount))}${row('손님이 사용한 이용권', `${s.used}장`)}
${s.orders ? row('쇼핑 주문', `${s.orders}건 · ${won(s.orderAmount)}`) : ''}${row('새 후기', s.newReviews ? `${s.newReviews}건 · 평균 ${s.avgRating.toFixed(1)}점` : '0건')}
</table><p style="margin:16px 0 0;padding:14px;background:#f8f7fc;border-radius:10px;font-size:13px;color:#4f545a">${tip}</p>
<div style="text-align:center;margin-top:20px"><a href="https://urdeal.kr/user/profile" style="display:inline-block;padding:12px 22px;background:#1c69ef;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">내 가게 보기</a></div></div>
<div style="padding:12px;text-align:center;font-size:12px;color:#81868c">유어딜 · 리포트를 그만 받으려면 urteam.corp@gmail.com 으로 알려 주세요.</div>
</div></body></html>`
}

export async function handleSellerDailyReport(env: Env): Promise<{ sent: number; failed: number; targets: number }> {
  const DB = env.DB
  const out = { sent: 0, failed: 0, targets: 0 }
  if (!DB) return out
  if (!transactionalMailReady(env)) return out

  const gateOn = await settingOn(DB, SELLER_DAILY_REPORT_GATE)
  const where = gateOn
    ? `status IN ('approved','active')`
    : `status IN ('approved','active') AND COALESCE(daily_report_enabled, 0) = 1`
  const sellers = (await DB.prepare(
    `SELECT id, business_name, email FROM sellers WHERE ${where} AND email IS NOT NULL AND email != '' LIMIT 1000`,
  ).all<SellerRow>().catch(() => ({ results: [] as SellerRow[] }))).results || []
  if (!sellers.length) return out

  const meta = await getSellerMeta(DB, sellers.map(s => s.id)).catch(() => new Map<number, Record<string, string>>())
  const targets = sellers.filter(s => meta.get(s.id)?.daily_report_opt_out !== '1')
  out.targets = targets.length
  if (!targets.length) return out

  const { date, start, end } = yesterdayKstRange()
  const stats = new Map<number, DailyReportStats>()
  const get = (id: number) => {
    let v = stats.get(id)
    if (!v) { v = { sold: 0, soldAmount: 0, used: 0, orders: 0, orderAmount: 0, newReviews: 0, avgRating: 0 }; stats.set(id, v) }
    return v
  }
  const ids = targets.map(s => s.id)
  // 🔢 D1 은 **한 문장에 바인딩 100개**까지고 아래 네 쿼리는 기간 두 개를 더 쓴다 → id 는 98개씩.
  //    🩸 2026-10-26 까지 100개씩 잘라 **102개**를 보냈다: 셀러가 100곳을 넘는 날 전 쿼리가
  //    `too many SQL variables` 로 실패하고 `.catch` 가 빈 배열로 삼켜 **일일 리포트가 "어제 0건"**
  //    이라고 말했을 것이다(라이브 셀러가 13곳이라 아직 안 터졌다). 청크 크기를 손으로 적지 않는다.
  for (const chunk of chunkForBinds(ids, 2)) {
    const ph = chunk.map(() => '?').join(',')
    // 팔린 이용권 — 0원 체험권은 판매가 아니라서 뺀다(컬럼이 없는 옛 스키마면 그냥 센다).
    const soldSql = (exp: string) => `SELECT p.seller_id AS sid, COUNT(*) AS n, COALESCE(SUM(COALESCE(v.applied_price, p.price, 0)), 0) AS amt
      FROM vouchers v JOIN products p ON p.id = v.product_id
      WHERE p.seller_id IN (${ph}) AND v.created_at >= ? AND v.created_at < ? ${exp} GROUP BY p.seller_id`
    const sold = await DB.prepare(soldSql('AND COALESCE(v.is_experience, 0) = 0')).bind(...chunk, start, end).all<{ sid: number; n: number; amt: number }>()
      .catch(() => DB.prepare(soldSql('')).bind(...chunk, start, end).all<{ sid: number; n: number; amt: number }>())
      .catch(() => ({ results: [] as { sid: number; n: number; amt: number }[] }))
    for (const r of sold.results || []) { const v = get(r.sid); v.sold = Number(r.n); v.soldAmount = Number(r.amt) }

    const used = await DB.prepare(`SELECT p.seller_id AS sid, COUNT(*) AS n FROM vouchers v JOIN products p ON p.id = v.product_id
      WHERE p.seller_id IN (${ph}) AND v.status = 'used' AND v.used_at >= ? AND v.used_at < ? GROUP BY p.seller_id`)
      .bind(...chunk, start, end).all<{ sid: number; n: number }>().catch(() => ({ results: [] as { sid: number; n: number }[] }))
    for (const r of used.results || []) get(r.sid).used = Number(r.n)

    const orders = await DB.prepare(`SELECT seller_id AS sid, COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS amt FROM orders
      WHERE seller_id IN (${ph}) AND payment_status = 'approved' AND created_at >= ? AND created_at < ? GROUP BY seller_id`)
      .bind(...chunk, start, end).all<{ sid: number; n: number; amt: number }>().catch(() => ({ results: [] as { sid: number; n: number; amt: number }[] }))
    for (const r of orders.results || []) { const v = get(r.sid); v.orders = Number(r.n); v.orderAmount = Number(r.amt) }

    const reviews = await DB.prepare(`SELECT p.seller_id AS sid, COUNT(*) AS n, COALESCE(AVG(pr.rating), 0) AS avg_r
      FROM product_reviews pr JOIN products p ON p.id = pr.product_id
      WHERE p.seller_id IN (${ph}) AND pr.created_at >= ? AND pr.created_at < ? GROUP BY p.seller_id`)
      .bind(...chunk, start, end).all<{ sid: number; n: number; avg_r: number }>().catch(() => ({ results: [] as { sid: number; n: number; avg_r: number }[] }))
    for (const r of reviews.results || []) { const v = get(r.sid); v.newReviews = Number(r.n); v.avgRating = Number(r.avg_r) }
  }

  const resendKey = (env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY || ''
  for (const s of targets) {
    const st = stats.get(s.id)
    if (!st || st.sold + st.used + st.orders + st.newReviews === 0) continue
    try {
      const name = s.business_name || '사장님'
      const res = await sendEmail(
        { to: String(s.email), subject: `[유어딜] ${name} ${date} 이용권 리포트`, html: buildReportHTML(name, date, st) },
        resendKey,
        (env as Env & { RESEND_FROM?: string }).RESEND_FROM,
      )
      if (res.success) out.sent++
      else out.failed++
    } catch { out.failed++ }
  }
  return out
}
