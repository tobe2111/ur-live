/**
 * 🎟️ 2026-07-06 (대표 — "계산대 스캔을 셀러 대시보드 말고 메인에서, 가장 이상적으로"):
 *   독립 풀스크린 계산대 POS. 사업자 유저가 메인 '마이 탭 → 매장 계산대'에서 1탭 진입 —
 *   무거운 셀러 대시보드(SellerLayout) 안 거치고 손님 앞에서 바로 스캔.
 *   스캔 로직은 셀러 대시보드 스캔과 동일한 `VoucherScanner` 공유(BarcodeDetector + iOS qr-scanner).
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Store } from 'lucide-react'
import VoucherScanner from '@/components/voucher/VoucherScanner'

// 📟 2026-07-20 (대표 — 직원 폰/공기계): 스캔 전용 기기 링크(?dk=)로 진입하면 로그인 없이 스캔.
//   키는 localStorage 보관(1회 수신 후 주소창에서 제거 — 링크 공유/히스토리 노출 방지).
function captureDeviceKey(): void {
  try {
    const sp = new URLSearchParams(window.location.search)
    const dk = sp.get('dk')
    if (dk) {
      localStorage.setItem('scan_device_key', dk)
      sp.delete('dk')
      const q = sp.toString()
      window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : ''))
    }
  } catch { /* noop */ }
}

export default function StoreScanPage() {
  const navigate = useNavigate()
  if (typeof window !== 'undefined') captureDeviceKey()
  // 사업자 유저(seller_token) 또는 스캔 전용 기기 키 — 둘 다 없으면 마이로.
  const hasSeller = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  const hasDeviceKey = typeof window !== 'undefined' && !!localStorage.getItem('scan_device_key')
  const allowed = hasSeller || hasDeviceKey
  useEffect(() => {
    if (!allowed) navigate('/user/profile', { replace: true })
  }, [allowed, navigate])
  if (!allowed) return null

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0D0F12]">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-3 py-3 border-b border-gray-100 dark:border-[#2C2F35] bg-white/90 dark:bg-[#0D0F12]/90 backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="뒤로" className="p-1.5 rounded-full active:bg-gray-100 dark:active:bg-[#1A1C21]">
          <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
        <div className="flex items-center gap-1.5">
          <Store className="w-4 h-4 text-gray-900 dark:text-white" aria-hidden="true" />
          <h1 className="text-[15px] font-extrabold text-gray-900 dark:text-white">매장 계산대</h1>
        </div>
      </header>
      <div className="mx-auto max-w-xl p-4">
        <p className="text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400 mb-3">
          손님 이용권 QR을 비추면 자동으로 사용 처리돼요. 인식이 안 되면 아래에 코드를 직접 입력하세요. (연속 스캔)
        </p>
        <VoucherScanner />
      </div>
    </div>
  )
}
