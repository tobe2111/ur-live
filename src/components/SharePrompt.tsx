/**
 * 공유 유도 팝업/배너
 * - 구매 완료, 리뷰 작성, 회원가입 등에서 사용
 * - 한국: 카카오 공유 / 글로벌: 네이티브 공유
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import KakaoShareButton from './KakaoShareButton'
import { useEscapeKey } from '@/hooks/useEscapeKey'

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
  const { t } = useTranslation()
  useEscapeKey(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose} role="presentation">
      <div className="w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{message}</p>
          </div>
          <button onClick={onClose} aria-label={t('sharePrompt.closeAria', { defaultValue: '공유 프롬프트 닫기' })} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {reward && (
          <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/40 rounded-xl p-3 mb-4 text-center">
            <p className="text-sm font-bold text-pink-600 dark:text-pink-400">{reward}</p>
          </div>
        )}

        <KakaoShareButton
          title={shareTitle}
          description={shareDescription}
          link={shareLink}
          buttonText={shareButtonText}
        />


        <button onClick={onClose} className="w-full mt-2 py-2.5 text-sm text-gray-500 dark:text-gray-400 font-medium">
          {t('sharePrompt.later', { defaultValue: '다음에 하기' })}
        </button>
      </div>
    </div>
  )
}

/** 간단한 인라인 공유 배너 (팝업이 아닌 배너형) */
export function ShareBanner({ title, description, link, buttonText, className }: {
  title: string; description: string; link: string; buttonText?: string; className?: string
}) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className={`bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800/40 rounded-xl p-4 ${className || ''}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
        <button onClick={() => setDismissed(true)} aria-label={t('common.close')} className="text-gray-400 dark:text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{description}</p>
      <KakaoShareButton title={title} description={description} link={link} buttonText={buttonText} />
    </div>
  )
}
