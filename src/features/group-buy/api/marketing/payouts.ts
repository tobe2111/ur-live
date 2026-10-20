/**
 * 💰 어드민 **인플루언서 송금 처리** — `marketing.routes.ts` 에서 떼어낸 조각 (2026-08-31)
 *
 * 옮긴 이유는 크기다. 현금 정산 수수료를 얹으니 원 파일이 820줄로 자라 파일크기 래칫에 걸렸고,
 * CLAUDE.md 가 정한 처방은 **리베이스라인이 아니라 분리**다 — 키운 사람이 자기가 키운 만큼
 * 떼어낸다(`marketing/discovery.ts` 선례). 로직은 **한 줄도 바꾸지 않았다**(이동만).
 *
 * ⚠️ 라우터 인스턴스를 여기서 새로 만들지 않는다. 새로 만들면 원 파일이 `adminApp` 에 걸어 둔
 *   미들웨어가 안 붙어 **인증 없이 열린다** — 이동 리팩토링에서 가장 나기 쉬운 사고다.
 *   원 파일이 만든 인스턴스를 받아 라우트만 얹는다.
 */
import type { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { computeCashPayout, resolveCashFeePct } from '@/shared/influencer-payout-math'
import { swallow } from '@/worker/utils/swallow'

type MarketingVars = {
  user?: { id: string | number; email?: string }
  seller?: { id: number; email?: string }
}

export function registerAdminPayoutRoutes(adminApp: Hono<{ Bindings: Env; Variables: MarketingVars }>) {
  // ───────── 어드민 — 인플 송금 처리 ─────────

  adminApp.get('/payouts', async (c) => {
    const DB = c.env.DB
    // 지급 대기 — 💎 2026-08-31 대표: **최소 금액은 현금에만.** 딜은 1원부터 뜬다.
    //   (문턱의 근거는 은행 송금 비용인데 딜엔 그 비용이 없다. cron 쪽과 같은 조건 — 갈리면
    //   "알림엔 떴는데 목록엔 없다"가 난다.)
    const minRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'influencer_payout_min'").first<{ value: string }>().catch(() => null)
    const payoutMin = Number(minRow?.value ?? 100000)
    const { results } = await DB.prepare(
      `SELECT influencer_id, available_amount, total_paid_out, payout_method,
              business_number, tax_type, bank_name, bank_account, account_holder, updated_at
       FROM influencer_balances
       WHERE available_amount > 0
         AND (payout_method = 'deal' OR available_amount >= ?)
       ORDER BY available_amount DESC
       LIMIT 200`
    ).bind(payoutMin).all().catch(() => ({ results: [] as any[] }))
    // 💰 2026-08-31: 현금 정산 수수료율을 응답에 동봉 — 화면이 자기 상수로 계산하면 서버와 갈린다.
    //   기본 0 = 안 걷음(설정 전에는 종전과 동일).
    const feeRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'influencer_payout_cash_fee_pct'").first<{ value: string }>().catch(() => null)
    const cashFeePct = resolveCashFeePct(feeRow?.value)
    return c.json({ success: true, data: { payout_min: payoutMin, cash_fee_pct: cashFeePct, list: results || [] } })
  })

  adminApp.post('/payouts/process', async (c) => {
    const body = await c.req.json<{ influencer_id: string; method: 'cash' | 'deal'; net_amount?: number }>().catch(() => ({ influencer_id: '', method: 'cash' as const, net_amount: undefined }))
    const influencerId = String(body.influencer_id || '').trim()
    if (!influencerId) return c.json({ success: false, error: 'invalid' }, 400)
    const DB = c.env.DB
    const balance = await DB.prepare(
      "SELECT available_amount FROM influencer_balances WHERE influencer_id = ?"
    ).bind(influencerId).first<{ available_amount: number }>().catch(() => null)
    if (!balance || balance.available_amount <= 0) return c.json({ success: false, error: '잔액 없음' }, 400)
    const amount = balance.available_amount

    // 🛡️ 2026-06-04: 이중 지급 차단 CAS — available_amount 가 아직 amount 일 때만 0 으로 claim.
    //   더블클릭/동시 요청이 둘 다 잔액을 읽고 둘 다 딜포인트를 적립하던 이중 지급 버그 방지.
    //   credit(user_points) 이전에 claim → 진 요청은 아무 지급도 못 함.
    const claim = await DB.prepare(
      "UPDATE influencer_balances SET available_amount = 0, total_paid_out = total_paid_out + ?, updated_at = datetime('now') WHERE influencer_id = ? AND available_amount = ?"
    ).bind(amount, influencerId, amount).run().catch(() => null)
    if (!claim || (claim.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '이미 처리되었거나 잔액이 변경되었습니다. 새로고침 후 다시 시도하세요.' }, 409)
    }

    if (body.method === 'deal') {
      // 딜 보너스 % 적용
      const bonusRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'influencer_deal_bonus_pct'").first<{ value: string }>().catch(() => null)
      const bonusPct = Number(bonusRow?.value ?? 20)
      const dealAmount = Math.floor(amount * (100 + bonusPct) / 100)
      try { await DB.prepare("CREATE TABLE IF NOT EXISTS user_points (user_id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run() } catch {}
      // 💸 2026-07-05 버킷: 딜 수령(+보너스) = 무상 딜 — paid 로 두면 [현금정산 100 → 딜 120 → 재출금]
      //   +보너스% 차익 세탁 루프가 열림. 딜 선택은 플랫폼 내 사용 목적(보너스가 그 대가) → free 태깅.
      const { creditFreePoints } = await import('../../../../worker/utils/point-buckets')
      await creditFreePoints(DB, {
        userId: influencerId,
        amount: dealAmount,
        type: 'influencer_payout',
        description: `인플 정산 (딜 +${bonusPct}% 보너스)`,
      }).catch(swallow('marketing:influencer-payout:balance'))
    }
    // 💰 2026-08-31: 현금 경로 — 실송금액을 SSOT 로 계산해 **응답으로 돌려준다**.
    //   그전엔 이 엔드포인트가 잔액만 0 으로 밀고 끝이라, 어드민이 얼마를 보내야 하는지는
    //   화면이 자기 상수로 따로 계산했다(원천징수 3곳 중복). 수수료가 붙으면 그 갈림이 곧 돈 문제다.
    //   ⚠️ 실제 송금은 여전히 사람이 한다 — 이 값은 "얼마를 보내라"의 단일 출처다.
    let cashBreakdown: ReturnType<typeof computeCashPayout> | null = null
    if (body.method !== 'deal') {
      const meta = await DB.prepare(
        'SELECT tax_type, business_number FROM influencer_balances WHERE influencer_id = ?'
      ).bind(influencerId).first<{ tax_type: string | null; business_number: string | null }>().catch(() => null)
      const feeRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'influencer_payout_cash_fee_pct'").first<{ value: string }>().catch(() => null)
      cashBreakdown = computeCashPayout({
        gross: amount,
        taxType: meta?.tax_type,
        businessNumber: meta?.business_number,
        feePct: resolveCashFeePct(feeRow?.value),
      })
    }
    // attribution paid 처리 (잔고 claim 은 위에서 완료).
    await c.env.DB.prepare(
      `UPDATE influencer_attributions SET status = 'paid', paid_at = datetime('now')
       WHERE influencer_id = ? AND status = 'available' AND paid_at IS NULL`
    ).bind(influencerId).run()
    return c.json({ success: true, amount, cash: cashBreakdown })
  })

}
