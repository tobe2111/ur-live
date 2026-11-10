/**
 * ❓ 자주 묻는 질문(`/faq`) 서버 첫 화면 (2026-11-10).
 *
 * 라이브 실측(폰 4G · CPU 4배): HTML 0.3~0.5s 에 다 왔는데 **첫 그림 2.9s** — 화면 전체가 고정 문구(머리줄 · 안내 · 검색 ·
 * 분류 칩 · 질문 줄 · 고객센터)인데 앱 코드가 다 와야 그려졌다. 데이터·기기 저장값이 하나도 없는 화면이라 **전부** 그린다.
 *
 * 같은 모양의 근거: 머리줄은 `shared/sub-page-head.ts`(부품 `SubPageHeader` 와 같은 상수 · 스크롤 0 상태), 나머지는
 * `shared/faq-page.ts`, 질문은 `CONCEPT_FAQ`(화면·구조화 데이터·크롤러 본문과 같은 배열).
 * 그리지 않는 것: 아이콘 그림(같은 크기 빈 칸 — 두 벌 금지) · **답변 본문**(닫힌 답은 앱이 `.ur-faq-a` 모션 CSS 로 높이 0 을
 * 만드는데 그 CSS 는 앱이 붙인다 — 서버가 본문을 넣으면 첫 화면에서 답이 전부 펼쳐 보인다. 칸만 비워 둔다).
 * 🖥️ PC: `/faq` 는 430 액자 → 게스트 탭과 같은 [네비 높이 예약 + 액자].
 */
import { SUB_PAGE_CLS } from '../../shared/sub-page-head'
import { subPageHeadHtml } from './sub-page-head-html'
import { FAQ_CLS, FAQ_COPY } from '../../shared/faq-page'
import { CONCEPT_FAQ } from '../../shared/seo/concept-content'
import { PC_HOME_FS } from '../../shared/pc-home-first-screen'
import { GUEST_PC_FRAME } from './guest-first-screen'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

export { subPageHeadHtml } // 머리줄 HTML 은 하위 화면 공용(`sub-page-head-html.ts`) — FAQ 가드가 여기서도 읽는다

/** 분류 칩 — 화면과 같은 순서(`전체` + 질문 배열에 나온 순서의 고유 분류). */
export function faqCategories(): string[] {
  return [FAQ_COPY.catAll, ...Array.from(new Set(CONCEPT_FAQ.map((f) => f.category)))]
}

function body(): string {
  const hero = `<div class="${FAQ_CLS.hero}"><div class="${FAQ_CLS.heroRow}"><span class="${FAQ_CLS.heroIcon} block" aria-hidden="true"></span><p class="${FAQ_CLS.heroTitle}">${esc(FAQ_COPY.heroTitle)}</p></div><p class="${FAQ_CLS.heroDesc}">${esc(FAQ_COPY.heroDesc)}</p></div>`
  const search = `<div class="${FAQ_CLS.search}"><span class="${FAQ_CLS.searchIcon}" aria-hidden="true"></span><input type="text" readonly value="" placeholder="${escAttr(FAQ_COPY.searchPlaceholder)}" class="${FAQ_CLS.searchInput}"></div>`
  const chips = `<div class="${FAQ_CLS.chips}">${faqCategories().map((c, i) => `<span class="${FAQ_CLS.chip} ${i === 0 ? FAQ_CLS.chipOn : FAQ_CLS.chipOff}">${esc(c)}</span>`).join('')}</div>`
  const rows = CONCEPT_FAQ.map((f) =>
    `<div class="${FAQ_CLS.item}"><div class="${FAQ_CLS.q}"><span class="${FAQ_CLS.qBadge}">${esc(FAQ_COPY.badge)}</span>` +
    `<div class="${FAQ_CLS.qText}"><p class="${FAQ_CLS.qCat}">${esc(f.category)}</p><p class="${FAQ_CLS.qTitle}">${esc(f.question)}</p></div>` +
    `<span class="${FAQ_CLS.qChev}" aria-hidden="true"></span></div><div class="ur-faq-a" aria-hidden="true" inert=""></div></div>`).join('')
  const list = `<div class="${FAQ_CLS.list}">${rows}</div>`
  const row = (label: string, value: string) => `<div class="${FAQ_CLS.supportRow}"><span class="${FAQ_CLS.supportIcon}" aria-hidden="true"></span><span class="${FAQ_CLS.supportLabel}">${esc(label)}</span><span class="${FAQ_CLS.supportValue}">${esc(value)}</span></div>`
  const support = `<div class="${FAQ_CLS.support}"><h2 class="${FAQ_CLS.supportTitle}">${esc(FAQ_COPY.supportTitle)}</h2><p class="${FAQ_CLS.supportDesc}">${esc(FAQ_COPY.supportDesc)}</p><div class="${FAQ_CLS.supportRows}">${row(FAQ_COPY.supportHours, FAQ_COPY.supportHoursValue)}${row(FAQ_COPY.supportEmail, FAQ_COPY.supportEmailValue)}</div></div>`
  return `<div class="${FAQ_CLS.content}">${hero}${search}${chips}${list}${support}</div>`
}

/** @param isMobile 폰·크롤러면 화면 그대로. PC 면 [네비 높이 예약 + 430 액자]. */
export function buildFaqFirstScreen(loaderHtml: string, isMobile = true): string {
  const page = `<div class="${SUB_PAGE_CLS}">${subPageHeadHtml(FAQ_COPY.title)}${body()}</div>`
  const topnav = isMobile ? '' : `<div class="${PC_HOME_FS.topnav}"><div class="${PC_HOME_FS.topnavRow1}"></div><div class="${PC_HOME_FS.topnavRow2}"></div></div>`
  const framed = isMobile ? page : `<div class="${GUEST_PC_FRAME.cls}" data-mobile-only="false" style="--app-frame:${GUEST_PC_FRAME.width}">${page}</div>`
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다. 로더는 그 아래(화면 전체를 그렸으므로 거의 안 보인다).
  return `<div id="ur-first-screen">${topnav}${framed}</div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
