/**
 * 🔤 인플루언서 **핸들 규칙 SSOT** — 순수 함수만(의존 0, 순환 import 불가).
 *
 *   `influencer-handle-heal.ts`(저장된 손상 행 복구)에서 규칙 부분만 떼어 왔다. 이유는 방향이다:
 *   복구는 *사후*고, 이 규칙은 **저장 직전**(`influencer-save.ts`)에도 걸려야 하는데,
 *   heal 모듈은 `influencer-discovery` 를 import 하므로 저장 경로에서 부르면 순환이 된다.
 *
 *   ## 왜 저장 시점 검증이 필요한가 (2026-07-29 — 코드로 재현)
 *   2026-07-28 에 손상 핸들 12,357건(블로거의 44%)을 복구했다(#822). 그때 원인은
 *   "이미 고쳐진 파서"로 정리됐는데, **생성 경로는 아직 열려 있었다.** 현재 코드로 재현되는 것들:
 *
 *     카페 파서에 블로그 URL → handle = 'blog.naver.com'   ← 그때 그 손상과 **같은 문자열**
 *     카페 파서에 외부 URL   → handle = 'someblog.tistory.com'  (호스트가 핸들 자리에)
 *     블로그 파서에 외부/무id → handle = 'https:'
 *
 *   네이버 블로그 검색은 외부 블로그(티스토리 등)도 돌려주고 카페 검색도 blog.naver.com 링크를
 *   섞어 준다 — 드문 일이 아니다. 그래서 파서를 표면마다 고치는 대신 **모든 리드가 지나는
 *   한 지점**(저장)에서 막는다. 새 플랫폼이 추가돼도 자동으로 같은 규칙을 받는다.
 *
 *   ⚠️ 못 살리면 `null` 이다 — 추측해서 채우지 않는다. handle 은 보조 필드이고 정체성 키는
 *   `channel_id` 라, null 이어도 리드는 온전히 저장된다(보강 레인이 나중에 복구할 수도 있다).
 */

/** 네이버 블로그 id 형식 — RSS/모바일홈 fetch 가 받아들이는 문자셋(보강 레인과 **같은 규칙**이어야 한다). */
export const NAVER_HANDLE_RE = /^[A-Za-z0-9_-]{2,40}$/

/** 정규 URL — 어드민 링크·중복 판정(channel_id)이 같은 표기를 쓰도록 한 곳에서 만든다. */
export const naverBlogUrl = (handle: string): string => `https://blog.naver.com/${handle}`

export interface HandleSource { handle?: string | null; channel_id?: string | null; url?: string | null }

/**
 * 저장된 행에서 **진짜 블로그 id** 를 뽑는다 — 순수 함수(유닛테스트로 고정).
 *   우선순위: 이미 정상인 handle → channel_id → url. 어디서도 못 뽑으면 null(= 복구 불가, 건드리지 않음).
 *   스킴 유무·`m.` 서브도메인·`?blogId=` 형태(검색이 가끔 포스트 링크를 준다)를 모두 흡수한다.
 */
export function deriveNaverHandle(row: HandleSource): string | null {
  const stored = String(row.handle || '').trim()
  if (NAVER_HANDLE_RE.test(stored)) return stored // 정상 — 그대로(불필요한 write 0)
  for (const raw of [row.channel_id, row.url]) {
    const s = String(raw || '').trim()
    if (!s) continue
    // ① 경로형: [https://][m.]blog.naver.com/<id> — 스킴이 없어도 문자열 시작에서 매칭.
    const path = /(?:^|\/\/)(?:m\.)?blog\.naver\.com\/([^/?#\s]+)/i.exec(s)?.[1]
    if (path && NAVER_HANDLE_RE.test(path)) return path
    // ② 쿼리형: .../PostView.naver?blogId=<id> — 포스트 링크에서도 블로거를 특정할 수 있다.
    const qs = /[?&]blogId=([^&#\s]+)/i.exec(s)?.[1]
    if (qs && NAVER_HANDLE_RE.test(qs)) return qs
  }
  return null
}

/** 카페 id — `cafe.naver.com/<id>` 만 인정(스킴/`m.` 무관). 그 외 호스트면 null. */
export function deriveNaverCafeHandle(row: HandleSource): string | null {
  const stored = String(row.handle || '').trim()
  if (NAVER_HANDLE_RE.test(stored)) return stored
  for (const raw of [row.channel_id, row.url]) {
    const s = String(raw || '').trim()
    if (!s) continue
    const path = /(?:^|\/\/)(?:m\.)?cafe\.naver\.com\/([^/?#\s]+)/i.exec(s)?.[1]
    if (path && NAVER_HANDLE_RE.test(path)) return path
  }
  return null
}

/**
 * 명백한 손상인가 — 호스트·스킴 조각이 핸들 자리에 들어온 경우.
 *   ⚠️ 일부러 좁게 잡는다. 유튜브 @핸들은 마침표를 허용하므로(`@foo.bar`) "점이 있으면 호스트"로
 *   보면 정상 핸들을 지운다. `/`·`:` 포함, 또는 흔한 TLD 로 끝나는 도메인 꼴만 손상으로 본다.
 */
export function looksLikeHostOrScheme(handle: string): boolean {
  const h = handle.trim()
  if (!h) return false
  if (h.includes('/') || h.includes(':')) return true // 'https:' · 'blog.naver.com/zq333'
  return /^(?:www\.)?[\w-]+(?:\.[\w-]+)+\.?$/i.test(h) && /\.(com|net|org|kr|co|io|me|tv|blog|shop|xyz)\.?$/i.test(h)
}

/**
 * 🚧 저장 직전 정규화 — 플랫폼별 규칙으로 살릴 수 있으면 살리고, 손상이면 null.
 *   네이버는 채널 URL 에서 id 를 되살리고(파서가 놓쳐도 여기서 복구), 그 외 플랫폼은 손상만 걸러낸다.
 */
export function sanitizeLeadHandle(platform: string, row: HandleSource): string | null {
  if (platform === 'naver_blog') return deriveNaverHandle(row)
  if (platform === 'naver_cafe') return deriveNaverCafeHandle(row)
  const h = String(row.handle || '').trim()
  if (!h) return null
  return looksLikeHostOrScheme(h) ? null : h
}
