/**
 * 🎬 2026-10-13 — `/urshorts` **크롤러 본문** (대표 "너가 할 수 있는 건 최대한 이상적으로 다 해줘").
 *
 * ## 왜
 *
 * 라이브 실측(Googlebot UA): `/urshorts` 는 `index, follow` 인데 서버 문서의 **본문이 6자**였다
 * (로더 워드마크뿐). 색인해 달라고 선언해 놓고 읽을 것을 한 줄도 안 주고 있었다.
 *
 * ## 시드가 공짜다
 *
 * `/api/urshorts` 는 `cache-prewarm` 의 `HOT_PATHS` 에 **이미 있는 키**다. 그 키를 그대로 쓰면
 * **새 캐시 키도 새 왕복도 0** 이다(`/stays` 가 MAIN 시드를 재사용한 그 수법 — 2026-10-12).
 *
 * ## 🔴 `VideoObject` 를 내지 않는다
 *
 * 이 영상들은 **남의 유튜브 영상**이다. 실측 채널: 부산일보TV · 해피푸게더 · 슬아투니 ·
 * 부산이야 · 파인예플 · 재슐랭가이드. 우리가 업로더가 아닌 영상에 `VideoObject` 를 발행하면
 * 원 채널의 리치결과와 경쟁하면서 **우리가 그 영상의 출처**라고 말하는 셈이다 — 이 레포가
 * `sameAs`·`aggregateRating`·`brand` 에서 지키는 **지어내지 않는다** 와 같은 축이다.
 *
 * 같은 이유로 각 줄에 **채널명을 반드시 함께** 쓴다(출처 표기). 그 표기를 빼면 남의 콘텐츠를
 * 우리 것처럼 말하는 글이 된다.
 *
 * ⚠️ 우리가 직접 올린 영상이 생기면 **그 건에만** 낼 것(그때는 업로더가 우리다).
 *
 * ## 🔒 주입하지 않는다
 *
 * 화면(`UrShortsBrowsePage`)은 `/api/urshorts?all=1`(**전량**)을 받고 이 시드는 **10편**이다.
 * `initialData` 로 먹이면 사용자가 보던 목록이 **도로 짧아진다**(2026-10-12 지역 요약에서 값을
 * 치른 규율 — 크롤러 본문용 payload 와 주입용 payload 를 변수로 가른다). 그래서 워커가
 * `ssrPayload = null` 로 끊고 이 함수에만 넘긴다.
 *
 * ## 🔗 2026-10-14 — 딜이 붙은 행만 **그 딜로 링크**한다
 *
 * 실측: `/urshorts` 는 `index, follow` 인데 **내부 링크가 0개**였다 — 다른 목록 표면은 전부
 * 항목을 링크하는데(2026-10-12 "허브 → 상세 길이 없다" 처방) `/urshorts` 만 빠져 있었다.
 * 이 모듈이 그 처방 **다음날** 쓰여서 규칙이 여기까지 오지 않았다(결정이 아니라 **누락**이다).
 *
 * 🔑 주소는 **정본 SSOT**(`canonicalDetailPath`) 하나에서 — sitemap·`ItemList`·다른 목록과 같은
 *    함수다. 손으로 `/pass/${id}` 를 적으면 갈린다.
 *
 * 🔴 **`/products/:id` 폴백을 쓰지 않는다**(다른 목록은 쓴다). 이 API 행은 `deal_only` 를 **안
 *    싣는다** ⇒ 교환권인지 순수 쇼핑인지 구분할 수 없고, 교환권을 링크하면 *2026-07-07 결정으로
 *    noindex 인 URL* 로 크롤 예산이 빠진다. 그래서 `canonicalDetailPath` 가 **경로를 주는 행만**
 *    링크한다. 그 게이트는 구조적으로 안전하다(실측): `deal_only=1` 상품의 카테고리는 전부
 *    한글 표시명(`외식`·`피자`·`치킨`·`커피/음료` …)이고 `VOUCHER_CATEGORIES` 는 영문 슬러그
 *    넷(`meal/beauty/stay/etc_voucher`)뿐이며 `LEGACY_CATEGORY_MAP` 에도 한글 항목이 없다
 *    ⇒ 교환권은 `isVoucherCategory` 를 통과하지 못한다.
 *    ⚠️ 그 전제가 바뀌면(한글 카테고리가 매핑에 들어오면) 이 게이트가 샌다 — 시험이 고정한다.
 *
 * 🖼️ **그림은 넣지 않는다** — `thumb_url` 은 **남의 유튜브 썸네일**이라 우리 문서에 `<img>` 로
 *    박으면 위 "지어내지 않는다" 와 같은 선을 넘는다(`product_image` 를 쓰는 것은 별건이다).
 *
 * ## ⚠️ 이 모듈이 못 하는 것
 *
 * - `<noscript>` 라 JS 가 돌면 렌더조차 안 된다 ⇒ 사람 화면 **byte-동일 · 밀림 0**(그게 의도다)
 * - 구글·네이버가 이 글을 실제로 색인하는지 — 색인 수일~수주, 판정은 서치콘솔에서 **대표만** 본다
 */
import { esc, h1Of } from './crawler-noscript'
import { SURFACE_LIST_MAX } from './surface-list-jsonld'
import { canonicalDetailPath } from '../../shared/product-flow'
import { priceDisplay } from '../../shared/price-display'
import { won } from './crawler-noscript-rows'

/** 라이브 `/api/urshorts` 응답 한 행에서 **쓰는 필드만**. 나머지는 의도적으로 안 읽는다. */
interface UrshortsRow {
  title?: unknown
  /** 출처 채널 — 남의 영상이라 **반드시** 함께 쓴다. */
  channel?: unknown
  store_name?: unknown
  region_si?: unknown
  /** 아래부터는 **딜이 붙은 행만** 갖는다(대부분 null) — 링크와 가격의 재료. */
  product_id?: unknown
  product_name?: unknown
  category?: unknown
  price?: unknown
  original_price?: unknown
  discount_rate?: unknown
}

/**
 * @param ssrPayload `/api/urshorts` 응답(`{ success, data: [] }`). 없거나 깨지면 `''`.
 * @param h1 호출부가 만든 `<h1>` — 라벨은 `CONSUMER_SURFACE_SEO[...].crumb` 한 곳에서 온다
 *           (빵부스러기와 **같은 SSOT**. 손으로 적으면 둘이 갈린다).
 */
export function buildUrshortsNoscript(ssrPayload: string | null | undefined, h1: string): string {
  try {
    const raw = (JSON.parse(ssrPayload || 'null') as { data?: unknown } | null)?.data
    const rows: UrshortsRow[] = Array.isArray(raw) ? (raw as UrshortsRow[]) : []
    const lines = rows.slice(0, SURFACE_LIST_MAX).map((v) => {
      // 제목이 없는 행은 거른다 — 빈 `<li>` 는 글자수만 늘리고 읽을 것을 안 준다.
      const head = String(v.title ?? '').trim()
      if (!head) return ''
      const by = String(v.channel ?? '').trim()
      const where = [v.store_name, v.region_si].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ')
      const line = `${esc(head)}${by ? ` (${esc(by)})` : ''}${where ? ` · ${esc(where)}` : ''}`
      // 🔗 딜이 붙은 행만 — **정본 경로가 있을 때만** 링크한다(위 머리말의 게이트).
      //    링크 글자는 **그 딜**(이름 + 판매가)이다 — 목적지를 설명하지 않는 anchor 는 미끼다.
      const pid = v.product_id
      const href = pid == null || pid === '' ? null
        : canonicalDetailPath({ id: pid as string | number, category: (String(v.category ?? '') || null) })
      // 숫자는 **여기서** 좁힌다 — 이 파일의 규약대로 행 필드는 `unknown` 이고 읽는 쪽이 변환한다.
      const n = (x: unknown) => Number(x) || 0
      const d = priceDisplay({ price: n(v.price), original_price: n(v.original_price), discount_rate: n(v.discount_rate) })
      const dealName = String(v.product_name ?? '').trim()
      const deal = href && dealName && d.price > 0
        ? ` · <a href="${esc(href)}">${esc(dealName)} 판매가 ${won(d.price)}원${d.discount > 0 ? ` (${d.discount}% 할인)` : ''}</a>`
        : ''
      return `<li>${line}${deal}</li>`
    }).filter(Boolean)
    // 시드가 없거나 쓸 행이 0 이면 **아무것도 내지 않는다**(지어내지 않는다 — 호출부가 종전 로더로 폴백).
    return lines.length
      ? `<noscript>${h1}<ul>${lines.join('')}</ul></noscript>`
      : ''
  } catch {
    return ''
  }
}
