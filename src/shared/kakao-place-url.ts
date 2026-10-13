/**
 * 🎯 2026-07-01 (대표 예시 — 김밥천국 kko.to 링크): 카카오 장소/지도/공유 링크 검증 (URL 주입 방지).
 *
 * 허용 형식:
 *   - https://place.map.kakao.com/{id}   (장소 상세 페이지 — 검색기가 자동 캡처)
 *   - https://map.kakao.com/...          (지도 링크)
 *   - https://kko.to/{code}              (카카오맵 '공유' 단축링크 — 붙여넣기)
 * 그 외 도메인은 거부 → RestaurantMiniMap 이 임의 URL 로 열리지 않게.
 *
 * ## 🔢 2026-10-13 — 장소 **id** 를 뽑는 것이 이 파일의 두 번째 일이 됐다
 *
 * 매장 엔티티의 `sameAs`(2026-10-12 신설)는 **정본 프로필 주소 하나**를 가리켜야 한다. 그런데
 * 사람이 붙여넣는 모양은 넷이고 그중 셋이 같은 id 를 다른 껍데기에 담고 있다 — 라이브에서
 * 직접 두드려 확인한 것(2026-10-13):
 *
 * ```
 * place.map.kakao.com/10256701        200 · og:title=달빛한스푼        ← 정본
 * map.kakao.com/?itemId=10256701      200 · og:title=달빛한스푼        ← 같은 가게
 * map.kakao.com/link/map/10256701     302 → ?itemId=10256701          ← 같은 id 로 접힌다
 * map.kakao.com/link/to/10256701      302 → …rt2=달빛한스푼           ← 길찾기지만 같은 가게
 * map.kakao.com/?itemId=99999999999   200 · og:title 없음              ← 틀린 id 는 이름을 안 만든다
 * kko.to/{code}                       (이 환경 프록시가 CONNECT 403 — 실측 불가)
 * ```
 *
 * ⇒ **`itemId` 는 `place.map.kakao.com/{id}` 와 같은 id 공간이다**(`link/map` 의 302 가 그 증거).
 * 그래서 그 셋은 id 를 뽑아 정본으로 접고, **`kko.to` 는 URL 안에 id 가 없어 접을 수 없다**
 * (단축링크를 풀려면 네트워크 왕복이 필요하고, 이 환경에서 그 동작을 **검증할 수 없었다**).
 *
 * 🔴 **좌표형 `link/map/{이름},{위도},{경도}` 는 일부러 안 받는다** — 거기엔 장소 id 가 없고,
 * 숫자만 받는 규칙(`\d+`)이 그 모양을 자연히 거른다. **틀린 id 로 접는 것은 `sameAs` 가 없는
 * 것보다 나쁘다**(남의 가게를 우리 상품의 매장이라고 선언하게 된다).
 */

/** `map.kakao.com` 계열에서 장소 id 를 담은 모양 셋 — 전부 라이브 실측으로 같은 id 공간임을 확인했다. */
const ID_PATTERNS: readonly RegExp[] = [
  /^https?:\/\/place\.map\.kakao\.com\/(\d{1,20})(?:[/?#]|$)/,
  /^https?:\/\/map\.kakao\.com\/link\/(?:map|to)\/(\d{1,20})(?:[/?#]|$)/,
]

const KAKAO_PLACE_URL_RE = /^https?:\/\/(place\.map\.kakao\.com\/\d+|map\.kakao\.com\/|kko\.to\/[A-Za-z0-9_-]+)/

export function isValidKakaoPlaceUrl(url: unknown): url is string {
  return typeof url === 'string' && KAKAO_PLACE_URL_RE.test(url.trim())
}

/**
 * 장소 id 만 뽑는다. 뽑을 수 없으면 `null` — `kko.to` 단축링크·좌표형 링크·`map.kakao.com` 루트가
 * 그 경우다(**부재는 결함이 아니라 "이 URL 엔 id 가 없다" 는 사실**이다).
 */
export function kakaoPlaceId(url: unknown): string | null {
  if (!isValidKakaoPlaceUrl(url)) return null
  const s = url.trim()
  for (const re of ID_PATTERNS) {
    const m = re.exec(s)
    if (m) return m[1]
  }
  // `map.kakao.com/?itemId=N` — 쿼리는 순서가 자유로워 정규식 대신 파서로 읽는다.
  try {
    const u = new URL(s)
    if (u.hostname === 'map.kakao.com') {
      const id = u.searchParams.get('itemId')
      if (id && /^\d{1,20}$/.test(id)) return id
    }
  } catch { /* 파싱 실패는 id 없음과 같다 */ }
  return null
}

/** 장소 id 가 있으면 **정본 프로필 주소**(https)로. 없으면 null. */
export function kakaoPlaceCanonicalUrl(url: unknown): string | null {
  const id = kakaoPlaceId(url)
  return id ? `https://place.map.kakao.com/${id}` : null
}

/**
 * 검증 후 https 정규화. 유효하지 않으면 null.
 * 🔢 장소 id 를 뽑을 수 있으면 **정본 프로필 주소로 접어서** 돌려준다 — 저장·표시·구조화 데이터가
 * 한 모양을 쓰게 된다(미니맵이 여는 주소도 정본이 더 낫다). id 가 없으면 종전처럼 그대로 통과.
 */
export function normalizeKakaoPlaceUrl(url: unknown): string | null {
  if (!isValidKakaoPlaceUrl(url)) return null
  return kakaoPlaceCanonicalUrl(url) ?? url.trim().replace(/^http:/, 'https:')
}
