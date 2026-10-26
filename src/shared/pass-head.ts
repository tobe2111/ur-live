/**
 * 🎟️ 이용권 상세(`/pass/:id`) **머리 카드** 클래스 SSOT (2026-10-11 대표 확정 "D안")
 *
 * 사진 위로 겹쳐 올라오는 흰 카드 — [가게 · 제목 · 가격]. 모바일 전용(`lg:hidden`).
 *
 * ## 왜 클래스를 여기 두나
 * 워커가 이 카드의 위쪽(가게 · 제목)을 **서버에서 먼저 그린다**(`worker/utils/detail-ssr-body.ts`).
 * React 가 마운트 때 `#root` 를 갈아엎으므로 둘이 한 글자라도 다르면 제목이 튄다. 종전엔 inline style 을
 * 두 벌 손으로 맞추고 시험이 대조했는데, 이제는 **같은 문자열을 import** 해서 갈릴 수가 없다.
 *
 * ⚠️ 이 파일은 워커 번들에도 들어간다 — React·아이콘을 import 하지 말 것(문자열만).
 */
import { VOUCHER_CATEGORY_LABEL } from './constants/voucher-categories'
import { parseRegionFromAddress } from './constants/region-slugs'

export const PASS_PAGE_BG = 'bg-[var(--gbd-bg)]'

export const PASS_HEAD = {
  /**
   * 🔁 2026-10-12 대표 확정 **C안** — *"왜 사진을 가리고 있고, 더 투박해졌지?"* (시안 A·B·C 중 C).
   *
   * 종전(D안, 2026-10-11)은 `-mt-7`(28px) 로 **사진을 덮고** 올라오는 흰/다크 판이었다. 라이브 실측으로
   * 둘 다 확인됐다: 사진 `[0,0,390,260]` ↔ 카드 위끝 `232` = **28px 가림**(히어로 크롭이 `gravity=auto`
   * 라 피사체가 아래쪽에 앉으면 **그 피사체가 가려진다** — 대표 스크린샷의 돈가스 접시가 정확히 그 자리),
   * 그리고 한 화면에 가격이 **여섯 번**(머리 `48%`·`7,500원`·`14,500원` + `1장당 N원 아껴요` + 하단바
   * `14,500원`·`48%`) 나왔다.
   *
   * ⇒ **판을 없애고 평면으로.** 사진 아래에서 시작하고(겹침 0), 배경·그림자·둥근 모서리를 걷는다.
   *   좌우는 `mx-3`(12) + `px-1`(4) = **16px** 로 페이지 거터와 맞춘다(종전 `px-5` 는 판 안쪽 여백이었다).
   *   `1장당 N원 아껴요` 틴트 상자도 뺐다 — 판 안의 또 다른 상자였고(🎫 규칙 ①·⑥), `48%` 와 취소선이
   *   **이미 같은 말을 한다.**
   * ⚠️ 이 클래스는 워커 SSR(`detail-ssr-body.ts`)이 **같은 문자열로** 그린다 — 여기만 고치면 둘이 같이 간다.
   */
  // 🛍️ 2026-10-24 (대표 승인 "그루폰식으로 하자"): 제목 + [가게 · 종류 · 지역] 한 줄.
  // 🔤 2026-10-25 대표 확정 D안: 가게 줄이 **제목 위**로(작은 회색 → 큰 제목 위계). 가격은 머리 아래쪽(`PassHeadCard`).
  //   가격은 머리에서 빠져 아래 '옵션 선택' 카드(`PassOptionCard`)로 갔다 — 한 화면에 가격이 두 번 서지 않게.
  card: 'lg:hidden relative mx-3 mb-3 px-1 pt-5 pb-3',
  /** [가게 · 종류 · 지역] 한 줄 — 값은 `passSubLine()`(서버·클라 같은 함수). 키 이름은 호환 때문에 `merchant`. */
  merchant: 'mb-1 text-[13px] text-[var(--gbd-sub)]',
  prelaunch: 'inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-[var(--gbd-ink)] text-[var(--gbd-card)] text-[12px] font-medium',
  /** 온누리 뱃지 — 한 줄을 두 줄로 밀 수 있어 서버·클라가 모양까지 같아야 한다. */
  onnuri: 'ml-2 px-2 py-[1px] rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[12px] font-medium align-middle',
  h1: 'm-0 text-[24px] leading-[1.3] font-bold tracking-[-.02em] text-[var(--gbd-ink)]',
} as const

/** 섹션 카드 — 회색 바탕 위 흰 판. 2026-10-11 PC 도 같은 카드(대표 "PC도 해야하는거 아니야?"). */
/**
 * 🧱 2026-10-25 대표 확정 **E안**(*"공백도 쓸데없이 많고"* · 여기어때 참고): 모바일 섹션은 떠 있는 카드
 *   (좌우 12px · 둥근 모서리 · 그림자 · 아래 12px)가 아니라 **폭 전체 흰 섹션 + 위 8px 회색 띠**다. 카드마다
 *   양옆·위아래로 비던 여백이 사라지고 구분은 띠 하나가 맡는다. PC(lg+)는 종전 카드 그대로.
 */
export const PASS_CARD = 'bg-[var(--gbd-card)] overflow-hidden border-t-8 border-gray-100 dark:border-[var(--bg)] lg:border-t-0 lg:mx-0 lg:mb-4 lg:rounded-2xl lg:shadow-lift'

/**
 * 🛍️ 제목 아래 한 줄 `부용한우곱창 · 식사 · 파주시` (2026-10-24 그루폰식).
 * 서버 첫 화면(`detail-ssr-body.ts`)과 `PassHeadCard` 가 **같은 함수**로 만든다 — 두 벌이면 마운트 때 그 줄이 바뀐다.
 * 지역은 주소의 시군구(없으면 시/도). 모르는 값은 빼고, 지어내지 않는다.
 */
export function passSubLine(d: { restaurant_name?: string | null; category?: string | null; restaurant_address?: string | null }): string {
  const region = parseRegionFromAddress(d.restaurant_address)
  return [
    (d.restaurant_name || '').trim(),
    d.category ? VOUCHER_CATEGORY_LABEL[d.category]?.short : '',
    region ? (region.sigungu || region.sido) : '',
  ].filter(Boolean).join(' · ')
}
