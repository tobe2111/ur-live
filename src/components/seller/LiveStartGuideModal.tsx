import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, CheckCircle2, Sparkles } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onContinue: () => void
}

const CHECKLIST = [
  { key: 'intro', title: '자기소개 10~20초 준비', desc: '간단한 닉네임 + 오늘 라이브 주제 + 응원 환영 멘트' },
  { key: 'background', title: '배경 정리', desc: '깔끔하고 정리된 공간. 산만한 물건 치우기' },
  { key: 'lighting', title: '조명 확인', desc: '얼굴이 어둡지 않게 — 정면 광원 또는 링라이트 권장' },
  { key: 'mic', title: '마이크/소리 점검', desc: '에코·잡음 없는지 5초 테스트' },
  { key: 'title', title: '매력적인 제목', desc: '시청자의 호기심을 자극하는 키워드 + 이모지' },
  { key: 'product', title: '판매 상품 정리', desc: '오늘 노출할 상품 미리 등록 + 재고 확인' },
  { key: 'response', title: '시청자 응대 멘트', desc: '입장 시 "○○님 환영해요!" 처럼 이름 부르기' },
] as const

export default function LiveStartGuideModal({ open, onClose, onContinue }: Props) {
  const { t } = useTranslation()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [dontShow, setDontShow] = useState(false)

  if (!open) return null

  const allChecked = CHECKLIST.every((c) => checked[c.key])
  const checkedCount = CHECKLIST.filter((c) => checked[c.key]).length

  function toggle(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleContinue() {
    if (dontShow) {
      localStorage.setItem('seller_live_guide_dismissed', 'true')
    }
    onContinue()
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-bold text-gray-900">{t('seller.liveGuideTitle', { defaultValue: '라이브 시작 전 체크리스트' })}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs text-gray-500 mb-4">
            {t('seller.liveGuideSubtitle', { defaultValue: '매끄러운 라이브를 위해 아래 항목을 점검하세요. 강제 X — 가이드일 뿐입니다.' })}
          </p>

          <div className="flex items-center justify-between mb-4 text-xs text-gray-600">
            <span>{t('seller.liveGuideProgress', { checkedCount, total: CHECKLIST.length, defaultValue: '{{checkedCount}} / {{total}} 점검 완료' })}</span>
            {allChecked && <span className="text-green-600 font-bold">{t('seller.liveGuideReady', { defaultValue: '✨ 준비 완료!' })}</span>}
          </div>

          <div className="space-y-2">
            {CHECKLIST.map((item) => {
              const isChecked = !!checked[item.key]
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggle(item.key)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isChecked
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {isChecked ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isChecked ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {item.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              {t('seller.liveGuideTip', { defaultValue: '💡 시청자 심리 팁: 시청자가 선물을 보내는 이유는 콘텐츠가 좋고 / 자신이 소중하다고 느끼고 / 셀러와 친해지고 싶어서 입니다. 이름 부르고 응대하는 것만으로 매출이 올라갑니다.' })}
            </p>
          </div>

          <label className="flex items-center gap-2 mt-4 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t('seller.liveGuideDontShow', { defaultValue: '다시 표시하지 않기' })}
          </label>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg"
          >
            {t('common.cancel', { defaultValue: '취소' })}
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold rounded-lg"
          >
            {t('seller.liveGuideStart', { defaultValue: '라이브 시작 →' })}
          </button>
        </div>
      </div>
    </div>
  )
}
