import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * 🔗 2026-07-03 구매 직후 셀러 전환 넛지 (웨지 전환 깔때기 P0 — 대표 승인 "1~4번 전부, 가장 이상적으로").
 *
 * 배경: 기존 전환 CTA 는 마이/유어샵 소유자뷰에만 있어 이미 관심 있는 사람만 봄(self-selection).
 *   로컬딜/이용권을 방금 산 '가장 뜨거운 순간'의 소비자에게 "당신도 팔 수 있어요"를 제시해
 *   로컬딜 미끼 → 유어샵 D2C 로 잇는다.
 *
 * 규칙:
 *   - 이미 셀러(seller_token)면 미노출 — 전환 대상만.
 *   - user_handle 이 있으면 "이미 내 유어샵이 있어요" 자산을 개인화(가입 시 즉시 핸들 발급과 짝).
 *   - CTA → /seller/register/supplier?from=payment (기존 ?from=curator 패턴과 동일 게이트).
 *   - '다음에' 닫으면 localStorage 로 재노출 안 함(반복 구매자 피로 방지).
 *   자기완결 컴포넌트 — PaymentSuccessPage 의 결제 로직과 완전 분리(additive).
 */
export default function SellerConversionNudge() {
  const navigate = useNavigate()
  const DISMISS_KEY = 'ur_seller_nudge_dismissed_v1'
  const [visible, setVisible] = useState(false)
  const [handle, setHandle] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const hasSellerToken = !!localStorage.getItem('seller_token')
      const dismissed = localStorage.getItem(DISMISS_KEY) === '1'
      const loggedIn = !!(localStorage.getItem('user_id') || localStorage.getItem('user_type'))
      if (hasSellerToken || dismissed || !loggedIn) return
      const h = localStorage.getItem('user_handle')
      if (h) setHandle(h)
      setVisible(true)
    } catch { /* localStorage 접근 실패 — 넛지 미노출(비차단) */ }
  }, [])

  if (!visible) return null

  return (
    <div className="mt-4 sm:mt-5 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gradient-to-br from-gray-50 to-white dark:from-[#161616] dark:to-[#1C1C1E] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">🏪</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
            이제 나도 팔아볼까요?
          </p>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
            방금 산 것 같은 상품·이용권, <strong className="text-gray-900 dark:text-white">내 쇼핑몰</strong>에서 직접 팔 수 있어요.
            {handle
              ? <> 이미 <span className="font-mono text-gray-900 dark:text-white">urdeal.kr/u/{handle}</span> 유어샵이 준비돼 있어요.</>
              : <> 사업자 등록만 하면 내 유어샵이 열립니다.</>}
            <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-1">플랫폼 수수료 5% · 판매 대금은 QR 사용 확인 후 정산</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => navigate('/seller/register/supplier?from=payment')}
          className="flex-1 py-2.5 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white text-sm font-bold rounded-lg transition-colors"
        >
          내 쇼핑몰 열기 →
        </button>
        <button
          onClick={() => {
            try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* noop */ }
            setVisible(false)
          }}
          className="px-3 py-2.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
        >
          다음에
        </button>
      </div>
    </div>
  )
}
