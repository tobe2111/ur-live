// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 Wave 2 — 도매몰 메인 히어로 배너 캐러셀.
// 🏭 2026-06-10 (사용자 요청 — "양쪽으로 슬라이드"): 크로스페이드 → 트랙 슬라이드 전환.
//   - 좌우 화살표 + 손가락 스와이프(드래그 추적) 양방향 + 무한 루프(양끝 클론 점프)
//   - 자동슬라이드(~5s, hover/드래그/탭 비활성 시 pause, adaptive) + 도트
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
const SLIDE_MS = 450

export default function WholesaleBannerCarousel() {
  const navigate = useNavigate()
  const { data: banners = [] } = useWholesaleBanners()
  const n = banners.length

  // 트랙 위치 — 무한 루프용 클론: [마지막, ...banners, 첫번째]. pos=1 이 실제 첫 배너.
  const [pos, setPos] = useState(1)
  const [animate, setAnimate] = useState(true)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  // 드래그(스와이프) 상태 — px 오프셋을 트랙 transform 에 실시간 반영.
  const [dragPx, setDragPx] = useState(0)
  const dragRef = useRef<{ startX: number; startY: number; active: boolean; locked: boolean }>({ startX: 0, startY: 0, active: false, locked: false })
  const slidingRef = useRef(false)

  const realIdx = n > 0 ? ((pos - 1) % n + n) % n : 0

  const go = useCallback((dir: 1 | -1) => {
    if (n <= 1 || slidingRef.current) return
    slidingRef.current = true
    setAnimate(true)
    setPos(p => p + dir)
  }, [n])

  // 클론 경계 도달 시 transition 없이 실제 위치로 점프 (무한 루프 — 양방향).
  const onTransitionEnd = useCallback(() => {
    slidingRef.current = false
    setPos(p => {
      if (p === 0) { setAnimate(false); return n }
      if (p === n + 1) { setAnimate(false); return 1 }
      return p
    })
  }, [n])
  // 점프 직후 한 프레임 뒤 transition 복원.
  useEffect(() => {
    if (animate) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)))
    return () => cancelAnimationFrame(id)
  }, [animate])

  // 자동슬라이드 — 1개 이하 / hover / 드래그 중 / 탭 비활성 시 멈춤.
  useEffect(() => {
    if (n <= 1 || paused) return
    const t = setInterval(() => go(1), AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [n, paused, go])
  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // 배너 수 변동 시 위치 보정.
  useEffect(() => { setAnimate(false); setPos(1) }, [n])

  // ── 스와이프 (포인터 통합 — 터치/마우스) ──
  const onPointerDown = (e: React.PointerEvent) => {
    if (n <= 1) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, active: true, locked: false }
    setPaused(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    // 세로 스크롤 우선 — 가로 의도가 분명할 때만 드래그 잠금.
    if (!d.locked) {
      if (Math.abs(dx) < 8) return
      if (Math.abs(dy) > Math.abs(dx)) { d.active = false; return }
      d.locked = true
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* unsupported */ }
    }
    setDragPx(dx)
  }
  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d.active) { setPaused(false); return }
    dragRef.current = { startX: 0, startY: 0, active: false, locked: false }
    const width = trackRef.current?.parentElement?.offsetWidth || 1
    const dx = e.clientX - d.startX
    setDragPx(0)
    setPaused(false)
    // 1/5 폭 또는 60px 이상 끌면 그 방향으로 슬라이드.
    if (d.locked && (Math.abs(dx) > Math.min(width / 5, 60))) go(dx < 0 ? 1 : -1)
  }

  // 드래그로 살짝 움직였으면 클릭(링크 이동) 무시.
  const movedRef = useRef(false)
  useEffect(() => { movedRef.current = Math.abs(dragPx) > 5 }, [dragPx])

  function onBannerClick(b: WholesaleBanner) {
    if (movedRef.current) return
    const link = b.link || ''
    if (!link) return
    if (isSafeInternalPath(link)) {
      navigate(safeInternalPath(link, '/wholesale'))
    } else if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer')
    }
  }

  // 🏭 2026-06-10 (사용자 — "배너가 어딨어?"): 등록 배너 0건이면 기본 히어로(목업, CSS 전용).
  //   어드민이 /admin/wholesale-banners 에 등록하면 자동 교체.
  if (n === 0) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl select-none">
        <div className="relative aspect-[16/6] min-h-[150px] flex items-center"
          style={{ background: 'linear-gradient(115deg, #14161c 0%, #1c2230 55%, #283452 100%)' }}>
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

  // 클론 슬라이드: [마지막, ...banners, 첫번째] (1개면 클론 불필요)
  const slides = n > 1 ? [banners[n - 1], ...banners, banners[0]] : banners
  const offset = n > 1 ? pos : 0

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl select-none"
      style={{ background: WT.fill, touchAction: 'pan-y' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="relative aspect-[16/6] min-h-[140px] overflow-hidden">
        <div
          ref={trackRef}
          className="flex h-full"
          style={{
            transform: `translateX(calc(-${offset * 100}% + ${dragPx}px))`,
            transition: animate && dragPx === 0 ? `transform ${SLIDE_MS}ms cubic-bezier(0.25, 0.8, 0.35, 1)` : 'none',
            willChange: 'transform',
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {slides.map((b, i) => (
            <button
              key={`${b.id}-${i}`}
              onClick={() => onBannerClick(b)}
              aria-label={b.title || `배너`}
              tabIndex={i === offset ? 0 : -1}
              className="relative shrink-0 w-full h-full"
              draggable={false}
            >
              <img
                src={cfImage(b.image_url, { width: 1280, format: 'auto' }) || b.image_url}
                alt={b.title || ''}
                draggable={false}
                loading={i <= 1 ? 'eager' : 'lazy'}
                decoding="async"
                className="block w-full h-full object-cover pointer-events-none"
              />
              {b.title && (
                <span className="absolute left-5 bottom-4 px-3 py-1.5 rounded-lg text-[14px] lg:text-[16px] font-bold text-white"
                  style={{ background: 'rgba(20,22,28,0.55)', backdropFilter: 'blur(4px)' }}>
                  {b.title}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {n > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="이전 배너"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.9)', color: WT.ink, boxShadow: '0 2px 8px rgba(0,0,0,0.16)' }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(1)} aria-label="다음 배너"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.9)', color: WT.ink, boxShadow: '0 2px 8px rgba(0,0,0,0.16)' }}>
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
            {banners.map((b, i) => (
              <button key={b.id} onClick={() => { if (!slidingRef.current) { setAnimate(true); setPos(i + 1) } }} aria-label={`배너 ${i + 1}로 이동`}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === realIdx ? 18 : 6, background: i === realIdx ? WT.brand : 'rgba(255,255,255,0.75)' }} />
            ))}
          </div>
          {/* 현재 위치 뱃지 (1/N) */}
          <span className="absolute bottom-3 right-3 z-10 px-2 py-0.5 rounded-full text-[11px] font-bold text-white tabular-nums"
            style={{ background: 'rgba(20,22,28,0.5)', backdropFilter: 'blur(4px)' }}>
            {realIdx + 1}/{n}
          </span>
        </>
      )}
    </div>
  )
}
