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

  // 🏭 2026-06-10 (사용자 요청 — "배너가 어딨어?"): 등록된 배너 0건이면 영역이 통째로 사라져
  //   배너 기능이 없는 것처럼 보였음 → 기본 히어로(목업, 이미지 불필요·CSS 전용) 표시.
  //   어드민이 /admin/wholesale-banners 에 실제 배너를 등록하면 자동 교체.
  if (n === 0) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl select-none">
        <div className="relative aspect-[16/6] min-h-[150px] flex items-center"
          style={{ background: 'linear-gradient(115deg, #14161c 0%, #1c2230 55%, #283452 100%)' }}>
          {/* 장식 — 브랜드 컬러 글로우 + 그리드 */}
          <div className="absolute -right-16 -top-24 w-72 h-72 rounded-full opacity-25 pointer-events-none"
            style={{ background: 'radial-gradient(circle, var(--ud-brand, #FF0033) 0%, transparent 70%)' }} />
          <div className="absolute right-12 bottom-[-60px] w-56 h-56 rounded-full opacity-15 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #5b7bd5 0%, transparent 70%)' }} />
          <div className="relative z-10 px-6 lg:px-10 py-5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
              style={{ background: 'var(--ud-brand, #FF0033)' }}>
              B2B 전용 도매몰
            </span>
            <h2 className="mt-2.5 text-[20px] lg:text-[28px] font-extrabold text-white leading-tight">
              검증된 제조사와 직거래,<br className="lg:hidden" /> 마진은 그대로 내 것
            </h2>
            <p className="mt-1.5 text-[12px] lg:text-[14px] text-gray-300">
              사업자 인증 후 등급별 도매가 공개 · 예치금 간편결제 · 세금계산서 자동 발행
            </p>
          </div>
        </div>
      </div>
    )
  }

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
