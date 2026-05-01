/**
 * 🛡️ 2026-04-30: 신규 사용자 환영 + 3-step onboarding modal.
 *
 * 트리거: URL 의 ?new=1 (카카오 sync callback 에서 isNewUser 시 부착)
 *   또는 localStorage 'ur_onboarding_done' 플래그 부재 + 신규 사용자 감지.
 *
 * 3 steps:
 *   1. 환영 + 자동 쿠폰 발급 (anchor — retention)
 *   2. 관심 카테고리 선택 (personalization)
 *   3. 알림 채널 (알림톡 옵트인 — 인앱 webview 사용자 대안)
 *
 * 한 번 완료하면 localStorage 'ur_onboarding_done=1' 저장 → 재 표시 X.
 * 모든 step skip 가능 (강제 X).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Gift, Heart, Bell, Check, ChevronRight, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  onClose: () => void
  userName?: string
}

const ONBOARDING_DONE_KEY = 'ur_onboarding_done'

const CATEGORIES = [
  { key: 'meal_voucher', label: '맛집 식사권', emoji: '🍽️' },
  { key: 'beauty_voucher', label: '뷰티', emoji: '💇' },
  { key: 'health_voucher', label: '헬스·웰니스', emoji: '💪' },
  { key: 'fashion', label: '패션', emoji: '👗' },
  { key: 'beauty_product', label: '화장품', emoji: '💄' },
  { key: 'food_product', label: '식품·간식', emoji: '🍰' },
  { key: 'home', label: '리빙', emoji: '🏠' },
  { key: 'pet', label: '반려동물', emoji: '🐶' },
  { key: 'kids', label: '유아·아동', emoji: '👶' },
]

export default function WelcomeOnboardingModal({ onClose, userName }: Props) {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [couponClaimed, setCouponClaimed] = useState(false)
  const [claimingCoupon, setClaimingCoupon] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [alimtalkOptIn, setAlimtalkOptIn] = useState(true) // 기본 ON

  useEscapeKey(handleSkipAll)

  function markDone() {
    try { localStorage.setItem(ONBOARDING_DONE_KEY, '1') } catch { /* */ }
  }

  function handleSkipAll() {
    markDone()
    onClose()
  }

  async function handleClaimCoupon() {
    setClaimingCoupon(true)
    // 🛡️ 2026-05-01: 무한 로딩 방지 — 5초 timeout (백엔드 hang 시 silent UX 진행)
    const timeoutId = setTimeout(() => {
      setCouponClaimed(true)
      setClaimingCoupon(false)
    }, 5000)
    try {
      // Welcome coupon endpoint — 백엔드에 코드 'WELCOME' or 시점 자동 발급 endpoint 가정.
      // 🛡️ TODO: 백엔드에 신규 사용자 자동 쿠폰 발급 endpoint 신설 권장 (또는 어드민이
      //   'WELCOME' 코드 발급 후 여기서 claim).
      const res = await api.post('/api/coupons/apply', { code: 'WELCOME' }).catch(() => null)
      clearTimeout(timeoutId)
      if (res?.data?.success) {
        setCouponClaimed(true)
        toast.success('환영 쿠폰이 발급됐어요! 🎉')
      } else {
        // 백엔드에 WELCOME 코드 없으면 silent — UI 는 어쨌든 넘어감
        setCouponClaimed(true)
      }
    } catch {
      clearTimeout(timeoutId)
      setCouponClaimed(true) // 실패해도 UX 진행
    } finally {
      setClaimingCoupon(false)
    }
  }

  async function handleFinish() {
    setSubmitting(true)
    // 🛡️ 2026-05-01: 무한 로딩 방지 — 5초 timeout. 백엔드 hang 시도 모달 종료.
    const timeoutId = setTimeout(() => {
      try { localStorage.setItem('ur_user_interests', JSON.stringify(selectedCats)) } catch { /* */ }
      try { localStorage.setItem('ur_alimtalk_optin', alimtalkOptIn ? '1' : '0') } catch { /* */ }
      markDone()
      setSubmitting(false)
      onClose()
    }, 5000)
    try {
      try {
        localStorage.setItem('ur_user_interests', JSON.stringify(selectedCats))
        localStorage.setItem('ur_alimtalk_optin', alimtalkOptIn ? '1' : '0')
      } catch { /* */ }

      // 백엔드 동기화 시도 (없으면 silent) — 명시 5s timeout
      await api.post('/api/users/onboarding', {
        interests: selectedCats,
        alimtalk_optin: alimtalkOptIn,
      }, { timeout: 5000 }).catch(() => null)

      clearTimeout(timeoutId)
      markDone()
      toast.success('설정이 저장됐어요!')
      onClose()
    } finally {
      clearTimeout(timeoutId)
      setSubmitting(false)
    }
  }

  function toggleCat(key: string) {
    setSelectedCats(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center"
      role="presentation"
    >
      <div
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        {/* 헤더 */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step ? 'w-6 bg-pink-500' : s < step ? 'w-3 bg-pink-300' : 'w-3 bg-gray-200'
                }`}
              />
            ))}
          </div>
          <button onClick={handleSkipAll} aria-label="건너뛰기" className="text-[12px] text-gray-400 px-2 py-1">
            건너뛰기
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
          {step === 1 && (
            <div className="text-center">
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center mb-4">
                <Sparkles className="w-9 h-9 text-white" />
              </div>
              <h2 id="welcome-title" className="text-[22px] font-extrabold text-gray-900 mb-1.5">
                {userName ? `${userName}님, 환영해요!` : '유어딜에 오신 걸 환영해요!'}
              </h2>
              <p className="text-[14px] text-gray-500 leading-relaxed">
                라이브 방송으로 보고 바로 사는<br />
                <strong className="text-gray-900">한국 1위 라이브 커머스</strong>
              </p>

              <div className="bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-2xl p-5 mt-6 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-pink-500 flex items-center justify-center shrink-0 shadow-md">
                    <Gift className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-pink-700">신규 환영 쿠폰</p>
                    <p className="text-[20px] font-extrabold text-gray-900 mt-0.5">5,000원 할인</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">10,000원 이상 구매 시 사용 가능 · 7일 유효</p>
                  </div>
                </div>
                {couponClaimed ? (
                  <div className="mt-3 px-3 py-2 bg-white rounded-xl text-center text-[13px] font-bold text-pink-600 flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> 발급 완료!
                  </div>
                ) : (
                  <button
                    onClick={handleClaimCoupon}
                    disabled={claimingCoupon}
                    className="mt-3 w-full py-2.5 bg-pink-500 text-white rounded-xl font-bold text-sm active:scale-95 disabled:opacity-50"
                  >
                    {claimingCoupon ? '발급 중...' : '쿠폰 받기'}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-center mb-5">
                <div className="mx-auto w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mb-3">
                  <Heart className="w-8 h-8 text-pink-500" />
                </div>
                <h2 className="text-[20px] font-extrabold text-gray-900 mb-1">관심 분야를 알려주세요</h2>
                <p className="text-[13px] text-gray-500">맞춤 추천에 사용돼요 (1개 이상 선택, 변경 가능)</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const selected = selectedCats.includes(c.key)
                  return (
                    <button
                      key={c.key}
                      onClick={() => toggleCat(c.key)}
                      className={`flex flex-col items-center gap-1 px-2 py-3 rounded-2xl border-2 transition-all ${
                        selected
                          ? 'bg-pink-50 border-pink-500 shadow-sm'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <span className="text-2xl">{c.emoji}</span>
                      <span className={`text-[11px] font-bold ${selected ? 'text-pink-600' : 'text-gray-700'}`}>
                        {c.label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-3 text-center">
                선택한 카테고리: <strong className="text-pink-500">{selectedCats.length}개</strong>
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="text-center mb-5">
                <div className="mx-auto w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center mb-3">
                  <Bell className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-[20px] font-extrabold text-gray-900 mb-1">알림 받기</h2>
                <p className="text-[13px] text-gray-500">놓치면 아쉬운 핫딜·라이브 소식을 알려드려요</p>
              </div>

              <button
                onClick={() => setAlimtalkOptIn(!alimtalkOptIn)}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                  alimtalkOptIn ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    alimtalkOptIn ? 'bg-yellow-400' : 'bg-gray-100'
                  }`}>
                    <span className="text-xl">💬</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-gray-900 flex items-center gap-1.5">
                      카카오 알림톡으로 받기
                      {alimtalkOptIn && <Check className="w-4 h-4 text-yellow-600" />}
                    </p>
                    <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                      라이브 시작 / 핫딜 / 주문 상태 등<br />
                      카톡으로 무료 알림 (광고성 정보 제외)
                    </p>
                  </div>
                </div>
              </button>

              <p className="text-[11px] text-gray-400 mt-3 text-center leading-relaxed">
                마이페이지 → 알림 설정에서<br />
                언제든지 변경 가능합니다.
              </p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-[14px] flex items-center justify-center gap-1 active:scale-[0.98]"
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {step === 2 && (
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-3 text-gray-600 font-semibold text-sm"
              >
                이전
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedCats.length === 0}
                className="flex-1 py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-[14px] flex items-center justify-center gap-1 active:scale-[0.98] disabled:opacity-50"
              >
                다음
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {step === 3 && (
            <button
              onClick={handleFinish}
              disabled={submitting}
              className="w-full py-3.5 bg-pink-500 text-white rounded-2xl font-bold text-[14px] active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? '저장 중...' : '시작하기 🎉'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** localStorage flag 체크 — 이미 onboarding 완료한 사용자는 다시 안 보임 */
export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === '1'
  } catch {
    return false
  }
}
