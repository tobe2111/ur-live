import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Copy } from 'lucide-react'

// ── 시청자 링크 공유 ─────────────────────────────────────────────
export function ShareLiveLink({ streamId }: { streamId: number }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const url = `https://live.ur-team.com/live/${streamId}`

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-blue-800 mb-2">
        {t('seller.liveBroadcast.shareLinkTitle')}
        <span className="ml-1 font-normal text-blue-600">— {t('seller.liveBroadcast.shareLinkDesc')}</span>
      </p>
      <div className="flex gap-2">
        <code className="flex-1 text-xs font-mono bg-white border border-blue-100 rounded-lg px-3 py-2 text-blue-900 truncate">
          {url}
        </code>
        <button
          onClick={copy}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t('seller.liveBroadcast.copied') : t('seller.liveBroadcast.copy')}
        </button>
      </div>
    </div>
  )
}
