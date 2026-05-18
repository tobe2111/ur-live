import { useEffect, useState } from 'react'

export type SellerMode = 'live' | 'store'

/**
 * 🛡️ 2026-05-18: 셀러 대시보드 mode 훅 — SellerLayout 의 mode 토글과 같은 source 공유.
 *   - localStorage 'seller_dashboard_mode' 가 SSOT
 *   - 같은 탭 변경: 'seller-mode-changed' CustomEvent 로 즉시 반응
 *   - 다른 탭 변경: 'storage' 이벤트로 반응
 *   - 셀러 타입이 'influencer' 면 항상 'live', 'store_owner' 면 항상 'store' (강제).
 */
export function useSellerMode(): SellerMode {
  const [mode, setMode] = useState<SellerMode>(() => readMode())

  useEffect(() => {
    const sync = () => setMode(readMode())
    const onCustom = (e: Event) => {
      const m = (e as CustomEvent<SellerMode>).detail
      if (m === 'live' || m === 'store') setMode(m)
      else sync()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'seller_dashboard_mode' || e.key === 'seller_type') sync()
    }
    window.addEventListener('seller-mode-changed', onCustom as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('seller-mode-changed', onCustom as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return mode
}

function readMode(): SellerMode {
  if (typeof window === 'undefined') return 'live'
  const sellerType = localStorage.getItem('seller_type')
  // 셀러 타입이 단일이면 강제 — toggle UI 도 노출 안 됨.
  if (sellerType === 'influencer') return 'live'
  if (sellerType === 'store_owner') return 'store'
  const saved = localStorage.getItem('seller_dashboard_mode')
  return saved === 'store' ? 'store' : 'live'
}
