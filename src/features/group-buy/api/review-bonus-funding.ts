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
 * - ✅ **정산 차감**(2026-09-01 배선): 판정이 `owner` 인 건만 매장 원장에서 뺀다
 *   (`debitStoreForReviewBonus`). 게이트 `review_bonus_owner_funded`(platform_settings, 기본 OFF)가
 *   꺼져 있으면 판정이 항상 `platform` 이라 **차감 경로에 아무것도 들어오지 않는다.**
 *
 * ## 순서가 안전장치다
 * 차감은 **보너스를 실제로 지급한 뒤에만** 부른다(`review-bonus.routes.ts` `approveSubmission`).
 * 반대로 붙이면 지급이 실패한 건까지 매장에 물린다 — 유저는 못 받았는데 매장만 내는 상태.
 * 이 순서는 `review-bonus-debit.test.ts` 가 고정한다.
 *
 * ⇒ **게이트 OFF 인 지금 라이브 금액은 바뀌지 않는다.** staging 실결제(S9) 뒤에 켠다.
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

/**
 * 🧾 **매장 부담 후기 보너스 — 원장 차감** (2026-09-01 대표 "모두 다 해줘").
 *
 * #1276 은 재원을 **판정만** 했다(`fundedBy`). 여기서 실제로 매장 정산에서 뺀다.
 *
 * ## 방향
 * 손님에게 나가는 딜은 유어딜이 발행한다. 재원이 매장이면 매장이 그 값을 유어딜에 지는 것이므로
 * `debit seller:{id}` / `credit platform:revenue` 다. `getLedgerReceivable` 이 셀러 계정을
 * Σ(credit) − Σ(debit) 로 잡으므로 **그 매장의 정산액이 보너스만큼 줄어든다.**
 *
 * ## 안 하는 조건 (전부 미차감 쪽으로 떨어진다 — 과청구는 못 되돌린다)
 * - `fundedBy !== 'owner'` (게이트 OFF 이거나 매장이 금액을 안 정함) → 유어딜 부담, 차감 없음
 * - `sellerId` 없음 → 청구할 매장이 없다
 * - 금액 0 이하
 *
 * ## 멱등
 * `reference_id = 'review:{submissionId}'` 로 **제출 1건당 1행**. 재승인·재시도해도 두 번 안 빠진다.
 *
 * ⚠️ **되돌리는 경로는 오늘 없다.** 지급된 건을 다시 무르는 코드가 없기 때문이다
 *   (`rejectSubmission` 은 `submitted → rejected` 만 한다). 그런 경로를 나중에 만든다면
 *   **같은 커밋에서** 이 차감의 역전도 함께 넣어야 한다(머니 룰 #2 적립-역전 대칭).
 *   지금 역전 함수를 미리 만들어 두지 않는 것은 이 레포가 반복해 당한 "만들고 안 부르기"를 피하려는 것이고,
 *   대신 그 불변식을 테스트로 고정했다(`review-bonus-debit.test.ts`).
 */
export async function debitStoreForReviewBonus(
  DB: D1Database,
  params: { submissionId: number; sellerId: number | null | undefined; amount: number; fundedBy: 'owner' | 'platform' },
): Promise<boolean> {
  if (params.fundedBy !== 'owner') return false
  if (params.sellerId == null || !Number.isFinite(params.amount) || params.amount <= 0) return false
  const referenceId = `review:${params.submissionId}`
  try {
    const { recordLedger, ensureLedgerTable } = await import('../../../worker/utils/ledger')
    await ensureLedgerTable(DB)
    const dup = await DB.prepare(
      "SELECT 1 FROM ledger_entries WHERE reference_id = ? AND event_type = 'review_bonus' LIMIT 1"
    ).bind(referenceId).first().catch(() => null)
    if (dup) return false
    await recordLedger(DB, {
      event_type: 'review_bonus',
      reference_id: referenceId,
      amount: Math.round(params.amount),
      debit_account: `seller:${params.sellerId}`,
      credit_account: 'platform:revenue',
      metadata: { kind: 'kakao_review_bonus', funding: 'owner', submission_id: params.submissionId },
    })
    return true
  } catch {
    return false // fail-soft: 차감 실패가 후기 승인을 막지 않는다(미차감 방향 = 안전)
  }
}
