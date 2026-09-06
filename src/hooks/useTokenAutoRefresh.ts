/**
 * 🛡️ 2026-04-30: Proactive token refresh — 만료 5분 전에 미리 갱신.
 *
 * 동작:
 *   1. 마운트 시 access token 의 exp 디코드 → 만료 N분 전에 setTimeout 으로 refresh
 *   2. visibilitychange (탭 복귀) 시 토큰 만료 임박이면 즉시 refresh
 *   3. refresh 실패 시 그대로 두고 다음 API 호출의 401 → 인터셉터 흐름 (기존 동작)
 *
 * 사용:
 *   useTokenAutoRefresh('seller')   // /seller/* 페이지
 *   useTokenAutoRefresh('admin')    // /admin/*
 */
import { useEffect } from 'react'
import axios from 'axios'

type Role = 'seller' | 'admin'  // 🌇 2026-09-04 에이전시 일몰 — 'agency' 제거

const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000 // 만료 5분 전

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

async function refreshIfNeeded(role: Role): Promise<void> {
  const tokenKey = `${role}_token`
  const refreshKey = `${role}_refresh_token`
  const refreshUrl = role === 'seller' ? '/api/seller/refresh'
    : '/api/admin/refresh'

  const accessToken = localStorage.getItem(tokenKey)
  const refreshToken = localStorage.getItem(refreshKey)
  if (!accessToken || !refreshToken) return

  const expMs = decodeJwtExp(accessToken)
  if (!expMs) return
  const remainingMs = expMs - Date.now()

  // 만료 전 5분 이상 남았으면 skip
  if (remainingMs > REFRESH_BEFORE_EXPIRY_MS) return

  // 이미 만료됐으면 인터셉터에 맡김 (기존 401 흐름)
  if (remainingMs <= 0) return

  try {
    const res = await axios.post(refreshUrl, { refreshToken })
    if (res.data?.success && res.data.data?.accessToken) {
      localStorage.setItem(tokenKey, res.data.data.accessToken)
      if (res.data.data.refreshToken) {
        localStorage.setItem(refreshKey, res.data.data.refreshToken)
      }
      if (import.meta.env.DEV) console.info(`[useTokenAutoRefresh] ${role} token proactively refreshed`)
    }
  } catch {
    // 실패해도 silent — 다음 API 호출의 401 흐름이 처리
  }
}

/**
 * 🛡️ 2026-07-04 (실사고 — /admin 무한로딩·렉·"응답 없는 페이지"·콘솔 무에러):
 *   갱신 시점(exp-5분)이 이미 지난 토큰에서 기존 schedule() 이 `refreshIfNeeded().then(schedule)` 로
 *   **무조건 재귀**했는데, refreshIfNeeded 는 만료 토큰(remainingMs<=0)/refresh 부재 시 네트워크 없이
 *   즉시 resolve 하는 no-op → setTimeout 없는 마이크로태스크 무한재귀 → 이벤트루프가 렌더링에 양보
 *   못 함 → 메인스레드 100% 영구 정지. localStorage 에 만료 토큰이 남은 채 방문하면 무조건 발병
 *   (App.tsx 가 seller 를 전 페이지에서 호출 → 전 사이트 잠재 폭탄이었음. CDP pause 로 콜스택 실증).
 *   수정: 재스케줄은 '갱신으로 미래 목표시각을 얻었을 때만'. 아니면 중단 — 만료 토큰 처리는
 *   401 인터셉터/라우트 게이트 소관이고, visibilitychange 가 탭 복귀 시 재킥(이벤트당 1회로 유계).
 *   회귀 가드: src/hooks/__tests__/token-auto-refresh.test.ts (불변식: 만료 토큰 → 무조건 재귀 금지).
 */
export function nextRefreshDelayMs(expMs: number, now: number): number | null {
  const targetMs = expMs - REFRESH_BEFORE_EXPIRY_MS - now
  return targetMs > 0 ? Math.min(targetMs, 2147483000) : null // 32-bit int max
}

/** 갱신 시도 *후* 재스케줄 허용 여부 — 미래 목표시각을 가진 (새) 토큰일 때만 true. */
export function shouldRescheduleAfterAttempt(token: string | null, now: number): boolean {
  if (!token) return false
  const expMs = decodeJwtExp(token)
  if (!expMs) return false
  return nextRefreshDelayMs(expMs, now) !== null
}

export function useTokenAutoRefresh(role: Role) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    function schedule() {
      if (timer) clearTimeout(timer)
      const accessToken = localStorage.getItem(`${role}_token`)
      if (!accessToken) return
      const expMs = decodeJwtExp(accessToken)
      if (!expMs) return
      const delay = nextRefreshDelayMs(expMs, Date.now())
      // 갱신 시점이 이미 지남 — 1회 시도 후, 미래 목표를 얻었을 때만 재스케줄(위 2026-07-04 주석).
      if (delay === null) {
        refreshIfNeeded(role).then(() => {
          if (shouldRescheduleAfterAttempt(localStorage.getItem(`${role}_token`), Date.now())) schedule()
        })
        return
      }
      timer = setTimeout(() => {
        refreshIfNeeded(role).then(() => schedule())
      }, delay)
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        // 탭 복귀 시 즉시 검증 + reschedule
        refreshIfNeeded(role).then(() => schedule())
      }
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [role])
}
