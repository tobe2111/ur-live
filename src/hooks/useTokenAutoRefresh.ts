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
 *   useTokenAutoRefresh('agency')   // /agency/*
 */
import { useEffect } from 'react'
import axios from 'axios'

type Role = 'seller' | 'admin' | 'agency'

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
    : role === 'agency' ? '/api/agency/refresh'
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

export function useTokenAutoRefresh(role: Role) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    function schedule() {
      if (timer) clearTimeout(timer)
      const accessToken = localStorage.getItem(`${role}_token`)
      if (!accessToken) return
      const expMs = decodeJwtExp(accessToken)
      if (!expMs) return
      const targetMs = expMs - REFRESH_BEFORE_EXPIRY_MS - Date.now()
      // 이미 시점 지나면 즉시 시도
      if (targetMs <= 0) {
        refreshIfNeeded(role).then(() => schedule())
        return
      }
      timer = setTimeout(() => {
        refreshIfNeeded(role).then(() => schedule())
      }, Math.min(targetMs, 2147483000)) // 32-bit int max
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
