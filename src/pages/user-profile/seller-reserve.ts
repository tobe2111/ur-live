/**
 * 📐 **판매 구역 자리 예약** — 지난 렌더에서 *실제로 잰* 높이 한 개 (2026-09-30).
 *
 * 왜 별도 모듈인가: `SellerSectionLazy`(예약하는 쪽)와 `SellerSection`(재는 쪽)이 같은 값을 쓰는데,
 * 값을 둘 중 하나에 두면 **두 모듈이 서로를 import** 하게 된다(래퍼는 본체를 `lazy` 로 부른다).
 * 순환을 만들지 않으려고 값만 여기에 둔다. 배경·한계는 `SellerSectionLazy` 머리말.
 *
 * ⚠️ 손으로 적은 숫자가 아니다. 구역이 그려질 때마다 스스로 적고, 내용이 바뀌면 다음 방문에
 *   저절로 맞는다(2026-09-16 `TopChromeReserve` 의 교훈 — 마법의 숫자는 디자인이 바뀌면 어긋난다).
 */

/** 터무니없는 값이 굳지 않게 하는 울타리. 판매 구역은 오늘 카드 + 줄 다섯이라 이 안에 있다. */
const MIN_PX = 120
const MAX_PX = 2000

/** 🗝️ PC 와 폰은 레이아웃이 달라 높이도 다르다 — 한 칸에 담으면 서로를 덮어쓴다. */
function heightKey(): string {
  const pc = typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)')?.matches
  return `ur_my_seller_h_v1_${pc ? 'pc' : 'mo'}`
}

/** 지난 렌더에서 잰 값. 없거나 범위 밖이면 0 — 그때는 예약하지 않는다(종전 동작 그대로). */
export function readReservedHeight(): number {
  try {
    const n = Number(localStorage.getItem(heightKey()))
    return Number.isFinite(n) && n >= MIN_PX && n <= MAX_PX ? n : 0
  } catch { return 0 }
}

/** 구역이 그려진 뒤 자기 높이를 적는다. 범위를 벗어나면 **안 적는다**. */
export function writeReservedHeight(px: number): void {
  try {
    const n = Math.round(px)
    if (n >= MIN_PX && n <= MAX_PX) localStorage.setItem(heightKey(), String(n))
  } catch { /* private mode · quota */ }
}
