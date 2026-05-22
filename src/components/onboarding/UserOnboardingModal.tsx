/**
 * 🛡️ 2026-05-21 Phase E: 첫 진입 유저 onboarding 3-step modal.
 *
 * localStorage('ur_onboarding_seen') 가 없으면 자동 표시.
 * 사용자가 "건너뛰기" 또는 끝까지 보면 영구 hide.
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const KEY = 'ur_onboarding_seen_v1'

const STEPS = [
  {
    emoji: '🛍️',
    title: '공동구매 참여하기',
    desc: '인기 매장의 voucher 를 친구들과 함께 모이면 더 저렴하게! 인플루언서 링크로 들어오면 자동 적용됩니다.',
  },
  {
    emoji: '📱',
    title: 'QR 코드 받기',
    desc: '결제 즉시 마이페이지에 QR 코드가 발급됩니다. 24시간 유효, 화면 캡처 도용 방지 실시간 시간 표시.',
  },
  {
    emoji: '🏪',
    title: '매장 방문 사용',
    desc: '예약이 필요한 카테고리 (뷰티/숙박/액티비티) 는 결제 후 시간 슬롯 선택. 식사권은 바로 방문해서 QR 보여주면 끝!',
  },
]

export default function UserOnboardingModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (!localStorage.getItem(KEY)) {
        // 첫 진입 후 약간 지연 (페이지 로드 완료 후)
        setTimeout(() => setOpen(true), 1500)
      }
    } catch { /* graceful */ }
  }, [])

  function close() {
    try { localStorage.setItem(KEY, '1') } catch { /* graceful */ }
    setOpen(false)
  }

  if (!open) return null
  const s = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl max-w-sm w-full p-6 relative">
        <button
          onClick={close}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A]"
          aria-label="닫기"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="text-center pt-2">
          <div className="text-6xl mb-4">{s.emoji}</div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">{s.title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{s.desc}</p>
        </div>

        {/* progress dots */}
        <div className="flex items-center justify-center gap-1.5 mt-6 mb-4">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`block h-2 rounded-full transition-all ${i === step ? 'w-6 bg-pink-500' : 'w-2 bg-gray-300 dark:bg-gray-700'}`}
            />
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 rounded-2xl text-sm font-bold"
            >
              이전
            </button>
          )}
          <button
            onClick={() => isLast ? close() : setStep(s => s + 1)}
            className="flex-[2] py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl text-sm font-bold"
          >
            {isLast ? '시작하기' : '다음'}
          </button>
        </div>

        <button
          onClick={close}
          className="block w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-600"
        >
          건너뛰기
        </button>
      </div>
    </div>
  )
}
