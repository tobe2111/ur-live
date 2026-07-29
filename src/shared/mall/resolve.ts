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
