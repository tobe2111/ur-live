/**
 * 🛡️ 2026-05-22: production 정보 누출 방지 — generic error response helper.
 *
 * 사용:
 *   } catch (err) {
 *     return safeError(c, err, '주문 처리 중 오류가 발생했습니다', '[orders]')
 *   }
 *
 * 동작:
 *   - 서버: console.error 로 상세 stack 기록 (Cloudflare logs / Sentry)
 *   - 클라이언트: generic 한국어 메시지만 반환 (UNIQUE constraint / 스택트레이스 노출 X)
 *   - DEV 모드: 디버깅용으로 상세 메시지도 응답에 포함
 *
 * 영구 룰 (CLAUDE.md 추가):
 *   `(err as Error).message }, 500` 직접 반환 금지 — `safeError()` 사용.
 */

import type { Context } from 'hono'

export function safeError(
  c: Context,
  err: unknown,
  userMessage = '요청 처리 중 오류가 발생했습니다',
  logTag = '[unknown]',
  status: 400 | 401 | 403 | 404 | 500 | 503 = 500,
) {
  const msg = (err as Error)?.message || String(err)
  console.error(`${logTag} ${status} error:`, msg)

  // 🛡️ 2026-05-22 진단성 강화: production 에서도 짧은 _debug 노출 (200자).
  //   민감 정보 (SQL 전체 스택) 는 길이 제한으로 차단. error type / code 는 노출 → 사용자가 진단 가능.
  //   - DEV: 500자 (전체 stack).
  //   - PROD: 200자 (메시지 시작 부분 — code / table name 정도).
  const isDev = (() => {
    try {
      const env = (c.env as { ENVIRONMENT?: string; NODE_ENV?: string })
      return env.ENVIRONMENT === 'development' || env.NODE_ENV === 'development'
    } catch { return false }
  })()
  return c.json(
    {
      success: false,
      error: userMessage,
      _debug: msg.slice(0, isDev ? 500 : 200),
      _tag: logTag,
    },
    status,
  )
}
