/**
 * 🧾 후기 보너스 — **얼마를, 누가 부담하나** (2026-08-31 대표 지시).
 *
 * > "후기 보너스는 그러면 매장 사장님이 설정할 수 있도록 하자. 셀러 대시보드에서 말이야.
 * >  유어딜이 주는게 아니라 매장 사장님이 부담하게끔."
 *
 * ## 왜 매장인가
 * 카카오 지도의 별점·리뷰 수는 **그 매장의 자산**이다. 유어딜이 매장 마케팅 비용을 대신 낼 이유가 없다.
 *
 * ## 지금 이 파일이 하는 것 / 안 하는 것
 * - ✅ **금액**: 매장이 정한 값(`seller_meta.review_bonus_amount`)이 있으면 그것, 없으면 플랫폼 기본값.
 *   ⇒ 매장이 아무것도 안 하면 **오늘과 완전히 동일**하다.
 * - ✅ **재원 표기**: 그 건이 매장 부담인지(`owner`) 유어딜 부담인지(`platform`) 판정해 기록한다.
 * - ⛔ **정산 차감은 아직 안 한다.** 게이트 `review_bonus_owner_funded`(platform_settings, 기본 OFF)가
 *   켜지기 전까지 판정은 항상 `platform` 이다. 실제 매장 원장 차감은 **머니 경로**라
 *   CLAUDE.md 룰대로 단독 세션 + staging 실결제 뒤에 붙인다.
 *
 * ⇒ **이 PR 은 라이브 금액을 바꾸지 않는다.** 매장이 값을 넣기 전까지는.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { ensureSellerMetaTable, getSellerMeta } from '@/worker/utils/seller-meta'

/** 매장별 금액이 사는 곳 — sellers 는 100컬럼 한도라 K-V 사이드테이블. */
export const REVIEW_BONUS_META_KEY = 'review_bonus_amount'
/** 매장 부담으로 실제 정산 차감을 시작하는 스위치 (기본 OFF). */
export const OWNER_FUNDED_SETTING = 'review_bonus_owner_funded'

/** 한 건이라도 음수·비정상 금액이 나가지 않게. 상한은 오타 방지용. */
const MAX_BONUS = 100_000

export interface ReviewBonusPolicy {
  /** 실제로 지급할 딜 */
  amount: number
  /** 이 건의 재원 — 'owner' 면 매장이 부담(정산 차감 대상), 'platform' 이면 유어딜 */
  fundedBy: 'owner' | 'platform'
  /** 매장이 직접 정한 값인가 (아니면 플랫폼 기본값) */
  storeSet: boolean
}

async function settingValue(DB: D1Database, key: string): Promise<string | null> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(key).first<{ value: string }>().catch(() => null)
  return row?.value ?? null
}

/**
 * 이 매장의 후기 보너스 정책을 판정한다.
 *
 * ⚠️ `sellerId` 가 없으면(상품에 매장이 안 붙은 데모 등) 플랫폼 기본값·플랫폼 부담이다 —
 *   없는 매장에 청구할 수는 없다.
 */
export async function resolveReviewBonus(DB: D1Database, sellerId: number | null | undefined): Promise<ReviewBonusPolicy> {
  const fallback = Math.max(0, Math.min(MAX_BONUS, Number(await settingValue(DB, 'kakao_review_bonus_amount') ?? 1000) || 0))

  if (sellerId == null) return { amount: fallback, fundedBy: 'platform', storeSet: false }

  let storeAmount: number | null = null
  try {
    await ensureSellerMetaTable(DB)
    const meta = await getSellerMeta(DB, [Number(sellerId)])
    const raw = meta.get(Number(sellerId))?.[REVIEW_BONUS_META_KEY]
    if (raw != null && String(raw).trim() !== '') {
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) storeAmount = Math.min(MAX_BONUS, Math.round(n))
    }
  } catch { /* 메타 조회 실패 → 플랫폼 기본값 (fail-soft: 후기 흐름을 막지 않는다) */ }

  const storeSet = storeAmount != null
  const ownerGateOn = String(await settingValue(DB, OWNER_FUNDED_SETTING) ?? 'false') === 'true'

  return {
    amount: storeSet ? (storeAmount as number) : fallback,
    // 🔒 게이트가 켜지고 **매장이 직접 정한 건**일 때만 매장 부담. 그 전까지는 전부 유어딜 부담 —
    //    매장이 모르는 사이에 청구되는 일이 없어야 한다.
    fundedBy: ownerGateOn && storeSet ? 'owner' : 'platform',
    storeSet,
  }
}
