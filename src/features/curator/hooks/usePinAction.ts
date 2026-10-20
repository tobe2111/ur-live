/**
 * 🛡️ 2026-05-25 (migration 0278): 큐레이터 핀 1탭 액션 hook.
 *
 * Phase 1-B 핵심 UX — "유저가 공개 페이지에 상품 핀하기 매우 쉬워야 한다" (사용자 강조).
 *
 * 흐름:
 *   1. 핀 버튼 클릭 → 인증 체크
 *   2. 비로그인 → localStorage 'pending_pin_product_id' + 카카오 로그인 redirect
 *   3. 로그인 후 useAutoPin (App.tsx 전역) 이 자동 핀 추가
 *   4. 로그인 상태 → 즉시 addPin → 첫 담기면 핸들 자동 생성 + toast
 *   5. 일반 담기 → "유어샵에 담았어요 · 링크 복사됨" 한 줄 toast (2026-09-02 문구 축소)
 */

import { useState, useCallback } from 'react'
import { useAuthStore } from '@/client/stores/auth.store'
import { curatorApi } from '@/features/curator/api/curator-api'
import { toast } from '@/hooks/useToast'

const PENDING_PIN_KEY = 'pending_pin_product_id'
const HANDLE_TOAST_SHOWN_KEY = 'curator_handle_first_shown'

/**
 * 🩸 2026-09-02 (대표 신고 — 이미 담은 상품을 또 누르면 "오류가 발생했습니다"): 서버는 이미 담은 상품에 **409 + code ALREADY_PINNED**
 *   를 주는데, axios 는 4xx 를 throw 하므로 아래 `result.code === 'ALREADY_PINNED'` 분기는 한 번도 도달한 적이
 *   없었다 — 항상 catch 로 떨어져 "오류" 로 보고됐다. 정상 상태(이미 담김)를 오류로 말하는 것이 사고의 본질이라,
 *   throw 된 응답에서 code 를 꺼내 같은 분기로 보낸다.
 */
function readApiError(err: unknown): { code?: string; error?: string } {
  const ax = err as { response?: { data?: { code?: string; error?: string } } }
  return ax?.response?.data ?? {}
}

/**
 * 🎫 토스트 문구 규칙 (2026-09-02 디자인 시스템 — 이모지 0 · 한 줄 · 사람 말):
 *   토스트는 3.5초 뒤 사라지는 한 줄이다. 예상 적립 시뮬레이터·편집 방법 안내처럼 **읽는 데 3초 넘게 걸리는
 *   문장은 토스트에 넣지 않는다**. "핀" 은 코드 식별자이고 사용자에겐 **담기**(2026-08-26 명칭 SSOT)다.
 */
const MSG = {
  saved: '유어샵에 담았어요',
  savedStore: '유어샵 추천에 담았어요',
  linkCopied: ' · 링크 복사됨',
  already: '이미 담은 상품이에요',
  failed: '담지 못했어요. 다시 시도해 주세요',
  shopCreated: (handle: string) => `내 유어샵이 생겼어요 · /u/${handle}`,
} as const

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

  const togglePin = useCallback(async (productId: number, _price?: number) => {
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
        if (result.code === 'ALREADY_PINNED') toast.info(MSG.already)
        else toast.error(result.error || MSG.failed)
        return
      }

      // 첫 담기 → 유어샵 생성 안내 (1회만)
      if (result.handle_just_created && result.handle) {
        const shown = localStorage.getItem(HANDLE_TOAST_SHOWN_KEY)
        if (!shown) {
          toast.success(MSG.shopCreated(result.handle))
          try { localStorage.setItem(HANDLE_TOAST_SHOWN_KEY, '1') } catch { /* ignore */ }
        }
      }

      // 🛡️ 2026-05-28: 원클릭 추천 = 담기 + 추천 링크 클립보드 복사 동시 (사용자 결정).
      //   유어샵에 담김 + 단톡방/스토리에 바로 붙여넣을 추천 링크 복사 → 행동 1단계.
      let linkCopied = false
      try {
        const handle = result.handle || (user as { handle?: string })?.handle
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://urdeal.kr'
        const shareUrl = handle
          ? `${origin}/u/${handle}/p/${productId}`
          : `${origin}/products/${productId}?ref=${user.id}`
        await navigator.clipboard.writeText(shareUrl)
        linkCopied = true
      } catch { /* 클립보드 차단 환경 — 담기는 이미 완료 */ }

      const copySuffix = linkCopied ? MSG.linkCopied : ''
      // ✨ 2026-07-04 유어샵 1단계 1b: 매장 업주(스토어프론트 모드)가 담으면 하단 '추천' 섹션으로 간다는 것만
      //   말한다. "편집 모드에서 추천 ON" 절차는 토스트가 아니라 편집 화면이 말할 자리(2026-09-02 문구 축소).
      const isStoreOwner = typeof localStorage !== 'undefined' && !!localStorage.getItem('seller_id')
      toast.success((isStoreOwner ? MSG.savedStore : MSG.saved) + copySuffix)
    } catch (err) {
      const { code, error } = readApiError(err)
      if (code === 'ALREADY_PINNED') toast.info(MSG.already)
      else toast.error(error && error.length <= 30 ? error : MSG.failed)
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
        if (result.handle_just_created && result.handle) toast.success(MSG.shopCreated(result.handle))
        else toast.success(MSG.saved)
      } else if (result.code === 'ALREADY_PINNED') {
        toast.info(MSG.already)
      }
    } catch (err) {
      // 로그인 직후 자동 담기 — 이미 담은 상품이면 그것만 알리고, 그 외 실패는 조용히(UX 방해 X)
      if (readApiError(err).code === 'ALREADY_PINNED') toast.info(MSG.already)
    }
  }, [isAuthenticated, user])

  return { isPinning, togglePin, consumePending }
}
