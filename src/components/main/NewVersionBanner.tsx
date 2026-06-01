/**
 * 🛡️ 2026-06-01: 새 버전 안내 배너.
 *   version-check 가 새 배포를 감지하면 강제 리로드 대신 `ur:new-version` 이벤트 → 본 배너 표시.
 *   사용자가 원할 때 "새로고침"을 눌러 적용 (입력/스크롤 중 강제 리로드 방지).
 *   App 루트에 1회 마운트. BottomNav 위에 떠서 가림 없이 노출.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, X } from 'lucide-react'
import { NEW_VERSION_EVENT, applyVersionUpdate } from '@/lib/version-check'

export default function NewVersionBanner() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    const onNew = () => setShow(true)
    window.addEventListener(NEW_VERSION_EVENT, onNew as EventListener)
    return () => window.removeEventListener(NEW_VERSION_EVENT, onNew as EventListener)
  }, [])

  if (!show) return null

  return (
    <div
      className="fixed inset-x-0 z-[60] flex justify-center px-3 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-md flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-900 text-white shadow-2xl border border-white/10">
        <RefreshCw className="w-4 h-4 shrink-0 text-emerald-400" />
        <p className="flex-1 text-[13px] leading-snug">
          {t('newVersion.message', { defaultValue: '새 버전이 나왔어요. 새로고침하면 적용됩니다.' })}
        </p>
        <button
          onClick={async () => { setReloading(true); await applyVersionUpdate() }}
          disabled={reloading}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold disabled:opacity-60"
        >
          {reloading ? t('newVersion.reloading', { defaultValue: '적용 중…' }) : t('newVersion.reload', { defaultValue: '새로고침' })}
        </button>
        <button
          onClick={() => setShow(false)}
          aria-label={t('newVersion.dismiss', { defaultValue: '닫기' })}
          className="shrink-0 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
