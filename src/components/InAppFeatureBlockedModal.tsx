/**
 * 🛡️ 2026-04-30: 인앱 webview 차단 기능 안내 모달.
 *
 * 사용:
 *   if (isFeatureBlocked('camera')) {
 *     setShowBlockedModal('camera')
 *     return // 카메라 호출 중단
 *   }
 *   ...
 *   {showBlockedModal && (
 *     <InAppFeatureBlockedModal
 *       feature={showBlockedModal}
 *       onClose={() => setShowBlockedModal(null)}
 *       onAlternative={feature === 'notification' ? handleAlimtalkOptIn : undefined}
 *     />
 *   )}
 */
import { useEffect, useState } from 'react'
import { X, ExternalLink, Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getFeatureInfo, getInAppLabel, handleOpenExternal, type RestrictedFeature } from '@/lib/in-app-warning'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  feature: RestrictedFeature
  onClose: () => void
  onAlternative?: () => void
  alternativeLabel?: string
}

export default function InAppFeatureBlockedModal({ feature, onClose, onAlternative, alternativeLabel }: Props) {
  const { t } = useTranslation()
  const info = getFeatureInfo(feature)
  const inAppLabel = getInAppLabel() || '인앱'
  const [copied, setCopied] = useState(false)
  const [openTried, setOpenTried] = useState(false)

  useEscapeKey(onClose)

  // 🛡️ iOS Safari scroll lock: position:fixed + scrollY 보존/복원 (단순 overflow:hidden 은 Safari 에서 jump)
  useEffect(() => {
    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = window.location.href
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* */ }
      document.body.removeChild(ta)
    }
  }

  const handleOpen = () => {
    setOpenTried(true)
    handleOpenExternal()
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-[#0A0A0A] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 pt-5 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="iafm-title"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold mb-2 border border-amber-200">
              ⚠️ {inAppLabel} 인앱 브라우저
            </span>
            <h2 id="iafm-title" className="text-[18px] font-extrabold text-gray-900 dark:text-white leading-tight">
              <span className="mr-1.5">{info.icon}</span>
              {info.title}
            </h2>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-1 -m-1 rounded-full hover:bg-gray-100 shrink-0">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
          {info.desc}
        </p>

        {openTried && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-[12px] text-blue-800">
            ℹ️ 외부 브라우저가 안 열린다면 우측 상단 메뉴 → "<strong>다른 브라우저로 열기</strong>" 또는 "<strong>Safari 로 열기</strong>" 를 선택하거나 아래 URL 을 복사해 직접 붙여넣어 주세요.
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleOpen}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-[14px] active:scale-[0.98] transition-transform"
          >
            <ExternalLink className="w-4 h-4" />
            외부 브라우저로 열기
          </button>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 rounded-2xl font-semibold text-[13px]"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'URL 복사됨!' : 'URL 복사'}
          </button>

          {onAlternative && alternativeLabel && (
            <button
              onClick={() => { onAlternative(); onClose() }}
              className="w-full px-4 py-3 bg-pink-50 text-pink-600 rounded-2xl font-semibold text-[13px] border border-pink-200"
            >
              {alternativeLabel}
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-gray-500 dark:text-gray-400 text-[13px]"
          >
            나중에 하기
          </button>
        </div>
      </div>
    </div>
  )
}
