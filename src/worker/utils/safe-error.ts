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

  // 📊 2026-06-12 (4차 감사 D2): 5xx 만 Sentry 보고 — 기존 ~400곳 console-only 였던 서버 오류 가시화.
  //   dynamic import (순환 import 방어) + fire-and-forget fail-soft: Sentry 실패가 응답을 절대 못 막음.
  //   DSN 미설정 시 captureException 이 console.error 폴백 (sentry.ts 2026-06-11 동작).
  if (status >= 500) {
    try {
      void import('./sentry')
        .then((m) => m.captureException(
          err instanceof Error ? err : new Error(msg),
          { tags: { tag: logTag, status: String(status), via: 'safeError' } },
        ))
        .catch(() => { /* fail-soft */ })
    } catch { /* fail-soft */ }
  }

  // 🏭 2026-06-07 (보안 audit, 사용자 승인): production 에서 _debug(원본 에러 메시지) 미노출.
  //   기존엔 PROD 에서도 200자 노출 → `UNIQUE constraint failed: users.email` 류 메시지로 계정
  //   enumeration / 내부 스키마 누출 가능했음. 상세는 위 console.error 로 서버 로그(Cloudflare/Sentry)에만
  //   기록 → 진단성 유지. 응답 _debug 는 DEV 모드에서만 포함.
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
      ...(isDev ? { _debug: msg.slice(0, 500) } : {}),
      _tag: logTag,
    },
    status,
  )
}
