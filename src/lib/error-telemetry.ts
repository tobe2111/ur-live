/**
 * 🛡️ 2026-05-23 Frontend 에러 telemetry — 사용자 신고 의존 영구 제거.
 *
 * 동작:
 *   - window.onerror (sync 에러)
 *   - window.onunhandledrejection (Promise reject)
 *   - 우리가 명시적으로 reportError() 호출 (custom)
 *   - 각각 POST /api/_errors/log 로 전송 → D1 frontend_errors 테이블
 *
 * Privacy:
 *   - localStorage user_id 만 (이메일/이름 X)
 *   - URL 의 query string 마스킹 (paymentKey / token 등 민감 값 제거)
 *
 * Rate limit:
 *   - 동일 메시지 1분당 1회만 전송 (loop 방지)
 *   - localStorage 에 마지막 전송 timestamp 저장
 */

const ENDPOINT = '/api/_errors/log'
const DEDUPE_KEY_PREFIX = '_err_dedupe_'
const DEDUPE_WINDOW_MS = 60_000  // 1분

function maskUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin)
    // 민감 쿼리 파라미터 마스킹
    const sensitive = ['paymentKey', 'token', 'access_token', 'code', 'state', 'orderId']
    for (const key of sensitive) {
      if (u.searchParams.has(key)) u.searchParams.set(key, '***')
    }
    return u.pathname + (u.search || '')
  } catch { return url }
}

function getUserId(): string | null {
  try { return localStorage.getItem('user_id') } catch { return null }
}

function isDuplicate(key: string): boolean {
  try {
    const last = Number(localStorage.getItem(DEDUPE_KEY_PREFIX + key) || '0')
    const now = Date.now()
    if (now - last < DEDUPE_WINDOW_MS) return true
    localStorage.setItem(DEDUPE_KEY_PREFIX + key, String(now))
    return false
  } catch { return false }
}

interface ErrorPayload {
  message: string
  stack?: string
  url: string
  type: 'error' | 'unhandledrejection' | 'manual'
  user_id: string | null
  user_agent: string
}

async function send(payload: ErrorPayload): Promise<void> {
  try {
    // navigator.sendBeacon 우선 — 페이지 unload 시에도 전송 보장.
    const body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon(ENDPOINT, blob)
      if (ok) return
    }
    // fallback
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    })
  } catch {
    // 절대 throw 안 함 (에러 리포터 자체가 에러 내면 무한 루프).
  }
}

/** 명시적 보고 — 우리 코드에서 catch 한 에러 등. */
export function reportError(message: string, opts?: { stack?: string; tag?: string }): void {
  const dedupe = `${opts?.tag || 'manual'}:${message.slice(0, 80)}`
  if (isDuplicate(dedupe)) return
  send({
    message: opts?.tag ? `[${opts.tag}] ${message}` : message,
    stack: opts?.stack,
    url: maskUrl(window.location.href),
    type: 'manual',
    user_id: getUserId(),
    user_agent: navigator.userAgent.slice(0, 200),
  })
}

let installed = false

/** 앱 부팅 시 1회만 호출 (main.tsx). */
export function installErrorTelemetry(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    const message = String(event.message || '').slice(0, 500)
    if (!message) return
    const dedupe = `err:${message.slice(0, 80)}`
    if (isDuplicate(dedupe)) return
    send({
      message,
      stack: event.error?.stack?.slice(0, 1000),
      url: maskUrl(window.location.href),
      type: 'error',
      user_id: getUserId(),
      user_agent: navigator.userAgent.slice(0, 200),
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = String(
      reason instanceof Error ? reason.message :
      typeof reason === 'string' ? reason :
      JSON.stringify(reason),
    ).slice(0, 500)
    if (!message) return
    const dedupe = `rej:${message.slice(0, 80)}`
    if (isDuplicate(dedupe)) return
    send({
      message,
      stack: reason instanceof Error ? reason.stack?.slice(0, 1000) : undefined,
      url: maskUrl(window.location.href),
      type: 'unhandledrejection',
      user_id: getUserId(),
      user_agent: navigator.userAgent.slice(0, 200),
    })
  })
}
