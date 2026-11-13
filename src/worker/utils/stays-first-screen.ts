/**
 * 🏨 숙소 목록(`/stays`) 서버 첫 화면 (2026-10-19 대표 *"모두 개선해줘"*).
 *
 * ## 무엇을 고치는가 (라이브 실측 — 폰 · 느린 4G · CPU 4배)
 * `/stays` 만 서버 첫 화면이 없어 **약 3초간 로딩 그림**이 떠 있었고, 사진은 React 가 그린 뒤인
 * 3.2초에야 출발했다(LCP 3.0~5.2초 — 홈·교환권·이용권 상세는 1~2초). 데이터는 이미 HTML 직후 미리
 * 받고 있었으니(`shared/stays-early.ts`) 모자란 것은 **그리는 쪽**이었다.
 *
 * ## 무엇을 그리나 — 아무 조건 없는 기본 진입의 맨 위
 * [상단 바 3줄(제목·카테고리 칩·날짜/인원) + 첫 큐레이션 줄(제목 + 가로 카드)] 까지 그리고 그 아래에만
 * 짧은 로더를 둔다. 카드는 **홈 첫 화면과 같은 함수**(`cardHtml` — 진짜 `GroupBuyFeedCard` 와 시험으로
 * 대조된 것)라 카드가 두 벌이 되지 않는다. 클래스·큐레이션 규칙은 `shared/stays-list.ts` 를 화면과 같이 쓴다.
 *
 * ## 그리지 않는 것
 * - **아이콘(SVG)** — 같은 크기의 빈 칸만 세운다(path 를 워커로 옮기면 두 벌이 갈린다). 아이콘은 그 칸
 *   *안에서* 나중에 나타나므로 아무것도 밀지 않는다.
 * - **큐레이션 줄이 하나도 없을 때** — 그때 화면은 4열 그리드다. 지금은 그리지 않고 종전 로더로 돌아간다(무회귀).
 * - ~~**PC** — 호출부가 폰 UA 에서만 부른다~~ → 🖥️ 2026-11-12 PC 도 그린다: 첫 화면(큐레이션 줄)은 반응형 클래스라 PC 에서도
 *   같은 마크업이고, 앱의 상단 네비(`DesktopTopNav`, 풀너비 표면)만 `pcPath` 로 먼저 그린다. 라이브 끼워 재기 FCP 2.9 → 0.5~0.8s · CLS 0.0018 → 0.0015.
 *
 * ## 실패하면
 * 빈 문자열 — 호출부가 종전 `<noscript>` + 로더로 되돌아간다.
 */
import { cardHtml, escText } from './home-first-screen'
import { pcTopNavBlockHtml } from './pc-topnav-first-screen'
import { stayRegionLabel } from '../../shared/stay-address'
import { STAYS_LIST, STAYS_CHIPS, STAYS_ICON, buildStayCurations, stayCardHref, stayDateChipLabel, type StaySearchItem } from '../../shared/stays-list'

/** 아이콘 자리 — lucide·유어딜 아이콘은 preflight 로 `display:block` 이므로 같은 크기의 block 칸이다. */
const iconSlot = (px: number) => `<span class="block shrink-0" style="width:${px}px;height:${px}px" aria-hidden="true"></span>`

/**
 * @param seedJson `/api/group-buy/stays/search?{기본 질의}` 응답(JSON 문자열) — `__SSR_INITIAL_STAYS__` 와 같은 값
 * @param loaderHtml 종전 로더 — 그린 내용 **아래**에 짧게 붙인다
 * @param checkIn @param checkOut @param guests 기본 질의의 값(`defaultStaysQs` 와 같은 날짜)
 */
/**
 * 서버가 그리는 큐레이션 줄 수 — 🖥️ 2026-11-13 1 → 2. PC(1440)에선 둘째 줄 사진(y≈685)이 첫 화면 안이고 **가장 큰 그림(LCP)** 인데
 * 서버가 첫 줄만 그려 그 사진은 앱이 켜진 뒤(라이브 1.5s 출발) 받았다 — LCP 2.3~2.7s. 둘째 줄의 사진은 lazy(폰에선 화면 밖이라 안 받는다).
 */
export const STAYS_FS_ROWS = 2

export function buildStaysFirstScreen(seedJson: string, loaderHtml: string, checkIn: string, checkOut: string, guests = 2, pcPath?: string): string {
  let items: StaySearchItem[]
  try {
    const parsed = JSON.parse(seedJson) as { success?: boolean; data?: StaySearchItem[] }
    if (!parsed?.success || !Array.isArray(parsed.data)) return ''
    items = parsed.data
  } catch {
    return ''
  }
  const rows = buildStayCurations(items).slice(0, STAYS_FS_ROWS)
  if (rows.length === 0) return ''

  const chips = STAYS_CHIPS.map(({ key, label }) =>
    `<span class="${STAYS_LIST.chip} ${key === 'stay_voucher' ? STAYS_LIST.chipOn : STAYS_LIST.chipOff}">${iconSlot(STAYS_ICON.chip)}${escText(label)}</span>`,
  ).join('')

  const bar =
    `<div class="${STAYS_LIST.bar}">` +
      `<div class="${STAYS_LIST.titleRow}">` +
        `<a href="/" class="${STAYS_LIST.back}">←</a>` +
        `<h1 class="${STAYS_LIST.h1}">${iconSlot(STAYS_ICON.title)}숙소</h1>` +
        `<span class="${STAYS_LIST.filterBtn}">${iconSlot(STAYS_ICON.filter)}</span>` +
      `</div>` +
      `<div class="${STAYS_LIST.chipRow}">${chips}</div>` +
      `<div class="${STAYS_LIST.quickRow}">` +
        `<span class="${STAYS_LIST.quick}">${iconSlot(STAYS_ICON.quick)} ${escText(stayDateChipLabel(checkIn, checkOut))}</span>` +
        `<span class="${STAYS_LIST.quick}">${iconSlot(STAYS_ICON.quick)} 성인 ${guests}명</span>` +
      `</div>` +
    `</div>`

  // 카드 — `StayCardRow` 가 `GroupBuyFeedCard` 에 넘기는 값과 같은 매핑. 줄마다 첫 장만 eager 는 **첫 줄**만(화면과 같다).
  const rowHtml = (row: (typeof rows)[number], ri: number) => row.items.map((s, i) =>
    `<div class="${STAYS_LIST.cell}">` +
      cardHtml({
        id: s.id,
        name: s.name,
        price: s.price_from ?? 0,
        image_url: s.image_url || '',
        category: 'stay_voucher',
        restaurant_address: stayRegionLabel(s.region_sido, s.region_sigungu, s.address),
        avg_rating: s.avg_rating ?? undefined,
        review_count: s.review_count ?? undefined,
      }, ri === 0 && i === 0, stayCardHref(s.id, checkIn, checkOut, guests)) +
    `</div>`,
  ).join('')
  const sections = rows.map((row, ri) => `<section>` +
        `<h2 class="${STAYS_LIST.rowTitle}">${escText(row.title)}</h2>` +
        `<div class="${STAYS_LIST.row}">${rowHtml(row, ri)}</div>` +
      `</section>`).join('')

  const body =
    `<div class="${STAYS_LIST.rootBg}">` +
      bar +
      `<div class="${STAYS_LIST.results}"><div class="${STAYS_LIST.curations}">${sections}</div></div>` +
    `</div>`

  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다.
  return `<div id="ur-first-screen">${pcPath ? pcTopNavBlockHtml(pcPath) : ''}${body}</div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
