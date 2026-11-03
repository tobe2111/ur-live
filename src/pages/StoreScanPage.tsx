/**
 * 🎟️ 2026-07-06 (대표 — "계산대 스캔을 셀러 대시보드 말고 메인에서, 가장 이상적으로"):
 *   독립 풀스크린 계산대 POS. 사업자 유저가 메인 '마이 탭 → 매장 계산대'에서 1탭 진입 —
 *   무거운 셀러 대시보드(SellerLayout) 안 거치고 손님 앞에서 바로 스캔.
 *   스캔 로직은 셀러 대시보드 스캔과 동일한 `VoucherScanner` 공유(BarcodeDetector + iOS qr-scanner).
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import VoucherScanner from '@/components/voucher/VoucherScanner'
import { currentSeatLabel } from '@/lib/seller-seat'
import { MY_PATH, clearMyReturn, noteMyReturn, shouldOfferMyReturn } from '@/lib/seller-return'

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
  /**
   * ↩️ 2026-09-28 — **마이에서 왔으면 마이로 돌려보낸다.**
   *   마이의 큰 브랜드 버튼이 `withMyReturn('/store/scan')` 으로 보내는데(`?from=my`),
   *   이 화면은 `SellerLayout` 밖이라 그 띠(`BackToMyBar`)가 **붙는 자리가 없었다** —
   *   표시만 주소에 실려 오고 아무도 안 읽었다. `BackToMyBar` 자신이 머리말에 적어 둔
   *   *"페이지마다 붙이면 안 붙인 페이지가 반드시 생긴다"* 의 바로 그 페이지가 여기다.
   *
   *   ⚠️ 그 띠를 그대로 가져오지 않는 이유: 띠는 `bg-white` 고정(대시보드는 라이트 고정이라
   *     `dark:` 가 금지돼 있다)인데 **이 화면은 다크를 지원한다** — 다크에서 흰 띠가 된다.
   *     그래서 *판정만* SSOT(`seller-return.ts`)에서 그대로 가져오고, 표현은 이 화면의 ‹ 버튼이 한다.
   */
  if (typeof window !== 'undefined') noteMyReturn(window.location.search)
  const backToMy = typeof window !== 'undefined' && shouldOfferMyReturn()
  // 사업자 유저(seller_token) 또는 스캔 전용 기기 키 — 둘 다 없으면 마이로.
  const hasSeller = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  const hasDeviceKey = typeof window !== 'undefined' && !!localStorage.getItem('scan_device_key')
  const allowed = hasSeller || hasDeviceKey
  // 표시 전용 — 스캔 대상은 서버가 좌석 토큰으로 정한다. 스캔 전용 기기(dk)엔 이름이 없을 수 있다.
  const seatLabel = typeof window !== 'undefined' ? currentSeatLabel() : null
  useEffect(() => {
    if (!allowed) navigate(MY_PATH, { replace: true })
  }, [allowed, navigate])
  if (!allowed) return null

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#11141C]">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-3 py-3 border-b border-gray-100 dark:border-[#2C2F35] bg-white/90 dark:bg-[#11141C]/90 backdrop-blur">
        <button
          onClick={() => {
            // 마이에서 왔으면 마이로 — 하드 이동이다(마이는 소비자 세션으로 도는 다른 표면이다).
            if (backToMy) { clearMyReturn(); window.location.assign(MY_PATH); return }
            navigate(-1)
          }}
          aria-label={backToMy ? '마이로 돌아가기' : '뒤로'}
          className="flex items-center gap-1 pl-2 pr-2 py-2 rounded-full active:bg-gray-100 dark:active:bg-[#1D1F29]"
        >
          <ChevronLeft className="w-5 h-5 shrink-0 text-gray-700 dark:text-gray-200" />
          {backToMy && <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">마이</span>}
        </button>
        <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">매장 계산대</h1>
        {/* ✂️ 2026-11-03 대표 *"너무 필요이상으로 글자가 많아. 심플하고 간결하며 세련되게"* — 안내 두 문단을 걷었다.
            · 되돌릴 수 없다는 말은 **사용 처리 확인창**이 한다(2026-10-06 — 비추면 바로 쓰이지 않고 그 창을 거친다).
            · 어느 가게로 처리되는지는 여기 **가게 이름 한 칸**이 말한다(값은 표시 전용 — 대상은 서버가 좌석 토큰으로 정한다). */}
        {seatLabel && (
          <span
            aria-label={`${seatLabel} 이용권만 처리`}
            className="ml-auto max-w-[45%] truncate rounded-full bg-gray-100 dark:bg-[#1D1F29] px-3 py-1 text-[13px] font-medium text-gray-700 dark:text-gray-200"
          >
            {seatLabel}
          </span>
        )}
      </header>
      <div className="mx-auto max-w-xl p-4">
        <VoucherScanner />
      </div>
    </div>
  )
}
