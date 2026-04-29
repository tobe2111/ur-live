import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { swallow } from '@/shared/utils/swallow'
import { CheckCircle2, Circle, Trophy, Sparkles, BookOpen, ChevronRight } from 'lucide-react'
import LiveStartGuideModal from './LiveStartGuideModal'

interface OnboardingStep {
  step_key: string
  completed: boolean
  completed_at: string | null
}

interface OnboardingData {
  steps: OnboardingStep[]
  progress: { done: number; total: number; percent: number }
  bootcamp_completed: boolean
  bootcamp_completed_at: string | null
  reward_deal: number
  reward_claimed: boolean
}

const STEP_LABEL: Record<string, { title: string; desc: string; path: string }> = {
  profile_complete: { title: '프로필 완성', desc: '사진/소개/주소 입력', path: '/seller/profile' },
  first_product: { title: '첫 상품 등록', desc: '판매할 상품 1개 추가', path: '/seller/products' },
  first_live: { title: '첫 라이브 시작', desc: '15분 이상 권장', path: '/seller/live-broadcast' },
  first_donation: { title: '첫 후원 받기', desc: '시청자에게 첫 응원', path: '/seller/donations' },
  first_payment: { title: '첫 결제 완료', desc: '시청자가 상품 구매', path: '/seller/orders' },
  first_alimtalk: { title: '첫 알림톡 발송', desc: '카카오톡 알림 1회', path: '/seller/alimtalk' },
}

export default function SellerOnboardingWidget() {
  const navigate = useNavigate()
  const [data, setData] = useState<OnboardingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('seller_bootcamp_dismissed') === 'true')
  const [showLiveGuide, setShowLiveGuide] = useState(false)

  useEffect(() => {
    if (dismissed) { setLoading(false); return }
    const token = localStorage.getItem('seller_token')
    if (!token) { setLoading(false); return }
    api.get('/api/seller/onboarding', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.data.success) setData(r.data.data)
      })
      .catch(swallow('seller:onboarding-load'))
      .finally(() => setLoading(false))
  }, [dismissed])

  if (loading || dismissed || !data) return null

  // 100% 완료 + 보상 받음 + 7일 지났으면 자동 dismiss
  if (data.bootcamp_completed && data.bootcamp_completed_at) {
    const completedDate = new Date(data.bootcamp_completed_at)
    const daysSince = (Date.now() - completedDate.getTime()) / (86400_000)
    if (daysSince > 7) return null
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {data.bootcamp_completed ? (
            <Trophy className="w-5 h-5 text-yellow-500" />
          ) : (
            <Sparkles className="w-5 h-5 text-blue-500" />
          )}
          <h3 className="text-sm font-bold text-gray-900">
            {data.bootcamp_completed ? '🎉 부트캠프 완주!' : '셀러 부트캠프'}
          </h3>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('seller_bootcamp_dismissed', 'true')
            setDismissed(true)
          }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          닫기
        </button>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs text-gray-600">
        <span>{data.progress.done} / {data.progress.total} 단계 완료</span>
        <span className="font-bold">{data.progress.percent}%</span>
      </div>

      <div className="w-full bg-white rounded-full h-2 mb-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
          style={{ width: `${data.progress.percent}%` }}
        />
      </div>

      <div className="space-y-1">
        {data.steps.map((s) => {
          const meta = STEP_LABEL[s.step_key]
          if (!meta) return null
          return (
            <button
              key={s.step_key}
              type="button"
              onClick={() => navigate(meta.path)}
              className="w-full flex items-center gap-2 text-xs px-2 py-1.5 -mx-2 rounded-lg hover:bg-white/60 active:bg-white/80 transition-colors text-left"
            >
              {s.completed ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
              <span className={`flex-1 ${s.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                <span className="font-medium">{meta.title}</span>
                <span className="text-gray-400 ml-1">— {meta.desc}</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            </button>
          )
        })}
      </div>

      {data.bootcamp_completed && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          🏆 모든 단계를 완료했습니다!
        </div>
      )}

      <button
        onClick={() => setShowLiveGuide(true)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5" /> 라이브 시작 가이드 보기
      </button>

      <LiveStartGuideModal
        open={showLiveGuide}
        onClose={() => setShowLiveGuide(false)}
        onContinue={() => setShowLiveGuide(false)}
      />
    </div>
  )
}
