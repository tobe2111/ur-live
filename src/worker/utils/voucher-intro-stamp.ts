/**
 * 🤝 **이용권을 판 시점의 영입자를 도장 찍는다** (2026-09-09)
 *
 * ## 왜 필요한가 — 대표 원칙의 마지막 미적용 레일
 * 대표: *"귀속되는 시점부터 계산해서 성과 수익이 계산되어야 하지 않을까?"*
 *
 * 이용권 **사용** 레일(`ledger.ts recordIntroductionCommissionShare`)은 사용 시점에 매장의
 * *현재* 영입자를 읽는다. 그래서 영입자가 바뀌면 **과거에 팔린 이용권의 커미션까지 오늘의
 * 영입자에게** 간다 — 소급이고, 에러가 안 나서 아무도 모른다.
 *
 * ⇒ **판 시점에 판정해서 이용권 행에 적어 둔다.** 사용 시점은 그 도장을 읽기만 한다.
 *
 * ## 도장이 두 칸인 이유
 * `introduced_by_influencer_id` 만으로는 **"영입자 없음"과 "옛 이용권(판정 안 함)"이 구분되지
 * 않는다.** 구분을 못 하면 이 변경 이전에 팔린 이용권이 전부 "없음"으로 접혀 **실제 보상이
 * 사라진다.** 그래서 `intro_stamped_at`(판정했다는 표시)을 함께 찍는다.
 *
 * ## ⚠️ 이 모듈이 하지 않는 것
 *   - **돈을 움직이지 않는다.** 판정해서 값을 돌려줄 뿐이고, 적립은 종전 그대로 사용 레일이 한다.
 *   - 옛 이용권을 백필하지 않는다 — 오늘의 영입자를 과거에 적어 넣는 건 **없던 사실을 만드는 일**이다.
 *     도장이 없으면 사용 레일이 종전 규칙(현재 영입자 + 기간 판정)으로 떨어진다.
 *   - 만료 창은 **판 시점 기준**으로 본다. 팔 때 창이 닫혀 있었으면 도장은 NULL 이고,
 *     그 뒤 창이 다시 열려도(영입자 재배정) 그 이용권은 소급되지 않는다 — 그게 이 변경의 요점이다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export interface VoucherIntroStamp {
  /** 판 시점에 보상받을 영입자. 없거나 만료면 null. */
  introducerId: number | null
  /** 판정 시각(ISO) — 이 값이 있으면 "판정했다"는 뜻이다. */
  stampedAt: string
}

/**
 * 지금(=판매 시점) 이 매장의 보상 대상 영입자를 판정한다.
 *
 * **fail-soft**: 조회가 실패하면 `introducerId: null` 로 도장을 찍는다 — 결제를 막지 않는다.
 * ⚠️ 그 대가는 "몰라서 못 준다" 이고, 반대(모르는데 주기)보다 이쪽이 싸다.
 */
export async function resolveVoucherIntroStamp(
  DB: D1Database,
  sellerId: number | null | undefined,
): Promise<VoucherIntroStamp> {
  const stampedAt = new Date().toISOString()
  const sid = Number(sellerId)
  if (!Number.isFinite(sid) || sid <= 0) return { introducerId: null, stampedAt }

  try {
    const seller = await DB.prepare(
      'SELECT introduced_by_influencer_id, introduced_at, referral_bonus_until FROM sellers WHERE id = ? LIMIT 1',
    ).bind(sid).first<{
      introduced_by_influencer_id: number | null
      introduced_at: string | null
      referral_bonus_until: string | null
    }>()
    if (!seller?.introduced_by_influencer_id) return { introducerId: null, stampedAt }

    // 만료 판정은 결제 레일과 **같은 SSOT** 를 쓴다 — 레일마다 기간이 다르면 그게 다음 사고다.
    const { isStoreIntroExpired } = await import('./influencer-store-intro-commission')
    const monthsRow = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'influencer_store_intro_months'",
    ).first<{ value: string }>().catch(() => null)
    const { COMMISSION_DEFAULTS: CD } = await import('../../shared/constants/policy')
    const introMonths = Number(monthsRow?.value) > 0
      ? Number(monthsRow?.value)
      : CD.INFLUENCER_STORE_INTRO_MONTHS
    if (isStoreIntroExpired(seller, introMonths)) return { introducerId: null, stampedAt }

    return { introducerId: Number(seller.introduced_by_influencer_id), stampedAt }
  } catch {
    return { introducerId: null, stampedAt }
  }
}
