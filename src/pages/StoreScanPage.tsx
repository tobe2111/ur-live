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

export default function StoreScanPage() {
  const navigate = useNavigate()
  // 사업자 유저(seller_token 보유)만 — 아니면 마이로 돌려보냄(로그인 자체는 ProtectedRoute 가 보장).
  const hasSeller = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  useEffect(() => {
    if (!hasSeller) navigate('/user/profile', { replace: true })
  }, [hasSeller, navigate])
  if (!hasSeller) return null

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#020202]">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-3 py-3 border-b border-gray-100 dark:border-[#1A1A1A] bg-white/90 dark:bg-[#020202]/90 backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="뒤로" className="p-1.5 rounded-full active:bg-gray-100 dark:active:bg-[#1A1A1A]">
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
