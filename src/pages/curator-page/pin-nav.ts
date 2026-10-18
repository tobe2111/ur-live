/**
 * 📌 유어샵 진열 카드 → 상세, **앱 안 이동**(2026-10-18 대표 결재 `2026-10-15-ushop-pin-spa-nav` 안 1 ·
 * 대표 *"모두 가장 이상적으로 진행해줘"*).
 *
 * 종전: 카드 → `/u/:handle/p/:id` → `window.location.replace` → 서버가 클릭 기록 후 302 → **전체 새로고침 약 2.1초**
 * (라이브 실측 2026-10-15). 홈 카드 → 상세는 87ms 다.
 *
 * 지금: 누르는 순간 셋을 하고 상세로 앱 안 이동한다.
 *   ① 소개 값 저장 — 상세 화면이 `?aff=` 를 받을 때 쓰는 **같은 함수**(`storeAffiliateRef`).
 *      커미션은 결제 때 실어 보내는 이 값으로 정해진다(클릭 기록이 아니다).
 *   ② 클릭 기록 — `sendBeacon`(유어샵 통계용 · 유실돼도 커미션 무관).
 *   ③ 목적지 — 정본 주소 SSOT(`detailHref`). 숙소는 이제 `/stays` 로 간다(종전엔 귀속을 걸려고 `/pass` 로 보냈다).
 *
 * 🔒 바깥에 공유된 `/u/:handle/p/:id` 링크(카톡·SNS)는 **그대로 서버 경유**다 — 라우트(`CuratorPinClientRedirect`)와
 *    서버 리다이렉트는 지우지 않는다. 이 파일은 *유어샵 화면 안의 카드*만 바꾼다.
 */
import { detailHref } from '@/shared/product-flow'
import { storeAffiliateRef } from '@/utils/affiliate-track'

/** 카드의 목적지 — 정본 상세 주소. */
export function pinHref(pin: { product_id: number; deal_only?: number | null; category?: string | null }): string {
  return detailHref({ id: pin.product_id, deal_only: pin.deal_only, category: pin.category })
}

/** 클릭 기록 비콘. 응답을 안 기다린다(통계 전용). */
export function recordPinClick(handle: string, productId: number): void {
  try {
    const url = `/api/curator/${encodeURIComponent(handle)}/p/${encodeURIComponent(String(productId))}/click`
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url)
      return
    }
    void fetch(url, { method: 'POST', keepalive: true }).catch(() => { /* 통계 — 무시 */ })
  } catch { /* 통계 실패가 이동을 막지 않는다 */ }
}

/** 카드를 누른 순간 — 소개 값 저장(①) + 클릭 기록(②). 이동은 `Link` 가 한다(③). */
export function onPinClick(handle: string, curatorUserId: number | null | undefined, productId: number): void {
  if (curatorUserId) storeAffiliateRef(String(curatorUserId)) // 본인 유어샵이면 함수가 알아서 건너뛴다
  recordPinClick(handle, productId)
}
