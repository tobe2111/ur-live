/**
 * 🔎 2026-07-29 외부 검색 API fetch 래퍼 — **실패 원인을 살려서** 돌려준다.
 *
 *   실사고: `run.diag.naver` 가 매 회차 `"블로그 검색 호출 실패 (네트워크)"` 만 기록했다.
 *   호출부가 `.catch(() => null)` 로 예외를 통째로 버려서 **타임아웃·DNS 실패·서브리퀘스트 한도가
 *   전부 같은 한 문장**으로 보였기 때문이다. 같은 회차 유튜브 쪽은 원문이 살아 있어 진짜 원인이
 *   `Too many subrequests by single Worker invocation` 임이 드러났는데, 네이버는 그걸 알 길이 없었다.
 *
 *   ⚠️ 특히 **한도 초과 문구는 원문 그대로 보존해야 한다** — 상위 레인의 예산 자가교정
 *   (`isSubrequestLimitError` → `nextSubreqCap`)이 이 문자열로 동작한다. 뭉개면 그 학습까지 죽는다.
 */

/** fetch 예외를 사람이 읽고 분류할 수 있는 한 줄로. 길이는 스탬프(300자)를 넘지 않게 자른다. */
export function describeFetchFailure(err: unknown, label: string): string {
  const e = err as { name?: string; message?: string } | null
  const name = e?.name || 'Error'
  const msg = String(e?.message || '')
  // ⏱️ AbortSignal.timeout() 은 TimeoutError — '네트워크'와 구분돼야 타임아웃 상향 판단이 가능하다.
  if (name === 'TimeoutError' || /timeout|aborted/i.test(msg)) return `${label} 타임아웃(12s 초과): ${name}`
  // 🚧 한도 초과 — 원문 보존 필수(위 주석 참조).
  if (/too many (subrequests|api requests)/i.test(msg)) return `${label} 실패: ${msg.slice(0, 160)}`
  return `${label} 실패: ${name}${msg ? `: ${msg.slice(0, 160)}` : ' (원문 없음 — DNS/연결 계열)'}`
}

/** 검색 API 호출 — 성공하면 res, 실패하면 분류된 사유(failure). 둘 중 하나는 항상 non-null. */
export async function searchFetch(url: string, init: RequestInit, label: string): Promise<{ res: Response | null; failure: string | null }> {
  try {
    return { res: await fetch(url, init), failure: null }
  } catch (err) {
    return { res: null, failure: describeFetchFailure(err, label) }
  }
}
/** 🏠 네이버 블로그 **홈(모바일)** 공개 HTML — 프로필 소개글 + 위젯(인스타/링크트리/오픈카톡/이메일)이 여기 있음.
 *  RSS(글 본문)보다 컨택 적중률 높음(블로거는 이메일을 글이 아니라 프로필/위젯에 둠). 공개 페이지 · 쿼터 무관 · fail-soft.
 *  모바일 SSR(m.blog.naver.com)이 데스크톱 iframe 보다 정적 텍스트가 풍부 → 브라우저 UA 로 요청. */
export async function fetchNaverBlogHome(handle: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(handle)) return ''
  try {
    const res = await fetch(`https://m.blog.naver.com/${handle}`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1', accept: 'text/html' },
      redirect: 'follow',
    })
    if (!res.ok) return ''
    return (await res.text()).slice(0, 80000) // 프로필/위젯 영역에 mailto:·instagram.com·linktr.ee 링크
  } catch { return '' }
}
