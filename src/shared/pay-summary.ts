/**
 * 🧾 결제 화면 요약 — **표시용** 파라미터 (2026-09-03, 대표 확정 "안 2-D")
 *
 * ■ 왜 필요한가
 *   `/pay/widget` 은 쿼리로 `orderId · amount · orderName · clientKey` **넷만** 받는다.
 *   그래서 결제 화면의 '결제 상품' 칸에 그릴 수 있는 게 **문자열 한 줄과 숫자 한 개**뿐이었다
 *   (대표 지적: *"지금은 밋밋하잖아"*). 사진도 매장명도 정가도 그 화면에 **도착조차 안 한다.**
 *
 *   결제창을 여는 쪽(공구 상세·숙소 체크아웃)은 그 값을 **이미 화면에 띄우고 있다.**
 *   그러니 새 fetch 도 서버 변경도 없이, 쿼리에 몇 개 더 실어 보내면 된다.
 *
 * ■ 🔒 이건 **표시용이다. 금액 판단에 쓰지 말 것.**
 *   쿼리는 누구나 고칠 수 있다. 실제 청구액은 지금도 서버가 승인 시점에 다시 검증한다
 *   (`payment.routes /confirm` 의 `serverTotal !== parsedAmount` → 거부).
 *   여기 값이 틀리면 **자기 화면의 사진·매장명이 이상해질 뿐**이고, `orderName` 은
 *   이미 오늘도 같은 성질의 값이라 새로 생기는 위험은 없다.
 *   ⚠️ 그래서 `origAmount`(정가)는 **취소선 표시 전용**이다 — 할인율 계산도 화면 안에서만 쓴다.
 */

export interface PaySummary {
  /** 상품 사진(절대 URL). 렌더는 반드시 `cfImage` 경유 — 호스트 화이트리스트 + onError 폴백. */
  image?: string
  /** 매장·브랜드명 — 상품명 위 작은 줄. */
  merchant?: string
  /** 정가(원). 판매가보다 클 때만 취소선·할인율로 쓴다. */
  origAmount?: number
  /** 수량. 1 이면 표시 생략. */
  qty?: number
  /**
   * 이 결제에서 **딜로 내는 금액**(원). 0 이면 표시 생략.
   *
   * ⚠️ 클라이언트가 추정한 값이 아니라 **서버 `/join` 이 계산해 돌려준 값**만 싣는다.
   *   부분결제 게이트가 꺼져 있으면 서버가 0 을 주므로 화면도 아무 말 안 한다 —
   *   화면이 잔액만 보고 "8,000원 될 거예요" 를 지어내면 게이트 상태와 갈려 **거짓말**이 된다.
   */
  dealUsed?: number
}

/** 사진 URL 로 받아들일 수 있는 형태인지 — 스킴만 본다(호스트 판정은 `cfImage` SSOT 가 한다). */
export function isDisplayableImageUrl(v: string | null | undefined): v is string {
  if (!v || v.length > 600) return false
  return /^https?:\/\//i.test(v)
}

/** 쿼리에서 요약을 읽는다. 값이 없거나 이상하면 **그 항목만 조용히 생략**한다(화면은 계속 뜬다). */
export function readPaySummary(get: (k: string) => string | null): PaySummary {
  const image = get('image')
  const merchant = (get('merchant') || '').trim()
  const orig = Number(get('origAmount'))
  const qty = Number(get('qty'))
  const dealUsed = Number(get('dealUsed'))
  return {
    image: isDisplayableImageUrl(image) ? image : undefined,
    merchant: merchant ? merchant.slice(0, 60) : undefined,
    origAmount: Number.isFinite(orig) && orig > 0 ? orig : undefined,
    qty: Number.isFinite(qty) && qty > 1 ? Math.floor(qty) : undefined,
    dealUsed: Number.isFinite(dealUsed) && dealUsed > 0 ? Math.floor(dealUsed) : undefined,
  }
}

/** 호출부에서 쿼리에 싣는다. 빈 값은 아예 안 넣는다(URL 이 쓸데없이 길어지지 않게). */
export function appendPaySummary(params: URLSearchParams, s: PaySummary): URLSearchParams {
  if (isDisplayableImageUrl(s.image)) params.set('image', s.image)
  if (s.merchant) params.set('merchant', s.merchant.slice(0, 60))
  if (s.origAmount && s.origAmount > 0) params.set('origAmount', String(Math.round(s.origAmount)))
  if (s.qty && s.qty > 1) params.set('qty', String(Math.floor(s.qty)))
  if (s.dealUsed && s.dealUsed > 0) params.set('dealUsed', String(Math.floor(s.dealUsed)))
  return params
}

/** 할인율 — 정가가 판매가보다 클 때만. 표시 전용. */
export function displayDiscountPct(amount: number, origAmount?: number): number {
  if (!origAmount || !Number.isFinite(amount) || origAmount <= amount) return 0
  return Math.round(((origAmount - amount) / origAmount) * 100)
}
