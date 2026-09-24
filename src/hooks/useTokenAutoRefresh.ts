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
import { REFRESH_BEFORE_EXPIRY_MS, decodeJwtExpMs } from '@/lib/dashboard-token'
import { ensureFreshDashboardToken } from '@/lib/dashboard-refresh'

type Role = 'seller' | 'admin'  // 🌇 2026-09-04 에이전시 일몰 — 'agency' 제거

/**
 * 🔑 2026-09-23 (대표 "승인 같은 게 왜 이리 느리지? 로딩이 길어"): 갱신 실행을 공용 모듈에 위임.
 *
 * 두 가지가 달라졌다.
 *   ① **만료된 토큰도 1회 시도한다.** 종전엔 `remainingMs <= 0` 이면 손을 떼고 401 인터셉터에
 *      맡겼는데, 그래서 하루 뒤 재방문 첫 화면이 [요청 N개 → 401 N개 → 갱신 → 재시도 N개] 를 탔다.
 *      ⚠️ 2026-07-04 무한재귀 사고는 *재스케줄* 문제였지 *1회 시도* 문제가 아니다 —
 *      그 가드(`shouldRescheduleAfterAttempt`)는 아래에 **그대로** 있고, 갱신에 실패하면
 *      여전히 재스케줄하지 않는다(만료 토큰으로 루프가 돌 수 없다).
 *   ② **생 axios.post 를 버리고 공용 inflight 락을 쓴다.** refresh 토큰은 회전하므로 이 훅과
 *      인터셉터가 같은 순간에 각자 갱신하면 진 쪽이 stale 토큰으로 401 → 강제 로그아웃이다.
 */
async function refreshIfNeeded(role: Role): Promise<void> {
  await ensureFreshDashboardToken(role, REFRESH_BEFORE_EXPIRY_MS)
}

/**
 * 🛡️ 2026-07-04 (실사고 — /admin 무한로딩·렉·"응답 없는 페이지"·콘솔 무에러):
 *   갱신 시점(exp-5분)이 이미 지난 토큰에서 기존 schedule() 이 `refreshIfNeeded().then(schedule)` 로
 *   **무조건 재귀**했는데, refreshIfNeeded 는 만료 토큰(remainingMs<=0)/refresh 부재 시 네트워크 없이
 *   즉시 resolve 하는 no-op → setTimeout 없는 마이크로태스크 무한재귀 → 이벤트루프가 렌더링에 양보
 *   못 함 → 메인스레드 100% 영구 정지. localStorage 에 만료 토큰이 남은 채 방문하면 무조건 발병
 *   (App.tsx 가 seller 를 전 페이지에서 호출 → 전 사이트 잠재 폭탄이었음. CDP pause 로 콜스택 실증).
 *   수정: 재스케줄은 '갱신으로 미래 목표시각을 얻었을 때만'. 아니면 중단(= 갱신이 실패하면
 *   만료 토큰으로 루프가 돌 수 없다). visibilitychange 가 탭 복귀 시 재킥(이벤트당 1회로 유계).
 *   회귀 가드: src/tests/unit/token-auto-refresh.test.ts (불변식: 만료 토큰 → 무조건 재귀 금지).
 *   ⚠️ 2026-09-23: *1회 시도* 는 열렸다(위 refreshIfNeeded 주석) — 막는 것은 여전히 *재귀* 다.
 *   아래 두 함수를 "관대하게" 고치면 그 사고가 그대로 재발한다.
 */
export function nextRefreshDelayMs(expMs: number, now: number): number | null {
  const targetMs = expMs - REFRESH_BEFORE_EXPIRY_MS - now
  return targetMs > 0 ? Math.min(targetMs, 2147483000) : null // 32-bit int max
}

/** 갱신 시도 *후* 재스케줄 허용 여부 — 미래 목표시각을 가진 (새) 토큰일 때만 true. */
export function shouldRescheduleAfterAttempt(token: string | null, now: number): boolean {
  if (!token) return false
  const expMs = decodeJwtExpMs(token)
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
      const expMs = decodeJwtExpMs(accessToken)
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
