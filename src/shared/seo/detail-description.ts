/**
 * 📝 상세 표면의 **`meta description` SSOT** (2026-10-15 신설)
 *
 * ## 왜 — 제목과 **똑같은 두 벌 결함**이다
 *
 * 2026-10-14 에 `detail-title.ts` 를 만든 이유가 *"서버와 클라가 다른 제목을 낸다"* 였는데,
 * 같은 파일의 **설명**은 그 정리에서 빠졌다. 라이브 실측(2026-10-15):
 * ```
 * 서버(Yeti·카톡)  서울 서초구 · 달빛한스푼 닭도리탕 31,000원 (정가 35,000원) 11% 할인 …
 * 클라(Googlebot)  🎉 11% 할인! 달빛한스푼 달빛한스푼 닭도리탕 이용권, 1명 함께 구매 중, 31,000원
 * ```
 * `react-helmet` 이 `<meta name=description>` 을 덮으므로 **JS 를 렌더하는 Googlebot 은
 * 아래쪽**을, 서버 HTML 만 읽는 Yeti·AI 검색봇은 위쪽을 받는다. 한 URL 이 두 설명을 낸다.
 *
 * ### 클라 쪽이 나쁜 이유 셋 (전부 실측)
 * 1. **`N명 함께 구매 중` 이 활성 359건 중 357건에서 `0명`** 이다. 검색 스니펫이 *"아무도 안 산
 *    물건"* 이라고 말한다. 게다가 그 기제는 **존재하지 않는다** — 2026-05-30 대표 확정으로
 *    경제가 즉시판매 단일가(인원 무관)이고 2026-09-04 확정이 *"마감 개념은 없어"* 다.
 *    `/pass` 제목에서 `공동구매` 를 뺀 것과 **같은 사실**이고, 설명만 남아 있었다.
 * 2. **가게 이름을 두 번 말한다** — `달빛한스푼 달빛한스푼 닭도리탕`. 이 레포엔 그 규칙의
 *    SSOT(`store-name-dedupe`)가 있고 서버는 쓰는데 클라만 밖이었다.
 * 3. **별점·지역·정가가 없다.** 서버는 `⭐4.6 강원 양양군 · … (정가 272,000원) 23% 할인` 을
 *    내는데 클라는 그 셋을 통째로 버린다. 지역은 로컬 질의의 핵심이다.
 *
 * ⇒ **서버가 내던 문장을 그대로** 이 파일로 옮기고 양쪽이 같은 함수를 부른다.
 *    서버 출력은 **byte-불변**이고(310건 그대로) 바뀌는 것은 *클라가 이제 같은 값을 낸다*뿐이다.
 *
 * ## 규율
 * - **지어내지 않는다** — 전부 상세 시드에 이미 온 값이다(별점·주소·정가·할인율·소개).
 *   하나라도 없으면 그 조각만 빠지고 나머지는 종전과 같다.
 * - **리뷰 0이면 별점을 말하지 않는다**(평점 0점짜리로 읽힌다 — `ratingLine` 과 같은 규율).
 * - **할인율은 `priceDisplay` 하나** — `current_discount_pct` 는 라이브에서 **전부 0** 이라
 *   그 값을 믿으면 할인이 사라진다(2026-10-14 에 서버에서 치른 그 사고).
 * - **줄표(`—`)를 쓰지 않는다** — anti-slop 규칙이고, 이 파일은 그 가드 범위 안이다.
 */
import { priceDisplay } from '../price-display'
import { storeNameJoin } from './store-name-dedupe'
import { parseRegionFromAddress } from '../constants/region-slugs'
// ⚡ 2026-10-17 숫자는 formatNumber 로 — 상세 첫 렌더에서 이 함수가 Intl 로캘 데이터를 처음 적재해
//   64ms(라이브 실측, CPU 4배)를 혼자 썼다. 정수 빠른 길이 같은 문자열을 낸다(format.ts 머리말·테스트가 Intl 과 대조).
import { formatNumber } from '../../utils/format'

/**
 * 이용권 설명이 읽는 시드 필드. 서버 `DetailData` 와 클라 `GroupBuyDetail` **둘 다** 이 모양을
 * 만족한다(실측: `/api/group-buy/products/:id` 가 아홉 필드를 전부 보낸다).
 */
export interface PassDescriptionInput {
  name?: unknown
  description?: unknown
  price?: unknown
  original_price?: unknown
  current_discount_pct?: unknown
  restaurant_name?: unknown
  restaurant_address?: unknown
  avg_rating?: unknown
  review_count?: unknown
}

/**
 * 이용권 상세(`/pass/:id`) 설명. 서버·클라가 **같은 값**을 낸다.
 *
 * 📏 `slice(0, 200)` 은 종전 그대로. 구글은 ~155자에서 자르지만 자르는 쪽이 모자란 쪽보다 낫다.
 */
export function passDetailDescription(d: PassDescriptionInput): string {
  const name = String(d.name ?? '').trim()
  const store = String(d.restaurant_name ?? '').trim()
  const price = Number(d.price) || 0
  const priceStr = formatNumber(price)
  const storeName = storeNameJoin(store, name)
  const pd = priceDisplay({ price, original_price: Number(d.original_price) || 0, discount_rate: Number(d.current_discount_pct) || 0 })
  const rating = Number(d.avg_rating) || 0
  const reviews = Number(d.review_count) || 0
  const ratingPrefix = rating > 0 && reviews > 0 ? `⭐${rating.toFixed(1)} ` : ''
  const ref = parseRegionFromAddress(String(d.restaurant_address ?? ''))
  const regionStr = ref ? `${ref.sido}${ref.sigungu ? ` ${ref.sigungu}` : ''} · ` : ''
  const origStr = pd.showOriginal && pd.originalPrice > pd.price ? ` (정가 ${formatNumber(pd.originalPrice)}원)` : ''
  // 🔴 소개가 상품명·가게명과 같으면 버린다(같은 말을 두 번 하지 않는다 — 시드 실측상 흔하다).
  const intro = String(d.description ?? '').replace(/\s+/g, ' ').trim()
  const tail = intro && intro !== name && intro !== storeName ? ` ${intro}` : ''
  return (pd.discount > 0
    ? `${ratingPrefix}${regionStr}${storeName} ${priceStr}원${origStr} ${pd.discount}% 할인${tail}`
    : `${ratingPrefix}${regionStr}${storeName} ${priceStr}원, 유어딜에서 할인가로 바로 구매${tail}`)
    .replace(/\s+/g, ' ').trim().slice(0, 200)
}
