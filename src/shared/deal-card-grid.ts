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
export const DEAL_GRID_GAP = 'gap-x-3 gap-y-8 lg:gap-x-4 lg:gap-y-8'

/**
 * 📋 2026-10-31 대표 시안 10(NOL식 줄 목록 — *"사진 크기 비율들도 맞춰서"*): 폰 홈의 카드는 **한 줄에 하나**,
 * 왼쪽 108px 정사각 사진 + 오른쪽 정보. 태블릿·PC(md+)는 종전 격자 그대로다(`md:` 가 되돌린다).
 * 카드 안쪽(사진 비율·본문 여백)은 **카드를 안 고치고** 바깥에서 자식 선택자로 바꾼다 — 카드 소스의 격자 계약이 그대로 남는다.
 * 카드(`GroupBuyFeedCard` `row`)·자리 카드·워커 첫 화면(`home-first-screen.ts`)이 **이 상수를 같이** 쓴다 — 갈리면 마운트 때 튄다.
 */
export const DEAL_ROW = {
  /** 줄 목록 격자 — 폰 1열, md+ 는 종전 4열 격자. */
  // ⚠️ 글자 그대로 적는다 — 조립하면 tailwind 가 클래스를 못 본다. md+ 간격은 `DEAL_GRID_GAP` 과 같은 값.
  grid: 'grid grid-cols-1 gap-y-6 md:grid-cols-4 md:gap-x-3 md:gap-y-8 lg:gap-x-4 lg:gap-y-8',
  /** 링크 — 둘째 자식(본문)은 (2026-11-01: 셋째 자식으로 하트가 붙을 수 있어 last-child → nth-child(2)) 남은 폭을 다 쓰고 위 여백 0(사진 위끝과 글자 위끝을 맞춘다). */
  // 기본(세로 카드) 클래스를 그대로 두고 폰(max-md)에서만 덮는다 — 카드가 기본 클래스 줄을 리터럴로 유지할 수 있게.
  link: 'block group active:scale-[0.98] flex flex-col max-md:relative max-md:flex-row max-md:items-start max-md:gap-4 max-md:[&>*:nth-child(2)]:min-w-0 max-md:[&>*:nth-child(2)]:flex-1 max-md:[&>*:nth-child(2)]:pt-0',
  /** 사진 칸 — 120px 정사각(md+ 는 종전 4:3 꽉 채움). 2026-11-01 대표 확정 안 B(108 → 120). */
  mediaBox: 'w-[120px] shrink-0 [&>*]:aspect-square md:w-full md:[&>*]:aspect-[4/3]',
} as const
