// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 Wave 2 — 도매몰 메인 히어로 배너 캐러셀.
//   자동슬라이드(~5s, hover/blur pause, adaptive) + 좌우 화살표 + 도트.
//   GET /api/wholesale/banners (공개). cfImage. 내부링크는 safeInternalPath.
//   라이트 고정 (WT) — dark: 없음. 비용 0: 정적 이미지 + 클라 타이머.
// ──────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWholesaleBanners, type WholesaleBanner } from '@/hooks/queries/useWholesale'
import { safeInternalPath, isSafeInternalPath } from '@/utils/safe-internal-path'
import { cfImage } from '@/utils/cf-image'
import { WT } from './wholesale-theme'

const AUTOPLAY_MS = 5000

export default function WholesaleBannerCarousel() {
  const navigate = useNavigate()
  const { data: banners = [] } = useWholesaleBanners()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const n = banners.length
  const go = useCallback((next: number) => setIdx((prev) => (n > 0 ? ((next % n) + n) % n : 0)), [n])

  // 자동슬라이드 — 1개 이하거나 hover/blur(탭 비활성) 시 멈춤(adaptive, 비용 0).
  useEffect(() => {
    if (n <= 1 || paused) return
    timerRef.current = setInterval(() => setIdx((p) => (p + 1) % n), AUTOPLAY_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [n, paused])

  // 탭이 백그라운드면 타이머 정지(배터리/리렌더 절약).
  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // idx 가 배너 수 변동으로 범위를 벗어나면 보정.
  useEffect(() => { if (idx >= n && n > 0) setIdx(0) }, [n, idx])

  if (n === 0) return null

  function onBannerClick(b: WholesaleBanner) {
    const link = b.link || ''
    if (!link) return
    if (isSafeInternalPath(link)) {
      navigate(safeInternalPath(link, '/wholesale'))
    } else if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl select-none"
      style={{ background: WT.fill }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[16/6] min-h-[140px]">
        {banners.map((b, i) => {
          const active = i === idx
          return (
            <button
              key={b.id}
              onClick={() => onBannerClick(b)}
              aria-label={b.title || `배너 ${i + 1}`}
              tabIndex={active ? 0 : -1}
              className="absolute inset-0 w-full h-full transition-opacity duration-500"
              style={{ opacity: active ? 1 : 0, pointerEvents: active ? 'auto' : 'none' }}
            >
              <img
                src={cfImage(b.image_url, { width: 1280, format: 'auto' }) || b.image_url}
                alt={b.title || ''}
                draggable={false}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="block w-full h-full object-cover"
              />
              {b.title && (
                <span className="absolute left-5 bottom-4 px-3 py-1.5 rounded-lg text-[14px] lg:text-[16px] font-bold text-white"
                  style={{ background: 'rgba(20,22,28,0.55)', backdropFilter: 'blur(4px)' }}>
                  {b.title}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {n > 1 && (
        <>
          <button onClick={() => go(idx - 1)} aria-label="이전 배너"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.9)', color: WT.ink, boxShadow: '0 2px 8px rgba(0,0,0,0.16)' }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(idx + 1)} aria-label="다음 배너"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.9)', color: WT.ink, boxShadow: '0 2px 8px rgba(0,0,0,0.16)' }}>
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
            {banners.map((b, i) => (
              <button key={b.id} onClick={() => go(i)} aria-label={`배너 ${i + 1}로 이동`}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === idx ? 18 : 6, background: i === idx ? WT.brand : 'rgba(255,255,255,0.75)' }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
