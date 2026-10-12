/**
 * 📰 **JS 를 안 돌리는 크롤러에게 줄 본문 요약(`<noscript>`)의 SSOT**
 * (2026-10-11 대표 *"네이버도 해주고 … 언제나 최상단에 노출이 될 수 있게끔"*)
 *
 * ## 왜 필요한가 — 제목은 완벽한데 본문이 49자였다 (라이브 실측, Yeti UA)
 *
 *     /pass/2915   본문 49자   "홈 / 식사 이용권 홍대돈까스 홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트 urdeal"
 *     /vouchers/…  본문 37자
 *
 * `<title>`·`og:*`·`canonical`·JSON-LD·네이버 확인 메타는 **전부 완비**였다. 빠진 것은 **본문**
 * 하나다. 서버 첫 화면(2026-09-15~10-09)이 그리는 것은 [빵부스러기 · 사진 · 제목]까지이고 —
 * 그건 의도다(그 아래는 per-user 값이거나 거리처럼 서버가 모르는 값이라 그리면 마운트 때 밀린다).
 * 그래서 사람에게는 맞지만 **크롤러에게는 "내용 없는 페이지"** 로 남았다. 네이버는 문서의 텍스트로
 * 주제를 판단하므로 49자는 롱테일 검색어(`홍대돈까스 할인`·`전주 돈가스 이용권`)에 걸릴 수가 없다.
 *
 * ⇒ `<noscript>` 는 **정확히 이 틈에 맞는 도구**다: JS 가 돌면 브라우저가 렌더하지 않고(사람에게
 * 영향 0), JS 를 안 돌리는 크롤러(Yeti·AI 검색)는 읽는다. 구글은 JS 를 돌려 무시하지만 구글은
 * 이미 마운트된 실제 본문을 본다.
 *
 * ## 🔒 두 가지 규율 — 이게 클로킹과 정직한 요약을 가르는 선이다
 *
 * **① 화면에 없는 문구를 지어내지 않는다.** 여기 들어가는 값은 전부 시드(`__SSR_INITIAL_*`)의
 *    필드이고, 그 필드는 마운트된 화면에 그대로 보인다. "매장에서 QR 을 보여 주세요" 같은
 *    *그럴듯한 안내문*을 내가 작성해 넣으면 — 화면 문구가 바뀌는 날 둘이 갈리고, 그건 크롤러에게만
 *    다른 내용을 주는 것이 된다(클로킹). 안내 문구가 필요하면 시드에 실어 와서 쓸 것.
 *
 * **② 첫 화면이 이미 그린 것은 다시 쓰지 않는다.** 제목(h1)·매장명은 같은 `#root` 안에 이미 있다.
 *    `<noscript>` 에 또 넣으면 크롤러가 같은 문구를 두 번 보고, 그건 정보가 아니라 반복이다.
 *    ⇒ 여기 담는 것은 **첫 화면이 안 그리는 것만**: 가격·정가·할인 · 주소 · 전화 · 설명 ·
 *    유효기간 · 유의사항.
 *
 * ## ❌ 이 파일이 안 하는 것
 * - 메타·OG·JSON-LD 는 건드리지 않는다(`detail-ssr-meta.ts`·`surface-ssr-meta.ts` 가 SSOT).
 * - 값이 없으면 **그 줄을 만들지 않는다**(빈 라벨 `주소:` 만 남는 것이 없는 것보다 나쁘다).
 * - 길이를 늘리려고 같은 값을 변형해 반복하지 않는다.
 */
import { priceDisplay } from '../../shared/price-display'
import { CONCEPT_FAQ, CONCEPT_ABOUT_LINES } from '../../shared/seo/concept-content'
import { addressInRegion, parseRegionPath, type RegionRef } from '../../shared/constants/region-slugs'
import { REGION_PATH_RE } from '../../shared/seo/region-seed'
import { CONSUMER_SURFACE_SEO } from '../../shared/seo/consumer-surfaces'
import { surfaceCopyFor } from '../../shared/seo/surface-copy'
import { CONSUMER_TERMS } from '../../pages/terms/consumer-terms-content'
import { SELLER_TERMS } from '../../pages/terms/seller-terms-content'
import type { TermsDoc } from '../../pages/terms/terms-types'

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 숫자를 `7,500` 으로. 워커엔 Intl 이 있지만 로케일 의존을 피해 직접 찍는다. */
function won(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 값이 실제로 있는 줄만 남긴다 — 빈 라벨을 만들지 않기 위한 공통 조립기. */
function lines(items: Array<string | false | null | undefined>): string {
  const kept = items.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  return kept.map((t) => `<p>${t}</p>`).join('')
}

function wrap(inner: string): string {
  if (!inner) return ''
  // ⚠️ `<noscript>` 안의 스타일은 의미가 없다(JS 가 돌면 렌더 자체가 안 된다) — 클래스를 붙이지
  //    않는 이유다. 크롤러는 텍스트만 읽고, JS 를 끈 사람에게는 브라우저 기본 스타일로 읽힌다.
  return `<noscript>${inner}</noscript>`
}

export interface NoscriptDetailSeed {
  name?: string | null
  description?: string | null
  long_description?: string | null
  price?: number | null
  original_price?: number | null
  discount_rate?: number | null
  restaurant_name?: string | null
  restaurant_address?: string | null
  restaurant_phone?: string | null
  voucher_expiry?: string | null
  voucher_terms?: string | null
}

/**
 * 이용권·교환권 상세의 본문 요약.
 *
 * 규율 ②에 따라 **제목·매장명은 넣지 않는다** — 첫 화면의 h1 과 매장 줄이 이미 그 둘을 말한다.
 * 다만 주소 줄의 앞머리로 매장명이 필요하면 호출부가 아니라 여기서 판단하지 않는다(안 넣는다).
 */
export function buildDetailNoscript(d: NoscriptDetailSeed | null | undefined): string {
  if (!d) return ''
  const p = priceDisplay({ price: d.price, original_price: d.original_price, discount_rate: d.discount_rate })
  const priceLine = p.price > 0
    ? (p.hasDiscountLine && p.showOriginal
        ? `판매가 ${won(p.price)}원 · 정가 ${won(p.originalPrice)}원${p.discount > 0 ? ` · ${p.discount}% 할인` : ''}`
        : `판매가 ${won(p.price)}원`)
    : ''

  // 📍 주소·전화는 **로컬 검색의 본체**다(`전주 돈가스`·`가리내10길` 류). 화면 매장 카드에 그대로 있다.
  const addr = (d.restaurant_address || '').trim()
  const phone = (d.restaurant_phone || '').trim()
  const placeLine = addr || phone
    ? [addr && `주소 ${esc(addr)}`, phone && `전화 ${esc(phone)}`].filter(Boolean).join(' · ')
    : ''

  // 설명은 제목과 같을 때가 흔하다(시드 실측) — 같으면 반복이라 버린다(규율 ②).
  const name = (d.name || '').trim()
  const desc = (d.long_description || d.description || '').trim()
  const descLine = desc && desc !== name ? esc(desc) : ''

  const expiry = (d.voucher_expiry || '').trim()
  const terms = (d.voucher_terms || '').trim()

  return wrap(lines([
    priceLine && esc(priceLine),
    placeLine,
    descLine,
    expiry && `유효기간 ${esc(expiry)}`,
    terms && esc(terms),
  ]))
}

/**
 * ⚠️ 핀은 **평평하다** — `pins[].product_name` 이고 `pins[].product.name` 이 아니다
 * (SSOT 는 `utils/curator-ssr-body.ts` 의 `CuratorSeedPin`). 처음 이 파일을 쓸 때 중첩으로
 * 가정했는데, 그러면 전부 `undefined` 가 되어 **`<noscript>` 가 조용히 비어도 에러가 안 난다.**
 * 시드 모양은 기억이 아니라 그 타입에서 가져올 것.
 */
export interface NoscriptCuratorSeed {
  curator?: { name?: string | null; bio?: string | null } | null
  pins?: Array<{ product_name?: string | null; price?: number | null; restaurant_name?: string | null } | null> | null
}

/**
 * 유어샵의 본문 요약 — 소개 + 진열된 이용권 이름·가게.
 *
 * 첫 화면은 진열 **줄 4개**만 그린다(그 아래는 로더). 유어샵은 공유로 퍼지는 표면이라, 담긴 것이
 * 무엇인지 크롤러가 알아야 그 가게 이름으로 검색될 때 잡힌다.
 * ⚠️ 이름은 첫 화면이 이미 그리므로(규율 ②) **소개(bio)와 진열 목록만** 담는다.
 */
export function buildCuratorNoscript(seed: NoscriptCuratorSeed | null | undefined): string {
  if (!seed) return ''
  const bio = (seed.curator?.bio || '').trim()
  const pins = Array.isArray(seed.pins) ? seed.pins : []
  const items = pins
    .filter((x): x is NonNullable<NoscriptCuratorSeed['pins']>[number] & object => !!x)
    .slice(0, 20)
    .map((pr) => {
      const nm = (pr.product_name || '').trim()
      if (!nm) return ''
      const store = (pr.restaurant_name || '').trim()
      const price = Number(pr.price) || 0
      const tail = [store, price > 0 ? `${won(price)}원` : ''].filter(Boolean).join(' · ')
      return `<li>${esc(nm)}${tail ? ` — ${esc(tail)}` : ''}</li>`
    })
    .filter(Boolean)

  const body = (bio ? `<p>${esc(bio)}</p>` : '') + (items.length ? `<ul>${items.join('')}</ul>` : '')
  return wrap(body)
}

/**
 * 🧭 2026-10-12 — **정적 컨셉 표면(`/faq`·`/about`)의 본문 요약.**
 *
 * 대표 *"합리적인 여행, 할인권 등의 우리 유어딜의 컨셉에 맞는 내용들을 바탕으로 해서 최대한
 * AI 검색에서도 노출이 될 수 있게"* · *"AI 서비스 유저가 여행 계획을 짠다던지 동네 맛집을
 * 찾는다던지 할 때 유어딜과 유어딜 이용권들이 나오게끔"*.
 *
 * **라이브 실측(2026-10-12, Googlebot UA)**: `/faq` **33자** · `/about` **30자**. 둘 다
 * `<title>`·`description`·canonical 은 멀쩡했고 **본문만** 비어 있었다 — 이 파일 머리말이
 * 설명하는 그 틈과 **똑같은 모양**이다(상세는 2026-10-11 에 메웠는데 정적 표면은 빠져 있었다).
 *
 * 🔑 **왜 이 둘이 중요한가**: 상품 상세는 `Product`+`Offer`+`FoodEstablishment` 로 *"이런 게
 * 있다"* 를 전달한다. 그런데 *"유어딜이 무엇이고 어떻게 쓰는가"*·*"동네 맛집 할인권은 어디서
 * 찾나"*·*"여행 숙소 이용권이 있나"* 를 답할 **문장**이 서버 HTML 에 한 줄도 없었다. 언어모델이
 * 인용하는 것은 그 문장이다.
 *
 * 🔒 **규율 ①(지어내지 않는다)을 지킨다** — 들어가는 값은 전부 `shared/seo/concept-content.ts`
 * 이고, `/faq` 화면(`FAQPage.tsx`)과 `/about` 히어로가 **같은 배열·같은 문장**을 그린다.
 * 그래서 크롤러가 받는 요약과 사람이 보는 화면이 구조적으로 갈릴 수 없다.
 *
 * 🧷 **첫 화면을 그리지 않는 이유**: 이 둘은 서버가 그릴 시드가 없고(정적 문서), `#root` 를
 * 텍스트로 채우면 마운트 때 통째로 교체돼 깜빡인다. `<noscript>` 는 JS 가 돌면 **렌더조차
 * 안 되므로** 사람 화면 영향 0 · 밀림 0 이다(이 파일의 존재 이유 그대로).
 *
 * ⚠️ **표면을 늘릴 때**: 그 화면이 실제로 그 문장을 그리고 있는지 먼저 확인할 것. 화면에 없는
 *    문장을 여기 넣으면 그건 요약이 아니라 클로킹이다.
 */
/**
 * 🧭 목록 표면 → 그 시드에서 **그 표면의 항목만** 고르는 술어.
 *
 * 라이브 실측(Googlebot UA, 2026-10-12)에서 이 넷의 서버 본문이 각각 **36·23·38·34자** 였다 —
 * 구글이 thin content 로 보는 수준이고, 그 상태로는 "동네 맛집 할인권"·"여행 숙소 이용권" 같은
 * 질의에 인용할 문장이 한 줄도 없다. 시드는 **이미 도착해 있다**(네 표면 전부 `kv-hit`).
 *
 * 🔑 `/stays` 는 자기 슬롯이 없어 **홈과 같은 캐시 키**(`MAIN_SEED_PATH`)를 받고 숙소만 걸러 쓴다 —
 *   `/region/*` 과 같은 수법이라 새 self-fetch 키가 0 이다(실측 그 시드에 `stay_voucher` 5건).
 *
 * ⚠️ 술어를 잘못 주면 **다른 표면의 상품을 그 목록의 내용이라고 말하게 된다**(식당이 숙소 목록에).
 *   가드가 네 술어를 각각 고정한다.
 */
const LIST_SURFACE_KEEP: Readonly<Record<string, (p: RegionSeedRow) => boolean>> = {
  '/vouchers': (p) => p?.deal_only === 1,
  '/browse': (p) => p?.deal_only !== 1,
  '/map': (p) => p?.deal_only !== 1,
  '/stays': (p) => p?.category === 'stay_voucher',
}

export function buildStaticSurfaceNoscript(pathname: string, ssrPayload?: string | null): string {
  // 끝 슬래시를 떼어 `resolveConsumerSurfaceSeo` 와 같은 키로 본다.
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (path === '/faq') {
    // Q&A 를 그대로 — 언어모델이 인용하기 가장 쉬운 모양이고, 같은 배열이 `FAQPage` JSON-LD
    // (`surface-list-jsonld.ts`)와 화면 아코디언을 만든다.
    const items = CONCEPT_FAQ.map(f => `<dt>${esc(f.question)}</dt><dd>${esc(f.answer)}</dd>`).join('')
    return items ? `<noscript><dl>${items}</dl></noscript>` : ''
  }

  if (path === '/about') {
    const lines = CONCEPT_ABOUT_LINES.map(l => `<p>${esc(l)}</p>`).join('')
    return lines ? `<noscript>${lines}</noscript>` : ''
  }

  // ⚖️ 약관은 **그 문서 자체에서 파생**한다 — 제목 · 시행일 · 조항 제목. 손으로 요약을 쓰면
  //   개정될 때 갈리고(문구 변경은 대표 확인 사항이다), 전문을 통째로 쏟으면 요약이 아니다.
  //   라이브 실측 `/terms` **15자**였다 — sitemap 이 제출하는 URL 인데 조항 제목조차 없었다.
  const terms: TermsDoc | null = path === '/terms' ? CONSUMER_TERMS : path === '/terms/seller' ? SELLER_TERMS : null
  if (terms) {
    const heads = terms.sections.map(x => x.title).filter(Boolean)
    return `<noscript><p>${esc(terms.title)} (시행 ${esc(terms.effective)} · v${esc(terms.version)})</p><ul>`
      + heads.map(h => `<li>${esc(h)}</li>`).join('') + '</ul></noscript>'
  }

  // 🧭 시드가 없는 정적 표면(입점·소개 파트너·체험단·새 가게·지역 인덱스 …) — 라이브 실측
  //   **15~40자**였고 전부 sitemap 제출 URL 이다. 문구는 `shared/seo/surface-copy.ts` SSOT 이고
  //   **그 화면에 떠 있는 문장과 같은 말**이어야 한다(가드가 페이지 소스와 대조 — 클로킹 방지).
  const copy = surfaceCopyFor(path)
  if (copy) {
    const lines = copy.lines.map(l => `<p>${esc(l)}</p>`).join('')
    return lines ? `<noscript>${lines}</noscript>` : ''
  }

  // 🗺️ 지역 착지 페이지 — "동네 맛집 할인권" 질의의 착지점인데 라이브 본문이 **26자**였다
  //   (`/region/서울`, Googlebot 실측). 그 페이지가 화면에 그리는 카드(가게 · 메뉴 · 판매가)를
  //   그대로 글로 옮긴다 — 규율 ①(지어내지 않는다)대로 **시드에 있는 값만** 쓴다.
  //   항목은 홈과 같은 시드(MAIN)에서 오고 지역 필터는 `addressInRegion`(화면과 같은 SSOT)이다.
  //   ⚠️ 상한 8 — `<noscript>` 도 **사람이 받는 응답에 그대로 실린다**(크롤러에게만 주는 것은
  //      구글 가이드 위반). 요약이지 전량 덤프가 아니다.
  // 🧾 목록 네 표면 — 라벨은 `CONSUMER_SURFACE_SEO.crumb`(빵부스러기와 같은 SSOT)에서 온다.
  //   ⚠️ 상한 8 은 지역 페이지와 같다 — `<noscript>` 도 **사람이 받는 응답에 그대로 실린다**.
  const keep = LIST_SURFACE_KEEP[path]
  if (keep) {
    const rows: string[] = []
    for (const p of parseSeed(ssrPayload)) {
      if (!keep(p)) continue
      const line = rowLine(p)
      if (line) rows.push(line)
      if (rows.length >= 8) break
    }
    if (!rows.length) return ''
    const label = CONSUMER_SURFACE_SEO[path]?.crumb || ''
    const head = label ? `<p>${esc(label)}</p>` : ''
    return `<noscript>${head}<ul>${rows.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></noscript>`
  }

  const ref = regionRefOfPath(path)
  if (ref) {
    const rows = regionSeedRows(ssrPayload, ref).slice(0, 8)
    if (!rows.length) return ''
    const label = ref.sigungu ? `${ref.sido} ${ref.sigungu}` : ref.sido
    return `<noscript><p>${esc(label)} 이용권</p><ul>${rows.map(r => `<li>${esc(r)}</li>`).join('')}</ul></noscript>`
  }

  return ''
}

/** 경로 → 지역. 판정·디코딩 규율은 `surface-list-jsonld.ts` 의 `regionRefOf` 와 같다. */
function regionRefOfPath(path: string): RegionRef | null {
  if (!REGION_PATH_RE.test(path)) return null
  const seg = path.replace(/\/+$/, '').split('/')
  try {
    return parseRegionPath(decodeURIComponent(seg[2] || ''), seg[3] ? decodeURIComponent(seg[3]) : undefined)
  } catch {
    return null
  }
}

interface RegionSeedRow {
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
}

/**
 * 🧾 시드 한 행 → 사람이 읽는 한 줄. 네 목록 표면과 지역 페이지가 **같은 모양**을 쓴다.
 *
 * 머리는 `restaurant_name`(이용권·숙소) 또는 `brand_name`(교환권) — 그 카드가 화면에 그리는 것과
 * 같다. 둘 다 없으면 상품명만. 규율 ①(지어내지 않는다)대로 **시드에 있는 값만** 쓴다.
 */
function rowLine(p: RegionSeedRow): string | null {
  const head = (p?.restaurant_name || p?.brand_name || '').trim()
  const title = (p?.name || '').trim()
  if (!head && !title) return null
  // 교환권은 브랜드가 상품명 앞에 그대로 들어가는 경우가 있다(실측: `네이버페이 포인트 —
  // 네이버페이 포인트 500원`). 같은 말을 두 번 하지 않는다.
  const parts = head && title.startsWith(head) ? [title] : [head, title]
  const d = priceDisplay({ price: p?.price, original_price: p?.original_price, discount_rate: p?.discount_rate })
  const price = d.price > 0 ? ` 판매가 ${won(d.price)}원${d.discount > 0 ? ` (${d.discount}% 할인)` : ''}` : ''
  return `${parts.filter(Boolean).join(' — ')}${price}`
}

/** 시드 문자열 → 행 배열. 모양이 다른 시드(배열 / `{products}`)를 둘 다 받는다. */
function parseSeed(ssrPayload: string | null | undefined): RegionSeedRow[] {
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
function regionSeedRows(ssrPayload: string | null | undefined, ref: RegionRef): string[] {
  const out: string[] = []
  for (const p of parseSeed(ssrPayload)) {
    if (p?.deal_only === 1) continue
    if (!addressInRegion(p?.restaurant_address || p?.business_address, ref)) continue
    const line = rowLine(p)
    if (line) out.push(line)
  }
  return out
}
