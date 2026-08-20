import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { safeInternalPath } from '@/utils/safe-internal-path'

/**
 * 📣 최상단 프로모 바 (2026-08-19 — 대표 확정, 그루폰 홈 맨 위 띠).
 *
 * 어드민이 켜야만 나온다. 꺼져 있으면 **DOM 자체가 안 생긴다** — 빈 띠가 자리를 먹지 않게.
 *
 * 닫기(X): 그 기기에서 다시 안 뜬다(`localStorage`). 다음 홍보를 띄우고 싶으면 어드민에서
 * `promo_bar_version` 을 올린다 — 버전이 키에 들어가 있어 **모두에게 다시 보인다**.
 * (닫힘 상태를 서버에 저장하지 않는다: 비로그인도 닫을 수 있어야 하고, 그만한 값이 아니다.)
 */

interface PromoBarData {
  enabled: boolean
  text?: string
  cta?: string
  href?: string
  bg?: string
  version?: string
}

const DISMISS_PREFIX = 'ur_promo_dismiss_v'

export default function PromoBar() {
  const { data } = useApiQuery<PromoBarData>(
    ['promo-bar'],
    '/api/promo-bar',
    {
      select: (raw) => {
        const r = raw as { success?: boolean; data?: PromoBarData }
        return r?.success && r.data ? r.data : { enabled: false }
      },
      staleTime: 5 * 60_000,
    },
  )
  const [dismissed, setDismissed] = useState(false)
  const version = data?.version || '1'

  useEffect(() => {
    if (!data?.enabled) return
    try { setDismissed(localStorage.getItem(DISMISS_PREFIX + version) === '1') } catch { /* noop */ }
  }, [data?.enabled, version])

  if (!data?.enabled || !data.text || dismissed) return null

  const href = data.href ? safeInternalPath(data.href, '') : ''
  const bg = data.bg || '#1A2C42'

  function close() {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_PREFIX + version, '1') } catch { /* noop */ }
  }

  return (
    <div className="relative w-full text-white" style={{ backgroundColor: bg }} role="region" aria-label="공지">
      <div className="max-w-[1440px] mx-auto px-12 py-2.5 flex items-center justify-center gap-3 text-center">
        <p className="text-[13px] font-bold leading-snug">{data.text}</p>
        {href && data.cta && (
          <Link
            to={href}
            className="shrink-0 px-3.5 py-1 rounded-full bg-white text-[12px] font-extrabold hover:bg-white/90 transition-colors"
            style={{ color: bg }}
          >
            {data.cta}
          </Link>
        )}
      </div>
      <button
        onClick={close}
        aria-label="공지 닫기"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" strokeWidth={2.2} />
      </button>
    </div>
  )
}
