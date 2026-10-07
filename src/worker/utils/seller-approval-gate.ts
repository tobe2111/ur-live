/**
 * 🪑 **셀러 좌석 판정 — "모르겠다" 와 "알겠는데 아직 승인 전" 을 가른다** (2026-10-07)
 *
 * ## 왜 생겼나 (대표 신고 — 매장 등록 직후 `/seller/login` 으로 튕김)
 * 라이브에서 대표가 매장을 등록하자 **"로그인이 만료되었습니다"** 가 뜨고 셀러 로그인 화면으로
 * 내던져졌다. 세션은 멀쩡했다. 세 규칙이 겹친 결과였고 **각각은 따로 보면 다 맞다**:
 *
 * 1. `POST /stores` 로 매장이 생긴다 — `status='pending'`(승인 대기).
 * 2. `POST /stores/:id/token` 이 **좌석을 연다** — `isSeatableStoreStatus` 가 대기·반려도 들여보낸다
 *    (2026-09-20 당근 모델: *"준비는 지금, 노출·정산은 승인 뒤"*).
 * 3. 그런데 좌석을 받고 들어간 첫 화면이 부르는 `GET /seller/orders` 는 `approved|active` 만 보고
 *    **401** 을 돌려줬다.
 * 4. 클라의 401 인터셉터는 *"`/api/seller/` + `seller_token` 존재 = 셀러 세션 만료"* 로 읽어
 *    **방금 받은 좌석 토큰을 지우고** `/seller/login?error=session_expired` 로 하드 이동했다.
 *
 * ⇒ **좌석은 문을 열어 주는데 문 바로 뒤가 401이었다.** 그리고 그 401이 "인증 실패" 로 오독됐다.
 *
 * ## 규칙
 * 401 은 **"네가 누구인지 모르겠다"** 일 때만 쓴다. 토큰이 유효하고 그 매장이 실재하는데 아직
 * 승인 전이면 그건 인증 실패가 아니라 **상태**다 ⇒ `403` + `code:'SELLER_PENDING_APPROVAL'`.
 * 그래야 ① 인터셉터가 세션 만료로 오독할 수 없고 ② 화면이 *"승인 대기 중이에요"* 라고 말할 수 있다.
 *
 * 🔴 **권한을 넓히지 않는다** — 승인 전 매장은 여전히 주문을 못 본다(데이터 0). 바뀌는 것은
 *    *거절하는 방식*뿐이다. 노출(`approvedSellerProductSql`)·정산(`isPayoutEligibleSellerStatus`)의
 *    승인 게이트는 그대로다.
 *
 * ⚠️ 이 파일이 **못 보는 것**: 좌석 토큰이 가리키는 매장을 이 사람이 운영할 수 있는지(그건
 *    토큰 발급 시 `canOperateStore` 가 이미 봤다). 여기서는 토큰의 유효성과 매장 상태만 본다.
 */
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { isPayoutEligibleSellerStatus } from '@/shared/seller-status'

export type SellerSeatGate =
  /** 승인된 활성 매장 — 그대로 진행. */
  | { ok: true; sellerId: number }
  /** 토큰이 없거나 깨졌다 — 진짜 인증 실패(401). */
  | { ok: false; reason: 'no_token' }
  /** 토큰은 멀쩡한데 매장 행이 없다 — 역시 401(가리키는 대상이 사라졌다). */
  | { ok: false; reason: 'no_seller' }
  /** 좌석은 유효, 아직 승인 전(또는 비활성) — 403. */
  | { ok: false; reason: 'not_approved'; status: string; sellerId: number }

/**
 * 좌석 토큰 → 승인된 셀러 id. 실패하면 **왜 실패했는지**를 함께 돌려준다.
 * (종전 `getActiveSellerId` 는 셋을 전부 `null` 로 뭉개서 호출부가 401 밖에 못 줬다.)
 */
export async function resolveApprovedSeller(
  DB: D1Database,
  authorization: string | undefined,
  jwtSecret: string,
): Promise<SellerSeatGate> {
  const id = await getSellerIdFromToken(authorization, jwtSecret)
  if (!id) return { ok: false, reason: 'no_token' }
  const row = await DB.prepare('SELECT id, status, is_active FROM sellers WHERE id = ? LIMIT 1')
    .bind(id).first<{ id: number; status: string | null; is_active: number | null }>()
    .catch(() => null)
  if (!row) return { ok: false, reason: 'no_seller' }
  // 🔑 승인 집합은 `shared/seller-status.ts` 한 곳에서만 온다 — 여기에 문자열을 다시 적지 않는다.
  //    (`'approved'`/`'active'` 혼용은 2026-05-07 에 이미 사고가 났던 자리다.)
  const approved = isPayoutEligibleSellerStatus(row.status) && row.is_active !== 0
  if (!approved) {
    return { ok: false, reason: 'not_approved', status: String(row.status ?? ''), sellerId: id }
  }
  return { ok: true, sellerId: id }
}

/** 승인 대기 매장에 돌려줄 표준 응답 본문. 화면이 `code` 로 분기한다. */
export const SELLER_PENDING_APPROVAL = {
  success: false as const,
  error: '매장 승인 대기 중입니다 — 승인되면 주문을 볼 수 있어요.',
  code: 'SELLER_PENDING_APPROVAL' as const,
}
