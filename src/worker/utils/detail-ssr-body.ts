/**
 * 🖼️ 이용권 상세(`/group-buy/:id`)의 **서버가 그리는 첫 화면** (2026-09-15 대표
 * *"꼭 로딩이 걸려야 해?"* → *"없어지는게 좋으면 없애도 돼"*).
 *
 * ## 왜 — 데이터는 진작 도착해 있는데 그릴 사람이 안 깨어나 있었다
 * 라이브 실측(iPhone 에뮬, 하드로드):
 *
 *     0.2초   HTML 도착 — `__SSR_INITIAL_DETAIL__` 에 상품이 **이미 들어 있다**
 *     0.5초   히어로 사진 도착 — 워커가 preload 로 당겨 놨다(`home-card-preload.ts`)
 *     1.4초   React 마운트 — 그제서야 사진이 화면에 그려진다
 *
 * 그 1.2초 동안 화면은 `urdeal.` 워드마크뿐이다. **사진이 캐시에 앉아서 기다린다.**
 * CPU 프로파일상 그 1초의 대부분은 앱 코드가 아니라 `(program)`(V8 파싱·컴파일)이라,
 * 코드를 고쳐서 줄일 수 있는 성질이 아니다 — 번들을 줄이거나, **기다리지 않고 그리거나** 둘뿐이다.
 *
 * ## 무엇을 그리나 — 히어로까지만. 그 아래는 한 픽셀도 안 그린다
 * React 는 `createRoot`(비-hydrate)라 마운트 시 `#root` 를 **통째로 갈아엎는다**. 그래서 서버가
 * 그린 것과 React 첫 렌더가 어긋나면 그 자리가 **튄다** — 대표가 2026-07-01 에 금지한
 * *"로딩 화면 2~3개"* 로 되돌아가는 길이 정확히 이것이다.
 *
 * ⇒ 어긋날 수 없는 것만 그린다:
 *   - **빵부스러기**(카테고리) — `DetailBreadcrumb` 과 **같은 클래스 문자열**, 사용자와 무관.
 *   - **히어로 사진** — `DetailGallery` 모바일 슬라이드와 같은 프레임(3:2)·같은 URL
 *     (`detailHeroMobileUrl` SSOT — 워커 preload 가 이미 쓰는 그 함수).
 *   - 그 아래는 **로더**. 마운트 때 로더가 사라지고 내용이 채워질 뿐, **사진은 제자리에 있다.**
 *
 * ❌ 제목·가격은 일부러 뺐다. 그 위에 `ShareRewardBanner`(딜 보유자에게만 뜨는 per-user 블록)가
 *    있어서, 서버가 그리면 **딜 가진 사용자에게만** 마운트 때 아래로 밀린다. "대부분은 안 밀린다"는
 *    기준으로 이 클래스를 통과시키지 않는다.
 * ❌ PC(lg+)는 히어로를 안 그린다 — PC 는 [제목 헤더 + 4:3/16:9 대형 + 썸네일 2칸] 별도 레이아웃이라
 *    복제 면적이 몇 배다. PC 는 빵부스러기 + 로더(=종전과 거의 같음). 별건.
 * ❌ `/vouchers/:id`(교환권)는 **같은 DETAIL 슬롯이지만 다른 페이지**(`VoucherDetailPage`)다.
 *    호출부가 pathname 으로 가른다 — 여기서 그리면 없는 레이아웃을 그리는 셈이다.
 *
 * ## 이 파일이 **못** 하는 것
 * - 클래스가 갈렸는지는 문자열로 못 잰다 → `detail-ssr-first-screen` 테스트가 실제 컴포넌트를
 *   렌더해 프레임·URL·클래스를 대조한다. 그래도 최종 판정은 **프레임 캡처**다.
 * - 마운트 전에는 눌러도 아무 일도 안 난다(사진은 배경이라 링크가 아니다 — 원래 그렇다).
 */
import {
  DETAIL_HERO_MOBILE_WIDTH,
  detailGalleryImages,
  detailHeroMobileUrl,
} from '../../shared/detail-hero-image'
import { getVoucherShortLabel, normalizeCategory } from '../../shared/constants/voucher-categories'

function escAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escText(s: string): string {
  return escAttr(s).replace(/'/g, '&#39;')
}

/**
 * `DetailBreadcrumb`(overlayHeader) 과 **같은 클래스**. 갈리면 마운트 때 한 줄이 튄다.
 * ⚠️ 라벨은 명칭 SSOT(`getVoucherShortLabel`)를 쓴다 — 여기서 "식사권" 같은 옛 어휘가 되살아나지 않게.
 */
export const DETAIL_CRUMB_CLASS =
  'flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[13px] leading-none scrollbar-hide px-4 pb-2.5 lg:px-8 lg:pt-4 lg:pb-1 lg:max-w-[1200px] lg:mx-auto pt-[64px]'

function crumbHtml(category: string | null | undefined): string {
  const cat = normalizeCategory(category)
  if (!cat) return '' // 크럼이 하나면 경로가 아니다 — 컴포넌트도 안 그린다(`shown.length < 2`).
  const label = escText(getVoucherShortLabel(cat))
  return (
    `<nav aria-label="현재 위치" class="${DETAIL_CRUMB_CLASS}">` +
      '<span class="flex items-center gap-1.5 shrink-0">' +
        '<a href="/" class="text-gray-600 dark:text-gray-300 underline underline-offset-[3px] decoration-gray-300 dark:decoration-gray-600">홈</a>' +
      '</span>' +
      '<span class="flex items-center gap-1.5 shrink-0">' +
        '<span aria-hidden="true" class="text-gray-300 dark:text-gray-600">/</span>' +
        `<a href="/?category=${escAttr(cat)}" class="text-gray-600 dark:text-gray-300 underline underline-offset-[3px] decoration-gray-300 dark:decoration-gray-600">${label}</a>` +
      '</span>' +
    '</nav>'
  )
}

/** 사진 위 그라디언트 — `DetailGallery` 의 `badges` 와 같은 값(없으면 사진 가장자리 톤이 달라진다). */
const HERO_SCRIMS =
  '<div style="position:absolute;inset:0 0 auto 0;height:110px;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.4),transparent)"></div>' +
  '<div style="position:absolute;inset:auto 0 0 0;height:120px;pointer-events:none;background:linear-gradient(0deg,rgba(0,0,0,.32),transparent)"></div>'

interface DetailSeed {
  name?: string
  image_url?: string
  images?: string | null
  image_urls?: string | null
  detail_images?: string | null
  category?: string | null
}

/**
 * `#root` 에 넣을 첫 화면 HTML. 만들 수 없으면 `''` → 호출부가 기존 로더로 폴백(무회귀).
 *
 * @param ssrPayload `__SSR_INITIAL_DETAIL__` 원문
 * @param loaderHtml 기존 URDEAL 로더(사진 아래에 붙는다 — 아직 오는 중이라는 정직한 신호)
 */
export function buildDetailFirstScreen(ssrPayload: string, loaderHtml: string): string {
  try {
    const d = (JSON.parse(ssrPayload) as { data?: DetailSeed })?.data
    if (!d || !d.name) return ''
    const images = detailGalleryImages(d)
    const main = images[0] || ''
    if (!main) return '' // 사진이 없으면 그릴 것도 없다(카테고리 아이콘 폴백은 React 가 그린다).
    const heroUrl = detailHeroMobileUrl(main, DETAIL_HERO_MOBILE_WIDTH)
    if (!heroUrl || heroUrl.startsWith('data:')) return ''

    const hero =
      '<div class="relative lg:hidden">' +
        '<div class="scrollbar-hide" style="display:flex;overflow-x:auto;aspect-ratio:3/2;scroll-snap-type:x mandatory">' +
          `<div role="img" aria-label="${escAttr(d.name)}" style="flex:0 0 100%;scroll-snap-align:center;background-color:#1D1F29;` +
            `background-image:url(&quot;${escAttr(heroUrl)}&quot;);background-size:cover;background-position:center"></div>` +
        '</div>' +
        HERO_SCRIMS +
      '</div>'

    // 로더는 사진 **아래**로 — 종전 `min-height:100dvh` 그대로면 사진 때문에 문서가 화면보다 길어진다.
    const shortLoader = loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')
    return crumbHtml(d.category) + hero + shortLoader
  } catch {
    return '' // seed 파싱 실패 — 로더로 폴백(치명 아님)
  }
}
