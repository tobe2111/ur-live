/**
 * 🗺️ 지역 착지(`/region/:sido[/:sigungu]`) 첫 화면을 서버가 그린다 — 2026-11-08 대표 *"계속 최적화"*.
 *
 * 라이브 실측(느린 4G 흉내): FCP 1.65s — sitemap 이 제출하는 **검색 착지점 38곳**인데 앱 코드가 다 와야 그렸다.
 * 그리는 것: [빵부스러기 + 제목 + 딜 수 한 줄 + 분류 칩 줄] — 모양 SSOT `shared/region-page.ts`(화면과 같은 상수).
 * 딜 수는 같은 응답에 실은 `/api/regions` 시드(`__SSR_INITIAL_REGIONS__`)로 계산하고 화면도 같은 시드로 첫 렌더한다 —
 * 그래서 마운트 때 "아직 딜이 없어요" → "N개" 로 바뀌지 않는다(종전엔 그 깜빡임이 있었다).
 * 그리지 않는 것: 아이콘(같은 크기 빈 칸) · 딜 카드(그 아래 로더 — 카드는 종전처럼 화면이 그린다).
 * 폰만(호출부가 UA 로 가른다).
 */
import { REGION_CLS as C, REGION_COPY as T, REGION_CATEGORY_CHIPS, regionDealCount } from '../../shared/region-page'
import { parseRegionPath, regionLabel, regionPath, type SidoStat } from '../../shared/constants/region-slugs'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const slot = (cls: string) => `<span class="${cls} inline-block" aria-hidden="true"></span>`

/** `/region/서울/중구` → 첫 화면. 경로가 지역이 아니면 ''(호출부가 종전 로더). */
export function buildRegionFirstScreen(pathname: string, regionsJson: string | null, loaderHtml: string): string {
  const seg = pathname.replace(/\/+$/, '').split('/').slice(2)
  const ref = parseRegionPath(seg[0], seg[1])
  if (!ref || !ref.sido) return ''
  let regions: SidoStat[] = []
  try {
    const r = regionsJson ? JSON.parse(regionsJson) as { success?: boolean; data?: SidoStat[] } : null
    if (r?.success && Array.isArray(r.data)) regions = r.data
  } catch { /* 시드 없음 — 화면과 같은 첫 렌더(0) */ }
  const label = regionLabel(ref)
  const count = regionDealCount(regions, ref)
  const crumbs = [
    { name: '홈', url: '/' },
    { name: '지역', url: '/region' },
    { name: ref.sido, url: regionPath({ sido: ref.sido }) },
    ...(ref.sigungu ? [{ name: ref.sigungu, url: regionPath(ref) }] : []),
  ]
  const nav = `<nav aria-label="위치" class="${C.crumbs}">` + crumbs.map((c, i) =>
    `<span class="${C.crumb}">${i > 0 ? slot('w-3 h-3 shrink-0') : ''}` +
    (i === crumbs.length - 1 ? `<span class="${C.crumbLast}">${esc(c.name)}</span>` : `<a href="${esc(c.url)}" class="${C.crumbLink}">${esc(c.name)}</a>`) +
    `</span>`).join('') + `</nav>`
  const sub = count > 0 ? `진행 중인 딜 <b class="${C.subNum}">${count}개</b>${esc(T.subSuffix)}` : esc(T.empty)
  const chips = `<div class="${C.chips}">` + REGION_CATEGORY_CHIPS.map((ch) =>
    `<button type="button" aria-pressed="${ch.key === 'all'}" class="${C.chipBase} ${ch.key === 'all' ? C.chipOn : C.chipOff}">${esc(ch.label)}</button>`).join('') +
    `<a href="/map?q=${esc(encodeURIComponent(label))}" class="${C.mapLink}">${slot('w-3.5 h-3.5')}${esc(T.map)}</a></div>`
  const body = `<div class="${C.page}"><div class="${C.wrap}">${nav}<header class="${C.header}"><h1 class="${C.h1}">${esc(label)} 이용권·동네딜</h1><p class="${C.sub}">${sub}</p></header>${chips}</div></div>`
  return `<div id="ur-first-screen">${body}</div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
