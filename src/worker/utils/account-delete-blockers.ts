/**
 * 🚪 회원 탈퇴를 막는 것 — 돈·가게가 걸려 있으면 먼저 정리하게 한다 (2026-10-19 대표 결재 *"권장안대로 해줘"*)
 *
 * 결재 `docs/decisions/2026-10-19-account-deletion-assets.md` 안 2. 셀러 탈퇴(`countWithdrawBlockers`)와 같은 원칙이다:
 *   **결제한 돈이 묶이거나 가게가 주인 없이 남으면 못 나간다.** 막고 끝내지 않고 무엇을 정리할지 보여 준다.
 *
 * | 막는 것 | 왜 | 정리하는 길 |
 * |---|---|---|
 * | 안 쓴 매장 이용권 | 탈퇴하면 로그인을 못 해 매장에서 못 쓰고, 30일 뒤엔 영영 못 쓴다(이용권은 잠든 계정에 묶인다) | 쓰거나 환불 요청 |
 * | 환급 가능한 충전 딜 | 탈퇴 순간 딜은 0 이 된다(`zeroOutUserPoints`) — 손님이 낸 돈이 사라진다 | 환급 신청(`POST /api/points/refund`) |
 * | 처리 중인 딜 환급 신청 | 반려되면 딜이 **탈퇴한 계정**으로 돌아간다 | 처리가 끝날 때까지 기다림 |
 * | 주인인 가게 | 가게는 별도 신원이라 손님 탈퇴가 안 건드린다 — 주인 없는 가게가 남는다 | 가게 탈퇴 먼저 |
 *
 * 무상 딜(선물·보상)은 막지 않는다 — 결재대로 고지하고 소멸한다. 쿠폰·찜·단골도 지금대로 즉시 삭제.
 *
 * 🔒 **돈을 움직이지 않는다.** 세기만 한다. 그리고 **조회가 깨지면 막는다**(fail-closed) — "모르면 연다" 면
 *   잔액을 못 읽은 순간 충전 딜이 소리 없이 사라진다. 화면은 "확인하지 못했어요" 를 따로 말한다.
 */
import { getDealRefundState } from './deal-refund'
import { resolveUserId, resolveUserIdString } from './resolve-user-id'

export interface AccountDeleteBlockers {
  /** 아직 안 쓴 매장 이용권(교환권·KT 기프티콘 제외 — 지갑의 '사용 가능' 과 같은 집합). */
  unused_vouchers: number
  /** 지금 환급 신청할 수 있는 충전 딜(`REFUNDABLE_SQL` SSOT — 환급 화면과 같은 숫자). */
  refundable_deal: number
  /** 처리 중인 딜 환급 신청이 있는가. */
  deal_refund_pending: boolean
  /** 주인으로 있는 운영 중(정지·반려 아님) 가게 수. */
  owned_stores: number
}

/**
 * 안 쓴 매장 이용권 — `/api/vouchers/my` 와 같은 user_id 이중키(정규화 id · raw id)로 센다.
 * 판정은 지갑의 `isUsableWalletItem && isStoreVoucher` 와 같은 집합: `status='unused'` 이고 교환권이 아니다.
 */
export const UNUSED_STORE_VOUCHERS_SQL = `SELECT COUNT(*) AS n
  FROM vouchers v
  LEFT JOIN products p ON p.id = v.product_id
 WHERE v.user_id IN (?, ?)
   AND v.status = 'unused'
   AND COALESCE(p.deal_only, 0) = 0
   AND (p.kt_alpha_gift_code IS NULL OR p.kt_alpha_gift_code = '')`

/**
 * 주인인 가게 — `sellers.linked_user_id`(옛 길) 또는 주인 좌석(`seller_operators` role='owner', `/store/new` 길).
 * 정지(가게 탈퇴가 남기는 상태)·반려는 세지 않는다. 바인드: user id 두 번.
 */
export const OWNED_STORES_SQL = `SELECT COUNT(DISTINCT s.id) AS n
  FROM sellers s
 WHERE COALESCE(s.status, '') NOT IN ('suspended', 'rejected')
   AND (s.linked_user_id = ?
        OR EXISTS (SELECT 1 FROM seller_operators o
                    WHERE o.seller_id = s.id AND o.user_id = ? AND o.role = 'owner' AND o.revoked_at IS NULL))`

/** `seller_operators` 가 없는 옛 환경용 — 옛 길만 센다(그 테이블이 없으면 주인 좌석도 없다). */
const OWNED_STORES_LINKED_ONLY_SQL = `SELECT COUNT(*) AS n FROM sellers
 WHERE COALESCE(status, '') NOT IN ('suspended', 'rejected') AND linked_user_id = ?`

export function isAccountDeleteBlocked(b: AccountDeleteBlockers): boolean {
  return b.unused_vouchers > 0 || b.refundable_deal > 0 || b.deal_refund_pending || b.owned_stores > 0
}

/**
 * 탈퇴를 막는 것을 센다. 하나라도 읽지 못하면 `{ ok:false }` — 호출부는 **탈퇴를 막는다.**
 */
export async function countAccountDeleteBlockers(
  DB: D1Database,
  rawId: string | number,
  isDbId?: boolean,
): Promise<{ ok: true; blockers: AccountDeleteBlockers } | { ok: false }> {
  try {
    const uidRaw = String(rawId)
    const uidNorm = await resolveUserIdString(DB, rawId, isDbId)
    const numId = await resolveUserId(DB, rawId, isDbId)

    const [vouchers, deal, stores] = await Promise.all([
      DB.prepare(UNUSED_STORE_VOUCHERS_SQL).bind(uidNorm, uidRaw).first<{ n: number }>(),
      // 딜은 탈퇴 경로(`deleteUserAccount` → `zeroOutUserPoints`)와 같은 키로 읽는다 — 다른 키로 읽으면
      // 지우는 잔액과 세는 잔액이 갈린다.
      getDealRefundState(DB, uidRaw),
      numId == null
        ? Promise.resolve({ n: 0 })
        : DB.prepare(OWNED_STORES_SQL).bind(numId, numId).first<{ n: number }>()
            .catch(() => DB.prepare(OWNED_STORES_LINKED_ONLY_SQL).bind(numId).first<{ n: number }>()),
    ])
    if (!deal.ok) return { ok: false }

    return {
      ok: true,
      blockers: {
        unused_vouchers: Math.max(0, Number(vouchers?.n) || 0),
        refundable_deal: Math.max(0, Math.floor(Number(deal.state.refundable) || 0)),
        deal_refund_pending: deal.state.pending != null,
        owned_stores: Math.max(0, Number(stores?.n) || 0),
      },
    }
  } catch {
    return { ok: false }
  }
}
