/**
 * 👥 정산 열람 범위 — **운영자는 합류 전 정산을 보지 않는다** (2026-09-07 대표 지시)
 *
 * 대표: *"귀속되는 시점부터 계산해서 성과 수익이 계산되어야 하지 않을까?"*
 *
 * ## 무엇이 문제였나
 * `GET /api/seller/settlements/payouts` 는 `payload.seller_id` 만 보고 **그 매장의 전 기간**
 * 지급 이력을 돌려줬다. 이 파일이 생기기 전 그 라우트에는 소유자 게이트가 **0개**였다 —
 * 위임받아 들어온 운영자에게 이전 주인의 정산 내역이 통째로 열렸다.
 *
 * ⚠️ **돈이 새는 건 아니다.** 송금 목적지는 여전히 `sellers.bank_account` 하나다
 *   (`payouts-generate.ts`). 새는 건 **정보**이고, 동시에 *"이게 내 실적"* 이라는 **오해**다 —
 *   합류 전 매출까지 자기 몫으로 보인다.
 *
 * ## 자를 기준은 이미 데이터에 있다
 * `seller_operators.granted_at`. 새 컬럼도 마이그레이션도 필요 없고, 그 값을 **돈 코드가
 * 한 번도 읽지 않고 있었을** 뿐이다.
 *
 * ## ⚠️ 이 helper 가 하지 않는 것
 *   - 소유자에게는 아무 제한도 걸지 않는다(종전 그대로 전 기간).
 *   - 원장(`ledger_entries`) 자체를 자르지 않는다 — 매장 잔액 `payable` 은 여전히 매장 돈이다.
 *     화면이 그 값을 운영자의 "내 몫" 으로 쓰면 안 된다(그래서 `scope` 를 함께 돌려준다).
 */
import type { D1Database } from '@cloudflare/workers-types'

export interface SettlementScope {
  /** 'owner' 면 전 기간, 'operator' 면 합류 이후만. */
  scope: 'owner' | 'operator'
  /** 이 시각 이후의 payout 만 보여 준다. 소유자면 null(제한 없음). */
  since: string | null
  /** 화면에 보일 합류 시각. 못 찾았으면(=전부 가림) null. */
  displaySince: string | null
}

/** 관계를 못 찾았을 때 쓰는 값 — **모르면 안 보여 준다**(가장 좁게 자른다). */
const DENY_ALL = '9999-12-31'

export async function resolveSettlementScope(
  DB: D1Database,
  sellerId: number | string,
  authorization: string | undefined,
  jwtSecret: string,
): Promise<SettlementScope> {
  const { resolveStoreActor } = await import('./store-actor')
  const actor = await resolveStoreActor(authorization, jwtSecret)
  if (actor.isOwner || !actor.operatorUserId) {
    return { scope: 'owner', since: null, displaySince: null }
  }

  const g = await DB.prepare(
    `SELECT granted_at FROM seller_operators
      WHERE seller_id = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1`,
  ).bind(sellerId, actor.operatorUserId).first<{ granted_at: string | null }>().catch(() => null)

  const since = g?.granted_at || DENY_ALL
  return { scope: 'operator', since, displaySince: since === DENY_ALL ? null : since }
}
