/**
 * 공유 유도 팝업/배너
 * - 구매 완료, 리뷰 작성, 회원가입 등에서 사용
 * - 한국: 카카오 공유 / 글로벌: 네이티브 공유
 */
import { useState } from 'react'
import { X } from 'lucide-react'
import KakaoShareButton from './KakaoShareButton'

interface SharePromptProps {
  title: string
  message: string
  shareTitle: string
  shareDescription: string
  shareLink: string
  shareButtonText?: string
  reward?: string
  onClose: () => void
}

export default function SharePrompt({ title, message, shareTitle, shareDescription, shareLink, shareButtonText, reward, onClose }: SharePromptProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {reward && (
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4 text-center">
            <p className="text-sm font-bold text-pink-600">{reward}</p>
          </div>
        )}

        <KakaoShareButton
          title={shareTitle}
          description={shareDescription}
          link={shareLink}
          buttonText={shareButtonText}
        />


        <button onClick={onClose} className="w-full mt-2 py-2.5 text-sm text-gray-500 font-medium">
          다음에 하기
        </button>
      </div>
    </div>
  )
}

/** 간단한 인라인 공유 배너 (팝업이 아닌 배너형) */
export function ShareBanner({ title, description, link, buttonText, className }: {
  title: string; description: string; link: string; buttonText?: string; className?: string
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className={`bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 ${className || ''}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <button onClick={() => setDismissed(true)} className="text-gray-400"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      <KakaoShareButton title={title} description={description} link={link} buttonText={buttonText} />
    </div>
  )
}
