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
