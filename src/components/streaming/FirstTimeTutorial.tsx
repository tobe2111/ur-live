/**
 * 첫 방송 셀러용 4단계 튜토리얼 overlay.
 * localStorage 플래그 'seller_live_tutorial_done' 으로 1회만 노출.
 */

import { useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

const TUTORIAL_KEY = 'seller_live_tutorial_done'

export function hasSeenTutorial(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === '1' }
  catch { return true }
}
function markTutorialDone() {
  try { localStorage.setItem(TUTORIAL_KEY, '1') } catch { /* ignore */ }
}

interface Step {
  emoji: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    emoji: '1️⃣',
    title: '방송 정보 입력',
    body: '제목과 판매할 상품을 고르세요. 처음이라면 "🧪 테스트" 버튼으로 비공개 연습 방송을 먼저 만들 수 있어요.',
  },
  {
    emoji: '2️⃣',
    title: '송출 도구 선택',
    body: 'OBS(PC), Prism(모바일), YouTube Studio(브라우저) 중 편한 방식 선택. 한 번 정하면 다음부터 자동 기억돼요.',
  },
  {
    emoji: '3️⃣',
    title: '방송 만들기 클릭',
    body: '클릭하면 YouTube 에 방송이 생성되고, RTMP 키가 복사 가능한 상태가 됩니다. OBS/Prism 에 붙여넣으세요.',
  },
  {
    emoji: '4️⃣',
    title: '자동 감지 → 자동 전환',
    body: '송출 도구에서 시작 버튼을 누르면 우리 앱이 자동 감지하고 3-2-1 카운트다운 후 라이브 대시보드로 이동합니다.',
  },
]

export function FirstTimeTutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]

  function dismiss() {
    markTutorialDone()
    onClose()
  }

  // 🛡️ 2026-04-29 a11y: ESC 닫기
  useEscapeKey(dismiss)

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={dismiss} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">첫 방송 가이드</p>
            <h3 id="tutorial-title" className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span aria-hidden="true">{current.emoji}</span>
              {current.title}
            </h3>
          </div>
          <button type="button" onClick={dismiss} aria-label="튜토리얼 닫기" className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">{current.body}</p>

        {/* 진행 도트 */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${
              i === step ? 'bg-blue-600 w-6' : i < step ? 'bg-blue-300 w-1.5' : 'bg-gray-200 w-1.5'
            }`} />
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-600">
            나중에
          </button>
          <button onClick={next}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">
            {step < STEPS.length - 1 ? '다음' : '시작하기'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
