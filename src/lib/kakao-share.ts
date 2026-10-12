/**
 * 💬 카카오톡 공유 카드를 **보내는** 단일 소스 (2026-10-12)
 *
 * ## 왜 모았나
 * `Kakao.Share.sendDefault(…)` 를 부르는 자리가 **세 곳**이 되려던 참이었다 —
 * `KakaoShareButton`(상품·블로그) · `GiftVoucherSheet`(선물) · 그리고 이번에 유어샵.
 * 세 벌이면 반드시 갈린다. 특히 갈리면 **에러가 안 나고 카드만 조용히 달라진다**
 * (버튼이 빠지거나, `imageUrl` 폴백이 한쪽에만 있거나, 커머스 가격 규칙이 한쪽만 바뀐다).
 *
 * ## 두 가지 보내기 — 둘 다 필요하다
 *   - `sendKakaoShare()` **동기**. SDK 가 준비돼 있을 때만 보낸다(안 되면 `false`).
 *     선물 시트가 이걸 쓴다 — 공유창은 **누른 순간**에 열어야 폰 브라우저가 안 막는다
 *     (`GiftVoucherSheet` 머리말: 서버 왕복을 기다린 뒤 열면 "사용자가 누르지 않은 이동" 으로 막힌다).
 *   - `shareViaKakao()` **비동기**. SDK 를 먼저 보장한 뒤 보낸다(처음 누른 사람).
 *
 * ⚠️ **SDK 로더는 반드시 동적 import** 로 둔다 — 정적으로 끌어오면 `app-kakao-sdk` 청크가
 *    첫 페인트 봉투에 실린다(2026-10-11 에 그래서 `check-critical-chunks` 가 빨간불을 냈다).
 * ⚠️ 그리고 그 동적 import 는 **상대 경로**다. `src/lib/` 는 워커 번들에 들어갈 수 있는 경로라
 *    pre-commit 가드가 `@/` 동적 import 를 막는다(TS alias 는 **런타임에 존재하지 않아** 문자열이
 *    그대로 남고 crash 한다 — 2026-04-22 사고). 그 가드에 면제 목록이 있지만, 여기선 면제를
 *    받을 이유가 없다: 상대 경로면 위험 자체가 없고 Vite·esbuild 양쪽에서 똑같이 돈다.
 */
import type { UShopShareCard } from '@/shared/ushop-share-card'

/** 카카오가 요구하는 링크 쌍. 모바일·웹 같은 주소를 쓴다. */
export interface KakaoShareLink { mobileWebUrl: string; webUrl: string }
export function kakaoLink(url: string): KakaoShareLink {
  return { mobileWebUrl: url, webUrl: url }
}

/**
 * 사진이 하나도 없을 때의 기본 그림 — 전 공유 경로가 **같은 값**을 쓴다.
 *
 * 🩸 2026-10-12 — 모으면서 **네 번째 사본**을 발견했고(유어애즈 `InfluencerDashboardPage`),
 *   거기 값이 `urdeal.kr/og-default.png` 로 달랐다. 그래서 둘 다 라이브로 찔러 봤더니
 *   **둘 다 404** 였다(`og-default.png` · `icons/og-default.png` 모두 9B text/plain).
 *   즉 사진 없는 카드는 그동안 **없는 그림을 가리키고** 있었다 — 카톡은 그 자리를 그냥 비우고
 *   에러를 안 낸다. 실재하는 것은 `index.html` og:image 와 같은 `og-image.png`(1200×630) 하나다.
 *   ⇒ 값은 `public/` 에 실재하는 파일이어야 하고, 가드가 그걸 검사한다.
 */
export const KAKAO_SHARE_FALLBACK_IMAGE = 'https://urdeal.kr/og-image.png'

type KakaoGlobal = {
  isInitialized?: () => boolean
  Share?: { sendDefault: (o: unknown) => void }
}
function kakao(): KakaoGlobal | undefined {
  return (window as unknown as { Kakao?: KakaoGlobal }).Kakao
}

/** 지금 당장 보낼 수 있는가(로드 + init 완료). */
export function kakaoShareReady(): boolean {
  const K = kakao()
  if (!K?.Share?.sendDefault) return false
  return !(K.isInitialized && !K.isInitialized())
}

/** 준비돼 있으면 보낸다. **동기** — 클릭 핸들러 안에서 바로 쓸 수 있다. */
export function sendKakaoShare(payload: Record<string, unknown>): boolean {
  if (!kakaoShareReady()) return false
  try {
    kakao()!.Share!.sendDefault(payload)
    return true
  } catch {
    return false
  }
}

/** SDK 를 보장한 뒤 보낸다. 실패하면 `false`(호출부가 네이티브 공유·복사로 폴백). */
export async function shareViaKakao(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const { ensureKakaoSdk } = await import('./kakao-sdk')
    await ensureKakaoSdk()
  } catch {
    return false
  }
  return sendKakaoShare(payload)
}

/**
 * 💰 가격 props → 카카오 `commerce` 객체(또는 null). 정가만/할인가만/할인율만 어떤 조합이든 안전 처리.
 * ⚠️ **딜(원화 아님) 결제 상품은 넘기지 말 것** — 카카오 커머스는 '원' 표기 전용이다.
 *    (2026-10-12 `KakaoShareButton` 에서 이 파일로 **행동 불변**으로 옮겼다.)
 */
export function buildCommerce(
  regularPrice?: number, salePrice?: number, discountRate?: number,
): { regularPrice: number; discountPrice?: number; discountRate?: number } | null {
  const sale = Math.round(Number(salePrice) || 0)
  let regular = Math.round(Number(regularPrice) || 0)
  let rate = Math.round(Number(discountRate) || 0)
  // 할인율만 주어지고 정가가 없으면 판매가에서 역산.
  if (sale > 0 && rate > 0 && regular <= sale) regular = Math.round(sale / (1 - Math.min(rate, 95) / 100))
  const hasDiscount = sale > 0 && regular > sale
  if (hasDiscount && rate <= 0) rate = Math.round((1 - sale / regular) * 100)
  const base = regular || sale
  if (!base || base <= 0) return null
  const commerce: { regularPrice: number; discountPrice?: number; discountRate?: number } = { regularPrice: base }
  if (hasDiscount) {
    commerce.discountPrice = sale
    if (rate > 0) commerce.discountRate = rate // 카카오: discountRate 는 discountPrice 있을 때만 유효
  }
  return commerce
}

/** 🛒 커머스 카드 payload — 가격·할인율 강조 + 버튼. */
export function commercePayload(o: {
  title: string; imageUrl?: string | null; url: string
  commerce: { regularPrice: number; discountPrice?: number; discountRate?: number }
  buttons: Array<{ title: string; url?: string }>
}): Record<string, unknown> {
  const link = kakaoLink(o.url)
  return {
    objectType: 'commerce',
    content: { title: o.title, imageUrl: o.imageUrl || KAKAO_SHARE_FALLBACK_IMAGE, link },
    commerce: o.commerce,
    buttons: o.buttons.map((b) => ({ title: b.title, link: b.url ? kakaoLink(b.url) : link })),
  }
}

/** 📰 기본(feed) 카드 payload — 큰 사진 + 제목·설명 + 버튼. */
export function feedPayload(o: {
  title: string; description?: string | null; imageUrl?: string | null; url: string
  buttons: Array<{ title: string; url?: string }>
}): Record<string, unknown> {
  const link = kakaoLink(o.url)
  return {
    objectType: 'feed',
    content: { title: o.title, description: o.description || '', imageUrl: o.imageUrl || KAKAO_SHARE_FALLBACK_IMAGE, link },
    buttons: o.buttons.map((b) => ({ title: b.title, link: b.url ? kakaoLink(b.url) : link })),
  }
}

/**
 * 🛍️ 유어샵 카드(`buildUShopShareCard` 결과) → 카카오 payload.
 *
 * 🔄 2026-10-12 대표 재지시로 **커머스 분기가 빠졌다** — 유어샵 링크는 *가게*를 가리키고
 *    특정 물건이 아니다(그 SSOT 머리말 규칙 4). 물건+가격 카드는 **상품 페이지의
 *    `KakaoShareButton`** 이 계속 쓰므로 아래 `commercePayload` 는 죽은 코드가 아니다.
 */
export function ushopCardPayload(card: UShopShareCard): Record<string, unknown> {
  return feedPayload({
    title: card.title,
    description: card.description,
    imageUrl: card.imageUrl,
    url: card.link,
    buttons: card.buttons.map((b) => ({ title: b.title, url: b.link })),
  })
}
