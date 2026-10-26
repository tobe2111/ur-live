/**
 * 🏪 매장이 이용권을 **사용 처리**하는 핵심 — 조회·권한·상태 검사 + 원자 CAS + 정산 원장 기록.
 *
 * ## 왜 따로 뺐나 (2026-10-10 대표 "카카오톡으로 유어딜 세팅도 가능해? 이용권 관리같은거")
 * 계산대 스캔(`POST /api/group-buy/:code/use-by-seller`)과 **카카오톡 채널 챗봇**(`사용 ABCD1234`)이
 * 같은 일을 한다. SQL 을 두 벌로 베끼면 한쪽만 고쳐지는 날이 반드시 온다 — 그리고 이 경로는
 * 원장(정산)을 쓰므로 갈라지면 **매장 돈이 한쪽 경로에서만 빠진다**(에러는 안 난다).
 * ⇒ 그 라우트의 본문을 **행동 그대로** 여기로 옮겼고, 두 진입점이 이 함수 하나를 부른다.
 *
 * ## 무엇이 여기 있고 무엇이 호출부에 남나
 * - 여기: 만료 전이 · 조회 · 소유 매장 검사 · 상태 검사 · CAS(`unused`→`used`) · 방문 이벤트 · 원장 3종.
 * - 호출부: 인증(누가 이 매장의 사람인가) · 응답 모양 · 알림톡(손님 사용 알림)·커미션 표시.
 *   (챗봇은 알림톡을 보내지 않는다 — 이 기능의 안전 규칙. 핸드오프에 대표 판단으로 남김.)
 *
 * ⚠️ 원장 기록 블록에 설정값 게이트를 두지 말 것 — 게이트가 생기면 "켜도 빠지는 정산은 없다"가 거짓이 된다
 *   (`settlement-gate-direction-2026-09-29` 와 같은 불변식, 이 파일은 `kakao-bot-store-ops` 시험이 지킨다).
 */

import { GIFT_PENDING_USE_BLOCKED, noPendingGiftSql, voucherHasPendingGift } from './voucher-gift'
import { canStoreRedeemProduct } from './brand-wide-redeem'
import { recordVoucherRedeemStore, settlementMerchantFor } from './brand-cross-owner'
import { markStayBookingUsed, stayLinkForVoucher, stayRedeemBlock, type StayVoucherLink } from '../../features/group-buy/api/stay-voucher-unify'

export const SELLER_REDEEM_CODE_RE = /^[A-Za-z0-9-]{4,64}$/

export interface StoreRedeemVoucher {
  id: number
  status: string
  user_id: string
  product_id: number
  applied_price: number | null
  seller_id: number
  consigned_from_seller_id: number | null
  product_name: string
  restaurant_name: string | null
  category: string | null
}

export type StoreRedeemCheck =
  | { ok: true; voucher: StoreRedeemVoucher; stay?: StayVoucherLink | null }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string }

export type VoucherVisitPath = 'seller_scan' | 'kakao_bot'

/**
 * 사용 처리 **전** 검사 — 만료 전이 후 조회해서 이 매장이 처리할 수 있는 상태인지 본다.
 * `actorSellerId === null` 은 어드민(소유 검사 생략). 챗봇은 늘 숫자를 넘긴다.
 * 문구는 계산대 라우트의 종전 응답과 byte-동일하다(화면이 그 문자열을 그대로 띄운다).
 */
export async function checkVoucherForStore(
  DB: D1Database,
  code: string,
  actorSellerId: number | null,
  opts: { stayAfterManual?: boolean } = {},
): Promise<StoreRedeemCheck> {
  if (!code || !SELLER_REDEEM_CODE_RE.test(code)) {
    return { ok: false, status: 400, error: '잘못된 바우처 코드' }
  }

  // 만료 차단
  try {
    await DB.prepare(
      "UPDATE vouchers SET status = 'expired' WHERE code = ? AND status = 'unused' AND expires_at IS NOT NULL AND expires_at < datetime('now')"
    ).bind(code).run()
  } catch { /* ignore */ }

  // voucher + product seller 검증
  const voucher = await DB.prepare(
    `SELECT v.id, v.status, v.user_id, v.product_id, v.applied_price,
            p.seller_id, NULL AS consigned_from_seller_id, p.name AS product_name, p.restaurant_name, p.category
     FROM vouchers v LEFT JOIN products p ON p.id = v.product_id
     WHERE v.code = ?`
  ).bind(code).first<StoreRedeemVoucher>()
  if (!voucher) return { ok: false, status: 404, error: '바우처를 찾을 수 없습니다' }
  // 🏷️ 2026-10-18 브랜드 전 지점 사용 — 판 지점이 아니어도, 이용권이 켜져 있고 주인이 같은 형제 지점이면 받는다.
  //   정산은 판 지점(voucher.seller_id)으로 간다. 🏷️ 3단계(게이트 ON · 다른 점주 지점)만 예외 — 아래 CAS 직후
  //   `recordVoucherRedeemStore` 가 받은 지점을 적고, 원장은 `settlementMerchantFor` 로 그 지점을 정산받는 매장으로 쓴다.
  if (actorSellerId !== null && Number(voucher.seller_id) !== Number(actorSellerId)
      && !(await canStoreRedeemProduct(DB, Number(voucher.product_id), voucher.seller_id, Number(actorSellerId), Number(voucher.id)))) {
    return { ok: false, status: 403, error: '본인 매장의 voucher 가 아닙니다' }
  }
  if (voucher.status === 'used') return { ok: false, status: 400, error: '이미 사용된 바우처입니다' }
  if (voucher.status === 'expired') return { ok: false, status: 400, error: '만료된 바우처입니다' }
  if (voucher.status === 'refunded') return { ok: false, status: 400, error: '환불된 바우처입니다' }
  // 🎁 2026-10-12 선물 중(받기 전)인 이용권은 사장님 스캔으로도 쓸 수 없다 — 보낸 사람이 회수해야 풀린다.
  if (await voucherHasPendingGift(DB, { id: voucher.id })) return { ok: false, status: 409, error: GIFT_PENDING_USE_BLOCKED }
  // 🏡 2026-10-25 숙소=이용권 통일 — 숙소 예약에 묶인 이용권은 예약 상태·체크인 날짜를 함께 본다.
  const stay = await stayLinkForVoucher(DB, { id: voucher.id })
  if (stay) {
    const block = stayRedeemBlock(stay, { afterManual: opts.stayAfterManual })
    if (block) return { ok: false, status: 409, error: block }
  }
  return { ok: true, voucher, stay }
}

/**
 * 사용 처리 — 검사 → CAS → 방문 이벤트·정산 원장(백그라운드, 멱등).
 * `waitUntil` 은 호출부의 실행 컨텍스트에 붙인다(응답 후에도 원장 기록이 끝나도록).
 */
export async function redeemVoucherForStore(
  DB: D1Database,
  opts: {
    code: string
    actorSellerId: number | null
    path: VoucherVisitPath
    waitUntil: (p: Promise<unknown>) => void
    /** 사장님이 숙소 관리 화면에서 체크인을 누른 뒤 묶인 이용권을 정리할 때(예약은 이미 옮겨졌다). */
    stayAfterManual?: boolean
  },
): Promise<StoreRedeemCheck> {
  const checked = await checkVoucherForStore(DB, opts.code, opts.actorSellerId, { stayAfterManual: opts.stayAfterManual })
  if (!checked.ok) return checked
  const voucher = checked.voucher

  // atomic CAS
  const result = await DB.prepare(
    `UPDATE vouchers SET status = 'used', used_at = datetime('now') WHERE id = ? AND status = 'unused' AND ${noPendingGiftSql('vouchers.id')}`,
  ).bind(voucher.id).run()
  if (!result.meta?.changes) return { ok: false, status: 409, error: '동시성 충돌 — 다시 시도해주세요' }

  // 🏡 숙소 이용권이면 예약을 체크인으로(이미 옮겨졌으면 CAS no-op). 원장은 아래 공통 블록이 남긴다.
  if (checked.stay) await markStayBookingUsed(DB, checked.stay, opts.actorSellerId)

  // 🏷️ 2026-10-18 3단계 — 어느 지점이 받았는지 적는다(판 지점이면 옛 기록을 지운다). 원장보다 **먼저** 끝나야
  //   아래 원장이 그 기록을 읽는다 — 그래서 waitUntil 이 아니라 await 다. 실패는 삼킨다(정산은 판 지점 그대로).
  if (opts.actorSellerId !== null) {
    await recordVoucherRedeemStore(DB, {
      voucherId: Number(voucher.id), soldSellerId: voucher.seller_id, storeSellerId: Number(opts.actorSellerId),
    }).catch(() => { /* 기록 실패 = 판 지점 정산(종전) */ })
  }

  // 🚪 2026-07-13 (데이터 감사 2단계): 방문 통합 이벤트 — 완결고리 '방문' 노드(멱등·best-effort).
  opts.waitUntil((async () => {
    try {
      const { recordVoucherVisit } = await import('./voucher-visit')
      await recordVoucherVisit(DB, {
        voucher_id: voucher.id, user_id: voucher.user_id,
        seller_id: voucher.consigned_from_seller_id ?? voucher.seller_id,
        product_id: voucher.product_id, amount: voucher.applied_price, path: opts.path,
      })
    } catch { /* best-effort */ }
  })())

  // 🛡️ 2026-05-21 Phase C: 정산 ledger entries 3개 자동 기록 (멱등).
  opts.waitUntil((async () => {
    try {
      const { recordVoucherUsedLedger } = await import('./ledger'); const { debitOwnerPromoForOrder } = await import('./owner-promo')
      // 정산받는 매장 — 다른 점주 지점이 받았으면 그 지점(3단계), 아니면 종전 그대로. Rail A 와 같은 기록을 읽는다.
      const merchantId = await settlementMerchantFor(DB, Number(voucher.id), voucher.consigned_from_seller_id ?? voucher.seller_id)
      const sellerForCommission = voucher.consigned_from_seller_id ? voucher.seller_id : null
      const amount = voucher.applied_price || 0
      if (merchantId && amount > 0) {
        await recordVoucherUsedLedger(DB, {
          voucher_id: voucher.id,
          order_amount: amount,
          merchant_id: merchantId,
          seller_id: sellerForCommission,
        })
        // 🌇 2026-09-04 에이전시 완전 일몰 — 여기 있던 `recordAgencyCommissionShare`(플랫폼 수수료의
        //    30% 를 영입 에이전시에 자동 분배)를 삭제했다. 대표 확정: **5% 는 온전히 유어딜 몫**이고
        //    중개사는 나머지 95%(매장 몫)에서 매장과 직접 거래한다. 이 코드는 그 원칙과 정반대였고,
        //    `sellers.introduced_by_agency_id` 가 전원 NULL 이라 실제로 지급된 적은 없다.
        //    🛑 2026-10-10 대표 *"마저 폐지해줘. 모두 다"* — 짝이던 영입 셰어(수수료 20%)도 삭제. 사유는 ledger.ts 묘비.
        // 💸 2026-07-04 [INV-CB §3-D]: promo owner-펀딩 — 이 voucher 셀렉트엔 order_id 가 없어
        //   voucherId 로 전달(헬퍼가 vouchers.order_id 해석). 게이트 아닐 땐 내부 no-op(현행).
        await debitOwnerPromoForOrder(DB, {
          voucherId: voucher.id,
          ownerAccount: `merchant:${merchantId}`,
        })
      }
    } catch (e) { if (import.meta.env?.DEV) console.warn('[voucher-used-ledger]', e) }
  })())

  return { ok: true, voucher }
}
