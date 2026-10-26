/**
 * 🏨 숙소 상세(`/stays/:id`)의 **서버가 그리는 첫 화면** (2026-10-12, 대표 *"모두 다 진행해줘"*).
 *
 * ## 왜 — 정본인데 가장 늦게 뜨는 상세였다
 * 2026-10-12 에 `/pass/:id`(숙소) 의 canonical 을 `/stays/:id` 로 옮겨 **이쪽이 정본**이 됐다.
 * 그런데 `/pass/:id` 는 2026-09-15 부터 서버가 [빵부스러기 + 히어로 + 제목]을 그리는데
 * `/stays/:id` 는 **로더뿐**이었다 — 정본이 사본보다 늦게 뜨고 있었다. 그날 `<noscript>` 요약만
 * 먼저 붙이고(크롤러 본문 6자 → 146자) 첫 화면은 *"히어로 래퍼를 픽셀로 맞춰야 해 별건"* 으로
 * 남겨 둔 것이 이 파일이다.
 *
 * ## 무엇을 그리나 — **제목(h1)까지**. 그 아래는 한 픽셀도 안 그린다
 * React 는 `createRoot`(비-hydrate)라 마운트 때 `#root` 를 통째로 갈아엎는다. 서버가 그린 것과
 * 어긋나면 그 자리가 **튄다**(대표가 2026-07-01 에 금지한 "로딩 화면 2~3개" 로 되돌아간다).
 * ⇒ 어긋날 수 없는 것만:
 *   - **빵부스러기** — `stayCrumbs` 와 같은 3단(`홈 / 숙소 / {유형}`), 클래스는 `/pass/:id` 와 공유.
 *     ⚠️ 숙소는 모바일에서도 빵부스러기를 그린다(`/pass/:id` 의 D안만 `hidden lg:block` 이다).
 *   - **히어로** — `DetailGallery` 모바일 슬라이드와 같은 프레임(3:2)·같은 URL(`detailHeroMobileUrl`
 *     SSOT — 워커 preload 가 이미 쓰는 그 함수)·같은 바탕(#1D1F29).
 *   - **성급 줄 + 제목(h1)** — 시드 값 그대로, 클래스는 `STAY_HEAD`(화면과 **같은 상수**).
 *
 * ## 🩸 `/pass/:id` 와 다른 세 가지 — 베끼면 틀린다
 * 1. **히어로 래퍼를 빼먹으면 안 된다.** `/pass/:id` 는 갤러리의 자기 래퍼(`relative lg:hidden`)만
 *    그리면 됐다 — 그 위 래퍼에 모바일 치수 클래스가 없어서다. 숙소의 래퍼는 **`-mx-4 -mt-5`**(풀블리드)라
 *    빼먹으면 사진이 좌우 16px 안쪽으로 들어가고 위가 20px 내려앉는다.
 * 2. **그라디언트(scrim)를 그리지 않는다.** `/pass/:id` 의 위·아래 어둠은 `DetailGallery` 의
 *    `badges` prop 으로 들어오는 것이고, 숙소는 `badges` 를 **안 넘긴다**. 베끼면 서버만 어둡다.
 * 3. **제목이 사진 아래**에 있고(`/pass/:id` 는 사진 위 카드) 그 위에 **성급 줄**이 하나 있다.
 *    성급은 라이브 49건 중 **12건**(hotel 9 · resort 3)만 갖는데, 없을 때도 React 는 그 div 를
 *    그리므로(`mb-1` = 4px) **서버도 빈 div 를 그려야 한다**. 빼면 37건이 4px 튄다.
 *
 * ## ❌ 안 그리는 것
 * - **주소 줄·평점 줄** — 둘 다 lucide/유어딜 **SVG 아이콘**(`PinIcon`·`StarIcon`)을 품는다.
 *   path 데이터를 워커 문자열로 손으로 옮기는 것은 이 레포가 반복해 당한 *두 벌이 갈리는* 클래스이고
 *   path 동일성은 싼 기계 검사가 없다. 둘 다 h1 **아래**라 서버가 **안 그린** 것이 나중에 채워지는
 *   것은 밀림이 아니다(위는 한 픽셀도 안 움직인다).
 * - **PC(lg+)** — 첫 화면이 2열 그리드(`lg:grid-cols-[minmax(0,1fr)_360px]`)이고, 제목은 그 그리드
 *   **밖** `DetailTitleHeader`(`hidden lg:block`)가 그린다. 그 헤더를 안 그리면 마운트 때 끼어들며
 *   히어로를 **아래로 민다**. 그려면 위 ❌ 의 SVG 문제로 돌아간다 ⇒ 본문 전체를 `lg:hidden` 으로
 *   감싸 PC 는 빵부스러기 + 로더(= 종전과 동일)로 둔다. `/pass/:id` 와 같은 판단이다.
 * - **`?ref=` 추천 배너** — 숙소는 그 배너가 제목 **아래**에 있어(`/pass/:id` 는 위였다) 접을 필요가
 *   없다. 그래서 이 빌더엔 `search` 인자가 없다.
 *
 * ## 이 파일이 **못** 하는 것
 * - 실제로 안 튀는지 → **프레임 캡처**만이 판정한다(배포 후 라이브).
 * - 마운트 전에 눌러도 아무 일도 안 난다(사진은 링크가 아니다 — 화면도 그렇다).
 */
import {
  DETAIL_HERO_MOBILE_WIDTH,
  detailGalleryImages,
  detailHeroMobileUrl,
} from '../../shared/detail-hero-image'
import { STAY_HEAD } from '../../shared/stay-head'
import { propertyTypeLabel } from '../../shared/stay-property-type'
import { crumbNavHtml, mobileThumbRowHtml, restSlidesHtml } from './detail-ssr-body'
import { stayNoscriptFromPayload } from './crawler-noscript'

function escAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escText(s: string): string {
  return escAttr(s).replace(/'/g, '&#39;')
}

interface StaySeedProduct {
  id?: number
  name?: string
  restaurant_name?: string | null
  property_type?: string | null
  star_rating?: number | null
  image_url?: string | null
  images?: string | null
  [k: string]: unknown
}

/**
 * `#root` 에 넣을 첫 화면 HTML. 만들 수 없으면 `''` → 호출부가 기존 `<noscript>` + 로더로 폴백(무회귀).
 *
 * @param ssrPayload `__SSR_INITIAL_STAYDETAIL__` 원문 — 모양이 DETAIL 과 다르다(`{data:{product,rooms}}`)
 * @param loaderHtml 기존 URDEAL 로더(사진 아래에 붙는다 — 아직 오는 중이라는 정직한 신호)
 */
export function buildStayDetailFirstScreen(ssrPayload: string, loaderHtml: string): string {
  try {
    const parsed = JSON.parse(ssrPayload) as { data?: { product?: StaySeedProduct } }
    const p = parsed?.data?.product
    if (!p) return ''
    const title = (p.restaurant_name || p.name || '').trim()
    if (!title) return ''

    const images = detailGalleryImages(p as Record<string, unknown>)
    const main = images[0] || ''
    /**
     * 사진을 못 만들면 그릴 것도 없다 → `''`(호출부가 `<noscript>` + 로더로 폴백, 유형 아이콘은 React 가).
     *
     * 🩸 처음엔 `if (!main) return ''` 를 **한 줄 더** 뒀다. 주입이 그 둘을 **각각** 지워 봤더니
     *    **어느 쪽을 지워도 결과가 같았다** — `detailHeroMobileUrl('')` 도 `''` 를 돌려주기 때문이다.
     *    즉 서로를 덮어 주느라 **둘 다 시험 불가능**해졌다(2026-10-11 에 `surface-list-jsonld` 에서
     *    값을 치르고 배운 "중복 잠금" 과 같은 자리). ⇒ 가드를 **하나로** 모은다.
     */
    const heroUrl = detailHeroMobileUrl(main, DETAIL_HERO_MOBILE_WIDTH)
    if (!heroUrl || heroUrl.startsWith('data:')) return ''

    // 🍞 `stayCrumbs(propertyTypeLabel(property_type))` 와 같은 3단. `/stays` 는 실재하는 목록이다.
    const crumb = crumbNavHtml([
      { label: '홈', to: '/' },
      { label: '숙소', to: '/stays' },
      ...(p.property_type ? [{ label: propertyTypeLabel(p.property_type) }] : []),
    ])

    // 🖼️ `DetailGallery` 모바일 슬라이드와 같은 구조. ⚠️ scrim 없음(숙소는 `badges` 를 안 넘긴다).
    const hero =
      '<div class="relative lg:hidden">' +
        '<div class="scrollbar-hide" style="display:flex;overflow-x:auto;aspect-ratio:3/2;scroll-snap-type:x mandatory">' +
          '<div class="flex items-center justify-center text-[60px]"' +
            // ⚠️ position 은 **인라인** — 절대배치 <img> 의 포함 블록은 구조 요건이라 유틸 클래스에 맡기지 않는다.
            ` style="position:relative;flex:0 0 100%;scroll-snap-align:center;background-color:#1D1F29;` +
            `background-image:url(&quot;${escAttr(heroUrl)}&quot;);background-size:cover;background-position:center">` +
            `<img src="${escAttr(heroUrl)}" alt="${escAttr(title)}" loading="eager" fetchpriority="high" decoding="async"` +
            ` style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` +
          '</div>' +
          restSlidesHtml(images, title) +
        '</div>' +
      '</div>'

    // ⭐ 값이 없어도 div 는 그린다 — `mb-1`(4px)이 그 자리에 남아야 한다(라이브 37건이 이 경우다).
    const star = Number(p.star_rating) > 0 ? `<span>${escText(String(p.star_rating))}성급</span>` : ''
    const head =
      `<div class="${STAY_HEAD.titleBlock}">` +
        `<div class="${STAY_HEAD.metaRow}">${star}</div>` +
        `<h1 class="${STAY_HEAD.h1}">${escText(title)}</h1>` +
      '</div>'

    // 로더는 사진 **아래**로 — `min-height:100dvh` 그대로면 사진 때문에 문서가 화면보다 길어진다.
    const shortLoader = loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')
    // 🧷 첫 화면을 `ur-first-screen` 으로 감싼다 — 클라(`lib/boot-first-screen.ts`)가 이 **노드 자체**를
    //   들고 있다가 Suspense 폴백에 도로 붙인다(불투명 풀스크린 로더가 방금 도착한 사진을 덮던 것 제거).
    // 📰 `<noscript>` 요약은 JS 가 돌면 렌더조차 안 된다 → 사람 화면 밀림 0 · 추가 요청 0.
    return (
      `<div id="ur-first-screen" class="${STAY_HEAD.pageBg}">` +
        `<div class="${STAY_HEAD.shell}">` +
          crumb +
          // 📱 본문은 모바일만 — PC 는 그리드 밖 제목 헤더 때문에 반쪽만 그리면 마운트 때 밀린다.
          `<div class="${STAY_HEAD.gridPad} lg:hidden">` +
            `<div class="${STAY_HEAD.heroWrap}">${hero}${mobileThumbRowHtml(images)}</div>` +
            head +
          '</div>' +
        '</div>' +
        // 🔀 첫 화면이 제목·성급을 그렸으니 요약에서는 뺀다(규율 ② — 반복 금지). 지역·가격·주소·객실은 남는다.
        stayNoscriptFromPayload(ssrPayload, { skipTitle: true }) +
      '</div>' + shortLoader
    )
  } catch {
    return '' // seed 파싱 실패 — 폴백(치명 아님)
  }
}
