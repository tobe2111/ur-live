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
