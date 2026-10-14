/**
 * 🧾 크롤러 문서의 **행과 글자 조립** — `crawler-noscript.ts` 에서 추출(2026-10-14).
 *
 * ## 왜 나눴나
 * 사진(2026-10-14)을 붙이며 `crawler-noscript.ts` 가 **685줄**이 되어 god 파일 래칫(600)을
 * 넘겼다. 2026-10-13 에 `urshorts-noscript.ts` 를 같은 이유로 떼어 낸 선례를 따른다.
 *
 * 경계는 **"행 하나를 어떻게 글·링크·사진으로 만드는가"** 다 — 표면별 조립(어느 표면이 어떤
 * 행을 고르는가)은 그대로 `crawler-noscript.ts` 에 남는다.
 *
 * 🔴 **이 파일은 `crawler-noscript.ts` 를 import 하지 않는다** — 그쪽이 이 파일을 쓰므로
 *    순환이 된다. 그래서 글자 조립 원시함수(`esc`·`won`·`lines`·`wrap`)가 **여기** 산다
 *    (`crawler-noscript.ts` 가 `esc` 를 다시 export 해서 기존 import 경로는 그대로 돈다).
 */
import { canonicalDetailPath, FLOW_CONFIG } from '../../shared/product-flow'
import { priceDisplay } from '../../shared/price-display'
import { storeNameParts } from '@/shared/seo/store-name-dedupe'
import { cfImage } from '../../utils/cf-image'
import { addressInRegion, type RegionRef } from '../../shared/constants/region-slugs'

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 숫자를 `7,500` 으로. 워커엔 Intl 이 있지만 로케일 의존을 피해 직접 찍는다. */
export function won(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 값이 실제로 있는 줄만 남긴다 — 빈 라벨을 만들지 않기 위한 공통 조립기. */
export function lines(items: Array<string | false | null | undefined>): string {
  const kept = items.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  return kept.map((t) => `<p>${t}</p>`).join('')
}

export function wrap(inner: string): string {
  if (!inner) return ''
  // ⚠️ `<noscript>` 안의 스타일은 의미가 없다(JS 가 돌면 렌더 자체가 안 된다) — 클래스를 붙이지
  //    않는 이유다. 크롤러는 텍스트만 읽고, JS 를 끈 사람에게는 브라우저 기본 스타일로 읽힌다.
  return `<noscript>${inner}</noscript>`
}


export interface RegionSeedRow {
  /** 🔗 링크를 만들려면 필요하다 — `ItemList`·sitemap 이 쓰는 그 id 다. */
  id?: number | string | null
  name?: string | null
  restaurant_name?: string | null
  /** 교환권 카드의 머리 — 매장이 없는 대신 브랜드를 그린다. */
  brand_name?: string | null
  category?: string | null
  restaurant_address?: string | null
  business_address?: string | null
  price?: number | null
  original_price?: number | null
  discount_rate?: number | null
  deal_only?: number | null
  /** 🖼️ 2026-10-14 — 사진. 지역 요약 화이트리스트(`region-digest.ts`)에 이미 있고 라이브에 실재한다. */
  image_url?: string | null
}

/**
 * 🧾 시드 한 행 → 사람이 읽는 한 줄. 네 목록 표면과 지역 페이지가 **같은 모양**을 쓴다.
 *
 * 머리는 `restaurant_name`(이용권·숙소) 또는 `brand_name`(교환권) — 그 카드가 화면에 그리는 것과
 * 같다. 둘 다 없으면 상품명만. 규율 ①(지어내지 않는다)대로 **시드에 있는 값만** 쓴다.
 */
export interface Row { text: string; href: string | null; img?: { src: string; alt: string } }

/**
 * 🖼️ 2026-10-14 — **비-JS 크롤러가 받는 문서에 사진이 0장이었다** (대표 "다 해주고").
 *
 * 라이브 실측(UA 별로 같은 경로를 받아 셌다):
 *
 *       표면          Googlebot   iPhone    Yeti      문서의 img
 *       /vouchers      19.0KB     67.1KB    19.0KB    1 (유달이 로더뿐)
 *       /products/:id   6.2KB     54.4KB     6.2KB    1
 *       (대조) /       72.8KB    120.8KB    72.8KB    5 (카드 4장 + 로더)
 *
 * 🩸 **먼저 제 근거를 정정한다**: 처음 *"구글 이미지에 들어갈 자리가 없다"* 고 읽었는데 틀렸다 —
 *    봇 셸에도 **엔트리 스크립트가 있어서**(`script src` 1) Googlebot 은 렌더해서 React 카드의
 *    `<img>` 를 본다. 실제 공백은 **JS 를 안 돌리는 쪽**이다: 네이버 Yeti · AI 검색봇.
 *    ⇒ 가치는 *구글 이미지 유입*이 아니라 **네이버 이미지 검색 + 구글 렌더 지연 보험**이다.
 *    (2026-10-11 에 상세 히어로를 진짜 `<img>` 로 바꾼 것은 **React 쪽** 수리였고 이건 서버 쪽이다.)
 *
 * 🔑 **사진은 시드에 이미 와 있다** — `image_url` 은 지역 요약 화이트리스트(`region-digest.ts`)에
 *    들어 있고 라이브 응답에 실재한다. 새 조회가 **0** 이다.
 *
 * 🔴 **앞 4행만** 사진을 받는다(글은 8행 그대로). `<noscript>` 는 **사람이 받는 응답에도 그대로
 *    실리므로** 전량 덤프가 아니라 요약이어야 한다는 이 파일의 규율이고, 크롤러가 실제로 내려받는
 *    바이트도 그만큼이다(cdn-cgi 로 폭 200 → 장당 ~7KB).
 *
 * 🔴 **치수를 선언하지 않는다** — 우리 사진은 비율이 제각각이라(2026-08-31 실측: 세로가 더 긴 것
 *    37%, 중앙값 1:1) `height` 를 적으면 **모르는 값을 지어내는 것**이다. `<noscript>` 라 사람
 *    화면의 CLS 와도 무관하다.
 *
 * ⚠️ **못 보는 것**: 네이버가 `<noscript>` 안의 `<img>` 를 실제로 이미지 검색에 색인하는지는
 *    **외부 판정**이다(서치어드바이저는 대표만 본다). 문서에 자리를 만든 것까지가 우리 몫이다.
 */
export const ROW_IMG_MAX = 4

/**
 * 🔴 **워커 프록시로 가는 사진은 쓰지 않는다.**
 *
 * `cfImage` 는 검증 안 된 호스트를 `/api/image/resize` 로 보내는데, **그 경로는 리사이즈를 못 한다**
 * (2026-06-11 실측 — 리사이저가 워커 내부 서브요청엔 적용되지 않아 항상 원본 폴백이다).
 * 그러면 크롤러가 **원본 통째**를 받아 가고(`/products/2917` 실측에서 실제로 그랬다) 우리 워커
 * 인보케이션도 함께 늘어난다. 공유 카드에서 같은 이유로 cdn-cgi 를 직접 조립한 그 판단과 같다
 * (2026-10-12: 워커 프록시 경유 3MB ↔ cdn-cgi 196KB).
 *
 * ⇒ 폭이 보장되는 **cdn-cgi 경로만** 쓰고, 아니면 그 행은 **사진 없이 글만** 남긴다.
 *   사진이 몇 장 빠지는 것이 큰 원본을 뿌리는 것보다 싸다.
 */
export function sizedCdnCgi(raw: string, width: number): string {
  const u = cfImage(raw, { width, quality: 80 })
  return u.startsWith('/cdn-cgi/image/') ? u : ''
}

/** 행의 사진 — 시드에 `image_url` 이 없으면 **만들지 않는다**(지어내지 않는다). */
export function rowImg(p: RegionSeedRow, alt: string): { src: string; alt: string } | undefined {
  const raw = typeof p?.image_url === 'string' ? p.image_url.trim() : ''
  if (!raw || !alt) return undefined
  const src = sizedCdnCgi(raw, 200)
  return src ? { src, alt } : undefined
}
/**
 * 사진을 **`ROW_IMG_MAX` 장까지만** 남긴다(나머지 행은 글만).
 *
 * 🩸 2026-10-14 — 처음엔 *앞 N **행***(`i < ROW_IMG_MAX`)으로 셌는데, 그러면 사진을 못 쓰는 행
 *   (사진 없음 · 워커 프록시 호스트)이 **자리를 먹는다**. 주입 검증이 그걸 잡았다: 프록시 가드를
 *   지운 주입이 **초록**이었다 — 탐침의 프록시 행이 5번째라 어차피 상한에 걸려 사진이 안 붙었고,
 *   그래서 그 가드를 없애도 출력이 1바이트도 안 바뀌었다. 지키려는 것은 *"문서에 사진 N장"* 이므로
 *   **그려진 사진을 센다**.
 */
export function capRowImages(rows: Row[]): Row[] {
  let used = 0
  return rows.map((r) => {
    if (r.img && used < ROW_IMG_MAX) { used += 1; return r }
    return { text: r.text, href: r.href }
  })
}

/**
 * 🔗 2026-10-12 (대표 *"다 개선하고 또 개선할 것 있는지 찾아줘"*): **행의 링크.**
 *
 * 라이브 실측(Googlebot UA 로 서버 HTML 을 받아 `<a href>` 를 셌다) — 목록·지역 표면의
 * 크롤러 문서에 **내부 링크가 0개**였다:
 *
 *     /region/서울  본문 364자 · a태그 **0**      /vouchers 231자 · 0
 *     /map          359자 · 0                     /stays    436자 · 0 · /browse 36자 · 0
 *     ↔ /pass/:id   a태그 2 (빵부스러기) · /u/:handle 4 (첫 화면) · /blog 21
 *
 * 즉 **허브 → 상세** 방향이 통째로 비어 있었다. 상세 → 허브는 빵부스러기가 이미 잇는다.
 * JS 를 렌더하는 Googlebot 은 SPA 링크를 보지만 **Yeti(네이버)·AI 검색봇은 이 문서가 전부**다
 * (대표 *"네이버도 해주고"*). 453건이 sitemap 으로만 발견되고 내부 링크 가치는 0 이었다.
 *
 * 🔑 주소는 **정본 SSOT**(`canonicalDetailPath`) 하나에서 — `ItemList`(`surface-list-jsonld.ts`)·
 *    sitemap 과 같은 함수라 세 벌이 갈릴 수 없다(갈리면 같은 상품이 세 URL 로 제출된다).
 * 🔴 **교환권(`deal_only=1`)은 링크하지 않는다** — 그 상세는 2026-07-07 결정으로 noindex 이고,
 *    2,260건에 크롤 경로를 열면 *색인하지 말라고 한 URL* 로 크롤 예산이 빠진다. 글은 그대로 남는다
 *    (`/vouchers` 목록이 읽을 거리를 잃지 않는다). `ItemList` 허용목록을 가른 것과 같은 판단이다.
 */
export function rowHref(p: RegionSeedRow): string | null {
  if (p?.deal_only === 1) return null
  if (p?.id == null || p.id === '') return null
  // 🩸 **빌더를 돌려 보고 고쳤다** — `canonicalDetailPath` 는 순수 쇼핑 상품에 `null` 을 준다
  //   (= "cross-canonical 아님"). 그걸 "링크 없음" 으로 읽어 `/browse`·`/map` 의 쇼핑 상품이
  //   링크를 못 받고 있었다(실측 `id 2917` 이 글만 남았다). 그 경우의 정본은 `/products/:id` 이고
  //   주소는 `FLOW_CONFIG.standard_checkout.detailPath` 가 말한다 — 손으로 적지 않는다.
  const path = canonicalDetailPath({ id: p.id, deal_only: p.deal_only, category: p.category })
    || FLOW_CONFIG.standard_checkout.detailPath(p.id)
  return path && path.startsWith('/') ? path : null
}

/** 한 행 → `<li>`. 링크가 없으면 **글만** 남긴다(빈 `<a>` 를 만들지 않는다). */
export function liOf(r: Row): string {
  // 🖼️ 사진은 링크 **안쪽**에 둔다 — 그래야 그 그림이 어느 페이지의 것인지 크롤러가 안다.
  const img = r.img ? `<img src="${esc(r.img.src)}" alt="${esc(r.img.alt)}">` : ''
  const body = `${img}${esc(r.text)}`
  return `<li>${r.href ? `<a href="${esc(r.href)}">${body}</a>` : body}</li>`
}

export function rowLine(p: RegionSeedRow): Row | null {
  const head = (p?.restaurant_name || p?.brand_name || '').trim()
  const title = (p?.name || '').trim()
  if (!head && !title) return null
  const parts = storeNameParts(head, title) // 같은 말을 두 번 안 한다(근거는 그 SSOT 머리말)
  const d = priceDisplay({ price: p?.price, original_price: p?.original_price, discount_rate: p?.discount_rate })
  const price = d.price > 0 ? ` 판매가 ${won(d.price)}원${d.discount > 0 ? ` (${d.discount}% 할인)` : ''}` : ''
  // `alt` 는 **그 행의 이름 부분 그대로** 다(가격은 그림을 설명하지 않으므로 뺀다).
  const alt = parts.filter(Boolean).join(' ')
  return { text: `${parts.filter(Boolean).join(' — ')}${price}`, href: rowHref(p), img: rowImg(p, alt) }
}

/** 시드 문자열 → 행 배열. 모양이 다른 시드(배열 / `{products}`)를 둘 다 받는다. */
export function parseSeed(ssrPayload: string | null | undefined): RegionSeedRow[] {
  if (!ssrPayload) return []
  try {
    const d = JSON.parse(ssrPayload) as { data?: RegionSeedRow[] | { products?: RegionSeedRow[] } }
    const arr = Array.isArray(d?.data) ? d.data : d?.data?.products
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 시드에서 그 지역 행만 골라 한 줄씩. 교환권(`deal_only`)은 매장이 없으니 제외한다. */
export function regionSeedRows(ssrPayload: string | null | undefined, ref: RegionRef): Row[] {
  const out: Row[] = []
  for (const p of parseSeed(ssrPayload)) {
    if (p?.deal_only === 1) continue
    if (!addressInRegion(p?.restaurant_address || p?.business_address, ref)) continue
    const line = rowLine(p)
    if (line) out.push(line)
  }
  return out
}
