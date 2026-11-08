/**
 * 📐 딜 카드 격자의 간격 — 한 곳 (2026-09-03 대표 확정 "안 1")
 *
 * ■ 왜 상수인가
 *   `GroupBuyFeedCard` 는 홈·찜·유어샵·편성 섹션이 **같이 쓰는 카드**인데, 그 카드를 담는 격자는
 *   화면마다 `gap-3` 을 손으로 적고 있었다(6곳). 한 곳만 고치면 화면마다 간격이 갈린다 —
 *   이 레포가 카드 자체로 이미 한 번 겪은 일이다(홈 섹션 카드 ↔ 피드 카드가 두 벌이었다).
 *
 * ■ 왜 세로가 더 넓은가 (대표 시안 "안 1")
 *   문제는 12px 이 작은 게 아니라 **카드 안 여백(2~8px)과 너무 가깝다**는 것이었다. 사람이 묶음을
 *   알아보는 건 절대 거리가 아니라 **안팎의 차이**라, 세로만 벌리면 카드가 하나씩 끊긴다.
 *   가로는 그대로 둔다 — 열 간격까지 벌리면 사진이 작아지고 화면이 허전해진다.
 *
 *     카드 안: 사진→머천트 8px · 줄 사이 2px · 평점→가격 6px
 *     카드 밖: 가로 12px(그대로) · 세로 24px  ← 안팎 차이 3배
 *
 * ⚠️ 새 격자를 만들 때 `gap-3` 을 손으로 적지 말 것 — `deal-card-grid` 가드가 잡는다.
 */
export const DEAL_GRID_GAP = 'gap-x-3 gap-y-8 lg:gap-x-3 lg:gap-y-8'

/**
 * 📋 2026-10-31 대표 시안 10(NOL식 줄 목록 — *"사진 크기 비율들도 맞춰서"*): 폰 홈의 카드는 **한 줄에 하나**,
 * 왼쪽 108px 정사각 사진 + 오른쪽 정보. 태블릿·PC(md+)는 종전 격자 그대로다(`md:` 가 되돌린다).
 * 카드 안쪽(사진 비율·본문 여백)은 **카드를 안 고치고** 바깥에서 자식 선택자로 바꾼다 — 카드 소스의 격자 계약이 그대로 남는다.
 * 카드(`GroupBuyFeedCard` `row`)·자리 카드·워커 첫 화면(`home-first-screen.ts`)이 **이 상수를 같이** 쓴다 — 갈리면 마운트 때 튄다.
 */
export const DEAL_ROW = {
  /** 줄 목록 격자 — 폰 1열, md+ 는 종전 4열 격자. */
  // ⚠️ 글자 그대로 적는다 — 조립하면 tailwind 가 클래스를 못 본다. md+ 간격은 `DEAL_GRID_GAP` 과 같은 값.
  grid: 'grid grid-cols-1 gap-y-5 md:grid-cols-4 md:gap-x-3 md:gap-y-8 lg:gap-x-3 lg:gap-y-8',
  /** 링크 — 둘째 자식(본문)은 (2026-11-01: 셋째 자식으로 하트가 붙을 수 있어 last-child → nth-child(2)) 남은 폭을 다 쓰고 위 여백 0(사진 위끝과 글자 위끝을 맞춘다). */
  // 기본(세로 카드) 클래스를 그대로 두고 폰(max-md)에서만 덮는다 — 카드가 기본 클래스 줄을 리터럴로 유지할 수 있게.
  link: 'block group active:scale-[0.98] flex flex-col max-md:relative max-md:flex-row max-md:items-start max-md:gap-4 max-md:[&>*:nth-child(2)]:min-w-0 max-md:[&>*:nth-child(2)]:flex-1 max-md:[&>*:nth-child(2)]:pt-0',
  /** 사진 칸 — 120px 정사각(md+ 는 종전 4:3 꽉 채움). 2026-11-01 대표 확정 안 B(108 → 120). */
  mediaBox: 'w-[120px] shrink-0 [&>*]:aspect-square md:w-full md:[&>*]:aspect-[4/3]',
} as const

/** 도(道) — 정식 이름(…도/…특별자치도)과 흔한 줄임말. 광역시·특별시·세종은 여기 없다(그대로 둔다). */
const PROVINCE_RE = /(도|특별자치도)$|^(경기|강원|충북|충남|전북|전남|경북|경남|제주)$/

/**
 * 📍 주소를 **시·구까지만** (2026-11-03 대표 *"부산 연제구 정도까지만 나오고"*).
 *   첫 낱말(시·도) + 이어지는 `…시/군/구` 낱말만 남긴다(최대 3낱말).
 *   🔄 같은 날 대표 *"응 바꾸자"* — **도(道)는 그 아래 시·구가 둘이면 뺀다**
 *     (`전북특별자치도 전주시 덕진구` 가 카드에서 너무 길었다). 시·군이 하나뿐이면 도를 남긴다
 *     (`경남 김해시` — `김해시` 만으로는 어딘지 덜 읽힌다).
 *     '부산 연제구 중앙천로39번길 12'          → '부산 연제구'
 *     '경기 성남시 분당구 판교역로 1'          → '성남시 분당구'
 *     '전북특별자치도 전주시 덕진구 기린대로 1' → '전주시 덕진구'
 *     '경남 김해시 김해대로 1'                 → '경남 김해시'
 *     '세종특별자치시 한누리대로 2130'          → '세종특별자치시'
 */
export function shortRegion(address: string | null | undefined): string {
  const words = (address || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const out = [words[0]]
  for (let i = 1; i < words.length && out.length < 3; i++) {
    if (!/(시|군|구)$/.test(words[i])) break
    out.push(words[i])
  }
  if (out.length === 3 && PROVINCE_RE.test(out[0])) out.shift()
  return out.join(' ')
}

/**
 * 🗺️ 2026-11-08 — `GroupBuyFeed` 의 `pc` 격자(지역 착지 `/region/*` 가 폰에서도 쓴다). 워커 첫 화면
 * (`region-first-screen.ts`)이 같은 상수를 쓴다 — 갈리면 마운트 때 카드가 튄다. 글자 그대로 적는다(tailwind).
 */
export const FEED_PC_GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-8 lg:gap-x-3 lg:gap-y-8 pb-8'

/** 🗺️ 2026-11-08 — 피드 '인기순' 의 판매 수(`GroupBuyFeed` sortBand 와 워커 지역 첫 화면이 같이 쓴다). */
export function feedSoldOf(p: { sold_count?: number | null; group_buy_current?: number | null }): number {
  return p.sold_count ?? p.group_buy_current ?? 0
}
