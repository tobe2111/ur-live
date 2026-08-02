/**
 * 🏬 **몰 흔적(origin breadcrumb)** — "이 손님은 어느 가게에서 들어왔는가" (2026-08-02)
 *
 * 몰 손님의 동선은 `카톡 → urdeal.kr/{슬러그} → 상품 카드 → /products/{id}` 다.
 * 그런데 **상품 URL 에는 가게가 안 적혀 있다.** 평소엔 상관없지만 상품을 못 읽은 순간
 * (품절·삭제·일시 오류) 화면이 갈 곳을 잃고 **유어딜 홈**으로 보낸다 — 그건 `MallHomePage`
 * 주석이 *"몰이 열렸다보다 나쁜 결과"* 라고 못 박은 바로 그 결과다.
 *
 * ⇒ 몰 홈을 지나갈 때 슬러그를 한 조각 남겨 두고, 갈 곳이 없을 때만 꺼내 쓴다.
 *
 * ## 이 흔적으로 하지 말아야 할 것
 * 🔴 **몰 상품 판정에 쓰지 말 것.** 그건 `products.mall_id`(서버 데이터)가 한다.
 *   흔적은 클라 상태라 오래되거나 없을 수 있고, 그걸로 CTA 를 가르면 같은 상품이
 *   진입 경로에 따라 다르게 보인다 — 2026-06-18 flip-flop 사고와 같은 클래스다.
 *   여기 용도는 **되돌아갈 곳** 하나뿐이다.
 */
const KEY = 'ur_mall_origin'

/** 몰 홈을 열 때 호출. SSR·비브라우저에서는 조용히 no-op. */
export function rememberMallOrigin(slug: string | null | undefined): void {
  const s = String(slug ?? '').trim().toLowerCase()
  if (!s) return
  try { sessionStorage.setItem(KEY, s) } catch { /* 프라이빗 모드 등 — 흔적 없이 동작 */ }
}

/**
 * 마지막으로 지나온 몰 슬러그. 없으면 `null`.
 * ⚠️ 값을 **경로에 그대로 넣으므로** 문법을 다시 검사한다 — sessionStorage 는 사용자가 고칠 수 있다.
 */
export function readMallOrigin(): string | null {
  try {
    const s = String(sessionStorage.getItem(KEY) ?? '').trim().toLowerCase()
    return /^[a-z0-9-]{3,30}$/.test(s) ? s : null
  } catch { return null }
}
