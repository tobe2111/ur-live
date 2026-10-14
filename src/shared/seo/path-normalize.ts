/**
 * 🔗 문서 경로 정규화 — **같은 내용의 다른 철자를 301 로 합친다** (2026-10-14).
 *
 * ## 무엇이 결함이었나 (라이브 실측, Googlebot UA)
 *
 *     /faq/index.html    200 · canonical 자기자신 · 제목이 **제네릭 홈**
 *     /blog/             200 · canonical `/blog/`  · 제목이 **제네릭 홈**
 *     /products/2917/    200 · canonical `/products/2917/`
 *
 * canonical 을 `pathname` 그대로 찍는 자리 + 표면 표·블로그 빌더가 **정확 일치**로만 매칭되는 탓에
 * 변형이 봇 셸의 self-canonical 로 떨어진다. 같은 페이지가 두세 URL 로 색인 경쟁한다.
 *
 * ## 🔴 404 가 아니라 301 인 이유
 *
 * 이 둘은 **없는 페이지가 아니라 같은 페이지의 다른 철자**다. 404 로 던지면 그 링크의 가치를 버리고
 * 사람에게도 없는 페이지를 보여 준다. *엔티티 부재*(`/pass/99999999`)와 *철거*(410)와는 다른 축이다.
 * 반대로 `/faq/zzzqqq` 같은 **쓰레기 꼬리는 페이지가 아니므로** 404 고, 그 판정은 `isKnownAppPath` 의 일이다.
 *
 * ## 🔒 반대 방향이 비싸다
 *
 * 멀쩡한 URL 을 301 로 보내면 그 페이지가 색인에서 사라지고 복구는 수주다. 그래서 호출부가
 * **정규화된 경로가 `isKnownAppPath` 를 통과할 때만** 보낸다(이 모듈은 모양만 본다).
 */

/** 워커가 직접 서빙하거나 플랫폼이 가로채는 경로 — 정규화 대상이 아니다. */
const SKIP_PREFIXES = ['/api/', '/assets/', '/.well-known/', '/cdn-cgi/']

const INDEX_SUFFIX = '/index.html'

/**
 * 301 로 보낼 경로. 바꿀 게 없으면 `null`.
 *
 * 🔁 **고정점까지 돈다** — `/x/index.html/` 처럼 둘이 겹친 모양이 한 번에 안 끝난다.
 *    결과가 다시 정규화 대상이면 리다이렉트 루프가 되므로 시험이 멱등을 단언한다.
 */
export function normalizeDocPath(pathname: string): string | null {
  if (!pathname || pathname[0] !== '/') return null
  for (const pre of SKIP_PREFIXES) if (pathname.startsWith(pre)) return null

  let p = pathname
  for (let i = 0; i < 4; i += 1) {
    const before = p
    if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '') || '/'
    if (p.endsWith(INDEX_SUFFIX)) p = p.slice(0, -INDEX_SUFFIX.length) || '/'
    if (p === before) break
  }
  return p === pathname ? null : p
}
