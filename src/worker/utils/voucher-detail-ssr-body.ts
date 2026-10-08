/**
 * 🎁 교환권 상세(`/vouchers/:id`)의 **서버가 그리는 첫 화면** (2026-10-08 대표 *"모두 다 하자"*).
 *
 * ## 왜 — 이용권 상세와 **똑같은 상황인데 pathname 하나로 제외돼 있었다**
 * 라이브 전수 실측(2026-10-08, iPhone UA, JS 를 끈 채 서버 HTML 그대로 캡처):
 *
 *     /pass/:id       첫 페인트 = 빵부스러기 + 사진 + 제목      ← 2026-09-15/16 수리
 *     /vouchers/:id   첫 페인트 = 유달이 로더만                 ← **시드는 2.4KB 이미 와 있다**
 *
 * 두 경로는 **같은 DETAIL 슬롯 · 같은 시드**를 쓴다. 다른 것은 그릴 React 페이지뿐이고
 * (`GroupBuyDetailPage` ↔ `VoucherDetailPage`), 그래서 `detail-ssr-body.ts` 가 호출부에서
 * `pathname.startsWith('/pass/')` 로 스스로를 제외했다(그 파일 머리말의 마지막 ❌ 항목).
 * 이 파일이 그 빠진 짝이다 — 같은 원리, 다른 레이아웃.
 *
 * ## 무엇을 그리나 — **제목(h1)까지**
 * React 는 `createRoot`(비-hydrate)라 마운트 때 `#root` 를 통째로 갈아엎는다. 서버가 그린 것과
 * 첫 렌더가 어긋나면 그 자리가 **튄다** ⇒ 어긋날 수 없는 것만 그린다:
 *
 *   1. **상단 바** — `sticky h-14`. 높이를 만드는 클래스는 그대로 두고 **뒤로가기 아이콘은 안 그린다.**
 *      lucide `ArrowLeft` 의 path 를 워커 문자열로 손으로 옮기는 것은 이 레포가 반복해 당한
 *      *두 벌이 갈리는* 클래스다. 아이콘은 바 **안에서** 나중에 나타나므로 높이가 안 바뀐다
 *      (= 밀림 0). 1초 동안 바가 비어 보이는 것이 대가이고, 그건 밀림이 아니다.
 *   2. **정사각 사진** — `VoucherDetailPage` 와 **같은 `src`/`srcSet`/`sizes`**.
 *      셋이 같아야 브라우저가 고르는 후보가 같다(하나만 달라도 마운트 때 **다시 받는다**).
 *   3. **분류 칩 + 제목(h1)** — 시드에 있는 값 그대로. 칩 라벨은 `deal_only===1 ? '교환권' :
 *      getVoucherShortLabel(category)` 로 페이지와 같은 규칙(명칭 SSOT).
 *
 * ❌ **가격 아래로는 한 픽셀도 안 그린다.** 잔액·할인 안내는 로그인 상태에 따라 달라지고
 *    (`isLoggedInSync`) 서버는 그걸 모른다. 서버가 **안 그린** 것이 나중에 채워지는 건 밀림이 아니다.
 * ✅ **PC(lg+)도 그린다** — 이용권 상세와 다른 점이다. 저쪽은 첫 화면이 2열 그리드인데 그리드
 *    **밖**에 제목 블록이 있어서 반쪽만 그리면 마운트 때 가로로 줄어들었다. 이 페이지는 사진도
 *    제목도 **같은 `lg:grid` 안**이라 서버가 그 구조를 통째로 그리면 마운트와 모양이 같다.
 *
 * ## 이 파일이 **못** 하는 것
 * - 클래스가 갈렸는지는 문자열로 못 잰다 → `voucher-detail-ssr-first-screen` 테스트가
 *   **페이지 소스에서 클래스를 파싱해** 대조한다. 최종 판정은 프레임 캡처다.
 * - Save-Data 켠 사용자는 `cfImage` 가 quality 를 낮춰 URL 이 달라진다 → 그 사용자만 사진을
 *   다시 받는다(히어로 preload 가 2026-07-02 부터 안고 있는 것과 **같은** 트레이드오프).
 * - 마운트 전에는 눌러도 아무 일도 안 난다(뒤로가기 버튼이 아직 없다 — 브라우저 뒤로가기는 된다).
 */
import { cfImage, cfSrcSet } from '../../utils/cf-image'
import { getVoucherShortLabel } from '../../shared/constants/voucher-categories'

function escAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escText(s: string): string {
  return escAttr(s).replace(/'/g, '&#39;')
}

/**
 * 🔒 아래 다섯은 **`VoucherDetailPage.tsx` 의 className 과 글자 하나까지 같아야 한다.**
 * 갈리면 마운트 때 그 자리가 튄다 — 테스트가 페이지 소스를 읽어 대조한다.
 */
export const VOUCHER_FS_CLASS = {
  /** 루트 배경 — 안 맞으면 마운트 때 바탕색이 바뀐다. */
  root: 'min-h-[100dvh] bg-white dark:bg-[#11141C]',
  barOuter: 'sticky top-0 z-40 bg-white/90 dark:bg-[#11141C]/90 backdrop-blur',
  barInner: 'ur-content-narrow lg:max-w-[1000px] h-14 px-2 flex items-center',
  shell: 'ur-content-narrow lg:max-w-[1000px] px-4 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start lg:pt-6',
  photo:
    'relative aspect-square w-full rounded-[28px] overflow-hidden bg-gradient-to-b from-[#F7F8FA] to-[#EFF1F4] ' +
    'dark:from-[#15171C] dark:to-[#0F1115] lg:sticky lg:top-20',
  info: 'pt-[18px] lg:pt-0',
  label: 'text-[12px] font-bold text-[#171B24] bg-[#d1d5db] rounded-md px-[9px] py-1 whitespace-nowrap',
  h1: 'mt-[7px] text-[24px] font-extrabold text-[#171B24] dark:text-white leading-tight tracking-tight',
} as const

/** 페이지가 쓰는 값과 동일 — `cfImage(…, { width: 800, format: 'auto' })` · `cfSrcSet(…, 800)`. */
export const VOUCHER_PHOTO_WIDTH = 800
export const VOUCHER_PHOTO_SIZES = '(max-width: 640px) 100vw, 720px'

interface VoucherSeed {
  name?: string
  image_url?: string | null
  category?: string | null
  deal_only?: number | null
}

/**
 * `#root` 에 넣을 첫 화면 HTML. 만들 수 없으면 `''` → 호출부가 기존 로더로 폴백(무회귀).
 *
 * @param ssrPayload `__SSR_INITIAL_DETAIL__` 원문
 * @param loaderHtml 기존 URDEAL 로더(첫 화면 **아래**에 붙는다 — 아직 오는 중이라는 정직한 신호)
 */
export function buildVoucherDetailFirstScreen(ssrPayload: string, loaderHtml: string): string {
  try {
    const d = (JSON.parse(ssrPayload) as { data?: VoucherSeed })?.data
    if (!d || !d.name) return ''
    const raw = (d.image_url || '').trim()
    if (!raw) return '' // 사진이 없으면 그릴 것도 없다(빈 그라디언트만 그리면 득이 없다).
    const src = cfImage(raw, { width: VOUCHER_PHOTO_WIDTH, format: 'auto' }) || raw
    if (!src || src.startsWith('data:')) return ''
    const srcSet = cfSrcSet(raw, VOUCHER_PHOTO_WIDTH)

    const label = d.deal_only === 1 ? '교환권' : getVoucherShortLabel(d.category)

    const photo =
      `<div class="${VOUCHER_FS_CLASS.photo}">` +
        `<img src="${escAttr(src)}"` +
        (srcSet ? ` srcset="${escAttr(srcSet)}"` : '') +
        ` sizes="${escAttr(VOUCHER_PHOTO_SIZES)}" alt="${escAttr(d.name)}"` +
        ' loading="eager" fetchpriority="high" decoding="async" class="w-full h-full object-cover">' +
      '</div>'

    const info =
      `<div class="${VOUCHER_FS_CLASS.info}">` +
        '<div class="flex items-center">' +
          `<span class="${VOUCHER_FS_CLASS.label}">${escText(label)}</span>` +
        '</div>' +
        `<h1 class="${VOUCHER_FS_CLASS.h1}">${escText(d.name)}</h1>` +
      '</div>'

    // 로더는 첫 화면 **아래**로 — `min-height:100dvh` 그대로면 사진 때문에 문서가 화면보다 길어진다.
    const shortLoader = loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')

    // 🧷 `id="ur-first-screen"` — 클라(`lib/boot-first-screen.ts`)가 이 **노드 자체**를 들고 있다가
    //   Suspense 폴백에 도로 붙인다(불투명 풀스크린 로더가 방금 그린 화면을 덮던 것 제거).
    //   그 장치는 경로를 안 가리므로 id 만 같으면 이 화면에도 그대로 적용된다.
    return (
      `<div id="ur-first-screen" class="${VOUCHER_FS_CLASS.root}">` +
        `<div class="${VOUCHER_FS_CLASS.barOuter}"><div class="${VOUCHER_FS_CLASS.barInner}"></div></div>` +
        `<div class="${VOUCHER_FS_CLASS.shell}">${photo}${info}</div>` +
      '</div>' + shortLoader
    )
  } catch {
    return '' // seed 파싱 실패 — 로더로 폴백(치명 아님)
  }
}
