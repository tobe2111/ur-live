/**
 * 🛡️ 2026-05-25 (migration 0278): 큐레이터 핀 1탭 액션 hook.
 *
 * Phase 1-B 핵심 UX — "유저가 공개 페이지에 상품 핀하기 매우 쉬워야 한다" (사용자 강조).
 *
 * 흐름:
 *   1. 핀 버튼 클릭 → 인증 체크
 *   2. 비로그인 → localStorage 'pending_pin_product_id' + 카카오 로그인 redirect
 *   3. 로그인 후 useAutoPin (App.tsx 전역) 이 자동 핀 추가
 *   4. 로그인 상태 → 즉시 addPin → 첫 핀이면 핸들 자동 생성 + toast
 *   5. 일반 핀 → "₩X 핀됨 · 5명 공유 시 예상 적립 ₩Y" toast + 공유 sheet
 */

import { useState, useCallback } from 'react'
import { useAuthStore } from '@/client/stores/auth.store'
import { curatorApi } from '@/features/curator/api/curator-api'
import { toast } from '@/hooks/useToast'
import { CURATOR_DEFAULTS } from '@/shared/constants/policy'

const PENDING_PIN_KEY = 'pending_pin_product_id'
const HANDLE_TOAST_SHOWN_KEY = 'curator_handle_first_shown'

export interface UsePinActionResult {
  isPinning: boolean
  togglePin: (productId: number, price?: number) => Promise<void>
  /** post-login auto pin (App.tsx 가 mount 시 호출) */
  consumePending: () => Promise<void>
}

function getReturnUrl(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname + window.location.search
}

export function usePinAction(): UsePinActionResult {
  const [isPinning, setIsPinning] = useState(false)
  const user = useAuthStore((s: any) => s.user)
  const isAuthenticated = useAuthStore((s: any) => s.isAuthenticated)

  const togglePin = useCallback(async (productId: number, price?: number) => {
    if (!Number.isFinite(productId) || productId <= 0) return

    if (!isAuthenticated || !user) {
      // 비로그인 → pending_pin 저장 후 카카오 로그인 (returnUrl 보존)
      try { localStorage.setItem(PENDING_PIN_KEY, String(productId)) } catch { /* ignore */ }
      const returnUrl = encodeURIComponent(getReturnUrl())
      window.location.href = `/login?returnUrl=${returnUrl}&intent=pin`
      return
    }

    setIsPinning(true)
    try {
      const result = await curatorApi.addPin(productId)
      if (!result.success) {
        if (result.code === 'ALREADY_PINNED') {
          toast.info('이미 핀에 추가된 상품입니다')
        } else {
          toast.error(result.error || '핀 추가 실패')
        }
        return
      }

      // 첫 핀 → 핸들 안내 toast (1회만)
      if (result.handle_just_created && result.handle) {
        const shown = localStorage.getItem(HANDLE_TOAST_SHOWN_KEY)
        if (!shown) {
          toast.success(`🎉 내 링크샵 생성! /u/${result.handle}`)
          try { localStorage.setItem(HANDLE_TOAST_SHOWN_KEY, '1') } catch { /* ignore */ }
        }
      }

      // 수익 simulator — 5명 공유 시 예상 적립
      if (price && Number.isFinite(price) && price > 0) {
        const expected = Math.round(price * 5 * (CURATOR_DEFAULTS.STATS_DEFAULT_RANGE_DAYS / 7) * 0.01)
        toast.success(`📌 핀 추가! 5명 공유 시 예상 ${expected.toLocaleString()}원 적립`)
      } else {
        toast.success('📌 링크샵에 핀이 추가되었어요')
      }
    } catch (err) {
      toast.error('핀 추가 중 오류가 발생했습니다')
    } finally {
      setIsPinning(false)
    }
  }, [isAuthenticated, user])

  const consumePending = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!isAuthenticated || !user) return
    let pid: number | null = null
    try {
      const raw = localStorage.getItem(PENDING_PIN_KEY)
      if (!raw) return
      localStorage.removeItem(PENDING_PIN_KEY)
      pid = Number(raw)
    } catch { return }
    if (!pid || !Number.isFinite(pid)) return

    try {
      const result = await curatorApi.addPin(pid)
      if (result.success) {
        if (result.handle_just_created && result.handle) {
          toast.success(`🎉 내 링크샵 생성! /u/${result.handle} · 첫 핀이 추가됐어요`)
        } else {
          toast.success('📌 핀이 추가되었어요')
        }
      } else if (result.code === 'ALREADY_PINNED') {
        toast.info('이미 핀에 있는 상품이에요')
      }
    } catch { /* silent — UX 방해 X */ }
  }, [isAuthenticated, user])

  return { isPinning, togglePin, consumePending }
}
