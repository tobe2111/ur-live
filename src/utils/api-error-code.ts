/**
 * 서버가 준 **안정적인 에러 코드**를 꺼낸다 (2026-09-23).
 *
 * 왜 필요한가: 화면이 분기해야 할 때 `error` **문구**를 매칭하면, 누군가 문구를 다듬는 순간
 * 조용히 분기가 사라진다(에러도 안 나고 테스트도 안 깨진다 — 이 레포가 반복해 당한 "조용한 부재").
 * 그래서 서버는 `code` 를 주고 화면은 그것만 본다.
 *
 * axios 에러·평범한 응답 객체·둘 다 아닌 것을 전부 받아 문자열 또는 null 을 돌려준다.
 */
export function errorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null
  const e = err as { response?: { data?: unknown }; data?: unknown; code?: unknown }
  // axios 에러(`err.response.data.code`) → 응답 본문(`err.data.code`) → 본문 자체(`err.code`)
  for (const body of [e.response?.data, e.data, e]) {
    if (body && typeof body === 'object') {
      const code = (body as { code?: unknown }).code
      if (typeof code === 'string' && code) return code
    }
  }
  return null
}
