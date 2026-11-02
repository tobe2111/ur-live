/**
 * 📱 이용권 상세 — 사진 크게 보기(폰) · 2026-11-02 대표 확정 **B안 "가운데 팝업"**
 *
 * 대표 원문: *"터치 시 나타나는 모습인데 너무 UI가 촌스럽고 옆으로 넘길 때 뜨는 사진이 너무 느려
 * 차라리 팝업처럼 뜨게 하거나"* → 시안 A/B/C 중 B.
 *
 * ## 느렸던 이유 셋(코드 실측) → 고친 방법
 * 1. 넘길 때마다 **1600px 원본을 새로** 받았다 → 폰은 `MOBILE_VIEW_WIDTH`(1080) 로 받는다.
 * 2. 옆 사진을 **미리 받지 않았다** → 지금 ±1 장은 `eager`, 나머지는 `lazy`.
 * 3. 손가락을 **뗀 뒤에야** 사진을 바꿨다(touchend 판정) → 가로 스크롤 스냅이라 손가락을 따라 밀린다.
 * 그리고 사진이 오기 전에도 비어 보이지 않게, 상세 큰 사진에서 **이미 받은 주소**(`heroUrl`)를 밑그림으로 깐다(추가 요청 0).
 *
 * 화면: 어두운 바탕 위 둥근 사진 카드 + 아래 점. 바깥을 누르면 닫히고, 카드 모서리 X 로도 닫힌다.
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/** 폰 크게 보기 사진 폭 — 390px × 3배 화면 ≈ 1170 이라 1080 이면 충분하고 1600 보다 훨씬 가볍다. */
export const MOBILE_VIEW_WIDTH = 1080

export default function DetailLightboxMobile({
  images, active, alt, onActive, onClose, fullUrl, placeholderUrl, onDead,
}: {
  images: string[]
  active: number
  alt: string
  onActive: (i: number) => void
  onClose: () => void
  /** 사진 원본 → 크게 보기 URL */
  fullUrl: (src: string, width: number) => string
  /** 사진 원본 → 상세 큰 사진에서 이미 받은 URL(밑그림) */
  placeholderUrl: (src: string) => string
  onDead: (src: string) => void
}) {
  const rowRef = useRef<HTMLDivElement | null>(null)

  // 열릴 때 누른 사진 자리로 바로 간다(애니메이션 없이 — 첫 장면이 미끄러져 오면 느려 보인다).
  useEffect(() => {
    const el = rowRef.current
    if (el) el.scrollLeft = active * el.clientWidth
    // 열릴 때 한 번만 — 이후는 스크롤이 active 를 정한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 밖(점 누르기·키보드)에서 active 가 바뀌면 그 자리로 민다.
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const cur = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
    if (cur === active) return
    // 오래된 웹뷰엔 요소 scrollTo 가 없다 — 그때는 바로 옮긴다.
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: active * el.clientWidth, behavior: 'smooth' })
    else el.scrollLeft = active * el.clientWidth
  }, [active])

  const onScroll = () => {
    const el = rowRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
    if (i !== active && i >= 0 && i < images.length) onActive(i)
  }

  const multi = images.length > 1

  return (
    <div className="lg:hidden w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
      <div className="relative w-full px-5">
        <div ref={rowRef} onScroll={onScroll} className="scrollbar-hide flex overflow-x-auto rounded-[20px]"
          style={{ scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain' }}>
          {images.map((src, i) => {
            const near = Math.abs(i - active) <= 1
            return (
              <div key={`${i}-${src}`} className="relative shrink-0 w-full bg-black/40"
                style={{ scrollSnapAlign: 'center', aspectRatio: '4 / 5',
                  backgroundImage: `url("${placeholderUrl(src)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <img
                  src={fullUrl(src, MOBILE_VIEW_WIDTH)}
                  alt={alt}
                  loading={near ? 'eager' : 'lazy'}
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-contain bg-black/40"
                  onError={() => onDead(src)}
                />
              </div>
            )
          })}
        </div>
        <button type="button" onClick={onClose} aria-label="닫기"
          className="absolute top-2 right-7 w-11 h-11 flex items-center justify-center">
          <span className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center">
            <X className="w-4 h-4" aria-hidden="true" />
          </span>
        </button>
      </div>
      {multi && (
        <div className="flex items-center gap-1.5" role="tablist" aria-label="사진 고르기">
          {images.map((src, i) => (
            <button key={`d-${i}-${src}`} type="button" role="tab" aria-selected={i === active} aria-label={`${i + 1}번째 사진`}
              onClick={() => onActive(i)} className="h-6 flex items-center">
              <span className={`block h-1.5 rounded-full transition-all ${i === active ? 'bg-white' : 'bg-white/40'}`}
                style={{ width: i === active ? 18 : 6 }} />
            </button>
          ))}
        </div>
      )}
      <span className="text-[12px] text-white/60">{Math.min(active, images.length - 1) + 1} / {images.length}</span>
    </div>
  )
}
