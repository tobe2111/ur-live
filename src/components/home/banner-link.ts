import { isSafeInternalPath } from '@/utils/safe-internal-path'

/**
 * 🔗 배너 링크 해석 (2026-10-13 대표 *"각 배너마다 해당되는 페이지로 이동이 되어야지"*).
 *
 * 🩸 **무엇이 틀렸나**: 어드민은 링크를 **절대주소**로만 받는다(`https://urdeal.kr/region/서울` —
 *   상대 경로는 서버가 거절한다). 그런데 화면은 그 값을 `safeInternalPath` 에 바로 넣었고, 그 함수는
 *   `/` 로 시작하지 않는 값을 **외부 URL 로 보고 빈 값**을 돌려준다 ⇒ 라이브 배너 다섯 장 전부
 *   `<Link>` 가 아니라 `<div>` 로 그려져 **눌러도 아무 데도 안 갔다.** 에러는 0 이다.
 *
 * ⇒ 우리 도메인이면(또는 `/` 로 시작하는 상대 경로) 경로만 떼어 앱 안에서 이동(새로고침 없음), 남의 https 면 새 탭,
 *   그 밖(`javascript:` 등)은 링크 없음.
 */
// legacy-domain-ok — 구 도메인 링크도 앱 안 이동으로(이전을 구현하는 쪽이다)
export const OWN_HOSTS = ['urdeal.kr', 'www.urdeal.kr', 'live.ur-team.com'] as const // legacy-domain-ok

export type BannerLink =
  | { kind: 'internal'; to: string }
  | { kind: 'external'; href: string }
  | null

export function resolveBannerLink(raw: string | null | undefined, currentHost?: string): BannerLink {
  const v = (raw || '').trim()
  if (!v) return null
  let u: URL
  const relative = v.startsWith('/') && !v.startsWith('//')
  // 스킴은 http(s) 만(`javascript:`·`data:` 차단). `//host/…` 는 상대 경로처럼 보이지만 **남의 호스트**다.
  if (!relative && !/^https?:\/\//i.test(v)) return null
  try { u = new URL(v, 'https://urdeal.kr') } catch { return null }
  if (relative) return internal(u)
  const host = u.hostname.toLowerCase()
  const own = (OWN_HOSTS as readonly string[]).includes(host) || (!!currentHost && host === currentHost.toLowerCase())
  if (own) return internal(u)
  if (u.protocol !== 'https:') return null
  return { kind: 'external', href: u.toString() }
}

/**
 * 경로는 `isSafeInternalPath` 로 막고(로그인·콜백 자기참조 · 역슬래시 · 제어문자),
 * **쿼리는 남긴다** — 배너는 `/?category=meal_voucher` 같은 필터 주소를 가리킬 수 있다
 * (`safeInternalPath` 는 OAuth 규칙이라 쿼리를 지운다 — 그걸 쓰면 필터가 조용히 사라진다).
 */
function internal(u: URL): BannerLink {
  let path = u.pathname
  try { path = decodeURIComponent(path) } catch { /* 그대로 */ }
  if (!isSafeInternalPath(path)) return null
  return { kind: 'internal', to: path + u.search + u.hash }
}
