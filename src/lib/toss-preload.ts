/**
 * 🛡️ 2026-05-23 토스 SDK preload (UI 지연 영구 fix):
 *
 * 이전 문제 (사용자 체감 — 결제 UI 지각):
 *   1) loadTossPayments() 가 컴포넌트 mount 후에야 실행 → CDN 다운로드 늦게 시작
 *   2) CheckoutPage 가 /api/payments/client-key 추가 왕복 → 200~400ms 추가
 *
 * 영구 해결:
 *   - import.meta.env.VITE_TOSS_CLIENT_KEY 를 진실원천 (server 키 fetch 제거).
 *     운영자가 키 바꾸면 빌드 필요 — 일반 frontend env 룰.
 *   - 모듈 평가 시점 (페이지 JS 로드 직후) loadTossPayments() 즉시 호출 → SDK CDN 다운로드
 *     사용자가 결제 단계 도착하기 전에 이미 완료.
 *   - 컴포넌트는 getPreloadedToss() 로 캐시된 Promise 재사용 → 0 추가 왕복.
 */

import { loadTossPayments } from '@tosspayments/tosspayments-sdk'

type TossPayments = Awaited<ReturnType<typeof loadTossPayments>>

const CLIENT_KEY = (import.meta.env.VITE_TOSS_CLIENT_KEY || '') as string

let preloadPromise: Promise<TossPayments> | null = null

function startPreload(): Promise<TossPayments> | null {
  if (preloadPromise) return preloadPromise
  if (!CLIENT_KEY || typeof window === 'undefined') return null
  preloadPromise = loadTossPayments(CLIENT_KEY).catch((err) => {
    if (import.meta.env.DEV) console.warn('[toss-preload] failed:', err)
    preloadPromise = null
    throw err
  })
  return preloadPromise
}

// 모듈 평가 즉시 preload 시작 (페이지 JS 로드 직후).
// CheckoutPage / PointsChargePage / GroupBuyDetailPage 가 import 만 해도 트리거.
startPreload()

// 🛡️ 2026-05-23 자동 env 미스매치 감지 → /api/_errors/log 자동 보고.
//   사용자 1명이 결제 시도하면 운영자가 /admin/errors 에서 즉시 인지.
//   server 가 반환하는 키와 VITE build-time 키 비교.
let mismatchChecked = false
async function checkEnvMismatchOnce(): Promise<void> {
  if (mismatchChecked || typeof window === 'undefined') return
  if (!CLIENT_KEY) return  // VITE 미설정 시 비교 불가
  mismatchChecked = true
  try {
    const res = await fetch('/api/payments/client-key', { cache: 'no-store' })
    const json = await res.json() as { data?: { clientKey?: string }; clientKey?: string }
    const serverKey = json.data?.clientKey || json.clientKey || ''
    if (!serverKey) return
    if (serverKey !== CLIENT_KEY) {
      const mask = (k: string) => k.length > 12 ? `${k.slice(0, 12)}...${k.slice(-4)}` : k
      const message = `[env_mismatch] VITE_TOSS_CLIENT_KEY (${mask(CLIENT_KEY)}) ≠ TOSS_CLIENT_KEY (${mask(serverKey)})`
      console.warn(message)
      // /api/_errors/log 로 자동 보고
      try {
        const body = JSON.stringify({
          message,
          type: 'env_mismatch',
          url: window.location.pathname,
          user_id: localStorage.getItem('user_id'),
          user_agent: navigator.userAgent.slice(0, 200),
        })
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' })
          navigator.sendBeacon('/api/_errors/log', blob)
        } else {
          fetch('/api/_errors/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
        }
      } catch { /* ignore */ }
    }
  } catch { /* network 실패 — 무시 */ }
}
// 결제 페이지 진입 시 자동 호출되도록 module evaluate 후 호출
if (typeof window !== 'undefined') {
  // 다른 초기화 끝나고 호출
  setTimeout(checkEnvMismatchOnce, 1000)
}

/**
 * 컴포넌트에서 호출 — 같은 키면 캐시된 Promise 재사용, 다르면 새로 로드.
 * 캐시가 없으면 즉시 생성 (모듈 평가 시 SSR / 키 미주입 케이스 대비).
 */
export async function getTossPayments(clientKey?: string): Promise<TossPayments> {
  const key = clientKey || CLIENT_KEY
  if (!key) throw new Error('TOSS_CLIENT_KEY missing')

  if (key === CLIENT_KEY) {
    const cached = startPreload()
    if (cached) return cached
  }
  return loadTossPayments(key)
}

export function getTossClientKey(): string {
  return CLIENT_KEY
}
