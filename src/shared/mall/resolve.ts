/**
 * 🏬 몰 컨텍스트 해석 규칙 (순수) — 세션 ③-a 〔대표 확정 2026-07-29 A안 + 경계조건 ①〕
 *
 * P0 는 **경로 기반**(`urdeal.kr/{슬러그}`)이다. 기존 `resolveMallId` 는 **호스트 우선**이라
 * 경로를 아예 모른다 — 그 축을 여기서 정의하고, 도매 리졸버는 이 함수를 호출만 한다.
 *
 * ## 🔴 경계조건 — 경로가 호스트를 이기면 **하이재킹**이 된다 〔대표 지시〕
 *
 * 순진하게 `?mall → path → host → 1` 로 짜면, 나중에 커스텀 도메인이 붙은 **A몰**에서 URL 경로에
 * 우연히 **B몰 슬러그와 같은 조각**이 들어갈 때 경로가 호스트를 이겨 **B몰 컨텍스트로 넘어간다.**
 *
 * ⇒ 규칙을 좁힌다: **호스트가 몰에 매핑되면 호스트가 단독 결정.** 경로 해석은 **정본 호스트에서만.**
 *
 * > 지금은 커스텀 도메인 몰이 0개라 차이가 안 난다. **그래서 지금 박는다** — 이 레포가 오늘 종일 만난
 * > *"몰이 하나일 땐 안 터지는"* 클래스와 정확히 같고, 첫 커스텀 도메인이 붙는 날 잠복 버그가 된다.
 *
 * ## flip-flop 재발 우려는 없다
 * 2026-06-18 사고는 **계정 우선**이라 같은 URL 이 로그인 여부로 다르게 해석된 것이다.
 * 경로는 URL 에 박혀 있어 **결정적**이다 — 게스트/로그인이 같은 값을 본다.
 */
import { RESERVED_SLUGS } from './slug'

/** 예약어 조회는 O(1) 로. `slug.ts` 는 이 파일을 import 하지 않는다(순환 없음). */
const RESERVED_SLUG_SET = new Set(RESERVED_SLUGS)

/** 경로 기반 몰 해석을 허용하는 정본 호스트. 여기 없는 호스트에선 경로를 보지 않는다. */
export const CANONICAL_HOSTS: readonly string[] = [
  'urdeal.kr',
  'www.urdeal.kr',
  // 구 도메인은 전 경로 301 이지만 `/api/*` 는 301 제외라 **아직 도달한다**(CLAUDE.md).
  //   여기서 빼면 이전 기간 동안 두 호스트의 몰 해석이 갈린다 — 그 비대칭이 더 위험하다.
  //   표시 문자열이 아니라 **호스트 집합**이라 가드가 명시한 예외에 해당한다.
  'live.ur-team.com', // legacy-domain-ok
  'ur-live.pages.dev',
  'localhost',
  '127.0.0.1',
]

export type MallSource = 'query' | 'host' | 'path' | 'default'

export interface MallResolveInput {
  /** `?mall=<slug>` 가 **실재하는 몰**로 확인됐는가(존재하지 않는 slug 는 false). */
  queryMallFound: boolean
  /** 호스트가 **명시적으로** 몰에 매핑됐는가(기본 몰 폴백은 false). */
  hostMapped: boolean
  /** 요청 호스트(정규화 전 원본도 허용 — 내부에서 소문자/포트 제거). */
  host: string | null | undefined
  /** 경로 1st 세그먼트가 **실재하는 몰 슬러그**로 확인됐는가. */
  pathSlugFound: boolean
}

export function isCanonicalHost(host: string | null | undefined): boolean {
  const h = String(host ?? '').toLowerCase().trim().split(':')[0]
  if (!h) return false
  // pages.dev 프리뷰(<hash>.ur-live.pages.dev)도 정본으로 본다 — 커스텀 도메인 몰이 아니다.
  if (h.endsWith('.ur-live.pages.dev')) return true
  return CANONICAL_HOSTS.includes(h)
}

/**
 * 무엇이 몰을 결정하는가.
 *
 * 우선순위: `?mall`(기존 dev 오버라이드, **의미 불변**) → **host 매핑** → **path(정본 호스트만)** → 기본 1.
 *
 * ⚠️ `?mall` 이 host 보다 앞서는 것은 **기존 동작**이라 그대로 둔다(이번 변경이 만든 것이 아니다).
 *   신규로 추가되는 것은 **path 축뿐**이고, 그 축만 위 경계조건에 묶인다.
 */
export function decideMallSource(i: MallResolveInput): MallSource {
  if (i.queryMallFound) return 'query'
  // 🔴 호스트가 몰에 매핑되면 호스트가 **단독 결정** — 경로를 보지 않는다(하이재킹 차단).
  if (i.hostMapped) return 'host'
  if (i.pathSlugFound && isCanonicalHost(i.host)) return 'path'
  return 'default'
}

/**
 * 이 세그먼트가 **몰 슬러그일 수 있는가** — 예약어(=실제 라우트)·문법 밖이면 false.
 *
 * 🔴 순서 주의: 예약어 검사가 **먼저**다. 그래야 실제 소비자 라우트가 이 판정에 한 번도 안 걸린다.
 *
 * 이것이 **유일한 정의**다. 워커(`worker/utils/mall-consumer.ts` `isMallLookupCandidate`)도
 * 클라(`App.tsx` 몰 표면 판정)도 여기를 호출한다 — 같은 규칙을 두 벌 쓰면 **반드시 갈라지고**,
 * 갈라진 순간 "워커는 몰로 보는데 클라는 아닌" 경로가 생겨 유어딜 탭바가 몰 위에 뜬다.
 */
export function isMallSlugCandidate(seg: string | null | undefined): boolean {
  const s = String(seg ?? '').trim().toLowerCase()
  if (!s) return false
  if (RESERVED_SLUG_SET.has(s)) return false
  return /^[a-z0-9-]{3,30}$/.test(s)
}

/**
 * 몰 상품 상세 경로의 **고정 중간 세그먼트**. `/{슬러그}/p/{상품id}`.
 *
 * 🔴 왜 `/{슬러그}/{id}` (2세그먼트)가 아닌가: 그러면 몰 표면이 **2세그먼트 전부**를 삼켜
 *   나중에 `/{슬러그}/reviews` 같은 걸 추가할 때 판정이 또 흔들린다. 리터럴 하나를 끼워
 *   **정확히 이 모양만** 몰 표면으로 넓힌다 — `/{슬러그}/anything` 은 계속 false 다.
 */
export const MALL_PRODUCT_SEGMENT = 'p'

/** 몰 상품 상세 URL 을 만든다. 링크를 손으로 조립하지 말 것 — 여기가 유일한 조립처다. */
export function mallProductPath(slug: string, productId: number | string): string {
  return `/${String(slug).trim().toLowerCase()}/${MALL_PRODUCT_SEGMENT}/${Number(productId)}`
}

/**
 * 경로가 몰 상품 상세면 `{ slug, productId }`, 아니면 null. (문법 판정 — 실재는 호출부가 DB 로 본다.)
 */
export function parseMallProductPath(
  pathname: string | null | undefined,
): { slug: string; productId: number } | null {
  const path = String(pathname ?? '').split('?')[0].split('#')[0]
  const segs = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/')
  if (segs.length !== 3) return null
  if (segs[1] !== MALL_PRODUCT_SEGMENT) return null
  if (!isMallSlugCandidate(segs[0])) return null
  // 상품 id 는 양의 정수만. `/{슬러그}/p/abc` 는 몰 표면이 아니다(오타로 크롬이 사라지지 않게).
  if (!/^[1-9][0-9]{0,11}$/.test(segs[2])) return null
  return { slug: segs[0].toLowerCase(), productId: Number(segs[2]) }
}

/**
 * 이 **경로**가 몰 표면인가 — 몰 홈(`/{슬러그}`) 또는 몰 상품 상세(`/{슬러그}/p/{id}`).
 *
 * ⚠️ **문법 판정이지 존재 판정이 아니다.** 실재하지 않는 슬러그(`/ossda`)도 true 다 —
 *   그 경로는 `MallHomePage` 가 스스로 404 를 그린다. 즉 이 함수가 true 인데 몰이 아니면
 *   **404 화면에서 유어딜 탭바가 사라진다.** 그 대가를 알고 택했다:
 *   ① 진짜 몰 손님(파일럿의 전부)에게 탭바가 **한 프레임도** 안 뜨는 쪽이 중요하다
 *      — 나중에 숨기면 깜빡이고, 깜빡이는 순간 손님은 유어딜을 본다.
 *   ② `NotFoundPage` 는 자체 '홈으로'·인기 링크·뒤로가기를 갖고 있어 오타 방문자도 안 갇힌다.
 *
 * 🔴 **2026-08-11 — 상품 상세를 몰 표면에 포함하도록 넓혔다** 〔대표 지시 "그 서비스는 유어딜과
 *   철저히 분리되어야 해"〕. 그전까지 이 함수는 **1세그먼트만** true 라, 몰 손님이 상품을 누르는
 *   순간 본진 `/products/:id` 로 나가 **유어딜 탭바·브랜드·상시가**를 봤다(몰 카드는 공구가였다).
 *   즉 분리가 걸려 있던 건 몰 홈 한 장뿐이었다.
 *   ⚠️ 넓힌 것은 **`/{슬러그}/p/{숫자}` 정확히 이 모양뿐**이다 — `/products/123`(예약어)도,
 *   `/{슬러그}/anything` 도 계속 false. 그 두 개는 테스트가 값으로 고정한다.
 */
export function isMallSurfacePath(pathname: string | null | undefined): boolean {
  const path = String(pathname ?? '').split('?')[0].split('#')[0]
  const segs = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/')
  if (segs.length === 1) return isMallSlugCandidate(segs[0])
  return parseMallProductPath(pathname) != null
}

/** URL 경로의 1st 세그먼트(소문자). 몰 슬러그 후보로만 쓰고, 실재 여부는 호출부가 DB 로 확인한다. */
export function firstPathSegment(url: string): string | null {
  let p: string
  try { p = new URL(url).pathname } catch { p = String(url || '') }
  const seg = p.replace(/^\/+/, '').split('/')[0] ?? ''
  const s = seg.toLowerCase().trim()
  if (!s) return null
  // 슬러그 문법(소문자·숫자·하이픈)이 아니면 애초에 몰일 수 없다 — DB 조회를 아낀다.
  if (!/^[a-z0-9-]{3,30}$/.test(s)) return null
  return s
}

/** 본진(기본 몰) id. 몰이 정해지지 않은 모든 것이 여기로 간다. */
export const MAIN_MALL = 1

/**
 * 이 상품이 **운영자 몰 상품인가** (= 본진이 아닌가).
 *
 * 🔴 **모르면 본진으로 본다.** `null`/`undefined`/파싱불가는 전부 false —
 *   `products.mall_id` 는 `DEFAULT 1` 이고, 컬럼이 없는 env 엔 경로로 열리는 몰 자체가 없다
 *   (`consumer_path` fail-closed). ⇒ 신호가 없을 때의 동작이 **현행과 정확히 같다.**
 */
export function isMallProduct(mallId: number | null | undefined): boolean {
  const n = Number(mallId)
  return Number.isFinite(n) && Math.floor(n) !== MAIN_MALL && Math.floor(n) >= 1
}

/**
 * 🏬 **상품이 꽂힐 몰** — 운영자(셀러)의 몰을 그대로 따른다 (세션 ③-b, O4).
 *
 * `products.mall_id` 는 `DEFAULT 1`(본진)이라 **스탬프하지 않으면 운영자 상품이 전부 본진으로 간다.**
 * 그러면 등록은 성공하고 셀러 목록에도 보이는데 **소비자 몰 화면만 비어 있다** — 조용한 실패다.
 *
 * 🔴 **값의 출처는 서버가 읽은 `sellers.mall_id` 하나뿐이다.** 요청 body 로 받으면
 *   셀러가 **남의 몰에 상품을 꽂을 수 있다**(권한 상승). 그래서 인자가 하나다.
 *
 * 몰이 없는 셀러(기존 본진 셀러 — `mall_id` NULL)는 본진으로. 그게 맞는 자리다.
 */
export function mallIdForSeller(sellerMallId: number | null | undefined): number {
  const n = Number(sellerMallId)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : MAIN_MALL
}
