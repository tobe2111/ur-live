import { memo, useCallback, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cfImage, cfSrcSet, cfImageOnError } from '@/utils/cf-image'

/**
 * 🖼️ 2026-08-19 (대표 시안 — 그루폰 카드): 딜 카드의 **이미지 영역 SSOT**.
 *   커버 + 갤러리를 hover 시 좌우 화살표로 넘겨 보는 캐러셀. 홈의 두 카드
 *   (`GroupBuyFeedCard` · 홈 섹션)가 **같은 이 컴포넌트**를 쓴다 — 그래야 "섹션 카드와 피드 카드가
 *   다르다"(대표 신고)가 구조적으로 재발하지 않는다.
 *
 * 🚦 **트래픽 보호가 1원칙** (로딩 최적화 잠금의 정신):
 *   - 한 화면에 카드가 50개다. 갤러리를 전부 미리 받으면 트래픽이 5배가 된다.
 *   - 그래서 **커버(0번)만 즉시 로드**하고, 나머지는 *사용자가 실제로 넘긴 장면*만 `<img>` 로 만든다
 *     (`seen` 집합). hover 만으로는 아무것도 더 받지 않는다 — 화살표를 눌러야 받는다.
 *   - 잠금 항목인 커버의 `loading`/`fetchPriority`/fade-in 은 호출부가 그대로 넘겨 유지한다.
 *
 * ⚠️ 이 컴포넌트는 `<Link>` **안**에 놓인다 → 화살표/도트는 반드시 `preventDefault + stopPropagation`.
 *   안 하면 사진을 넘기려던 클릭이 상세 페이지로 튄다.
 */

export interface DealCardMediaProps {
  /** 커버(대표) 이미지. 없으면 폴백 노드를 그린다. */
  cover?: string | null
  /** 갤러리 — 리스트 API 의 `images`(배열 또는 JSON 문자열 둘 다 허용). 커버와 중복은 제거된다. */
  images?: string[] | string | null
  alt: string
  /** 커버 즉시 로드 여부(above-fold LCP). 기존 카드의 aboveFold 계약 그대로. */
  eager?: boolean
  /** 이미지 폭(px) — cfImage 리사이즈 기준. */
  width?: number
  /** 이미지 없을 때 그릴 폴백(카테고리 이모지 등). */
  fallback?: React.ReactNode
  /** 커버 onLoad — 대표색 추출 등 기존 로직을 호출부가 유지할 수 있게 그대로 전달. */
  onCoverLoad?: (el: HTMLImageElement) => void
  /** 이미지 위에 얹을 배지들(좌상단/우상단). */
  overlay?: React.ReactNode
  className?: string
  /** 종횡비 클래스. 기본 4:3(그루폰). */
  aspectClass?: string
}

function parseImages(raw: string[] | string | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === 'string' && !!u)
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr.filter((u): u is string => typeof u === 'string' && !!u) : []
    } catch { return [] }
  }
  return []
}

/** 카드 캐러셀 최대 장수 — 넘기는 재미는 5장이면 충분하고, 그 이상은 페이로드만 키운다. */
const MAX_SLIDES = 5

function DealCardMedia({
  cover, images, alt, eager = false, width = 400, fallback, onCoverLoad, overlay,
  className = '', aspectClass = 'aspect-[4/3]',
}: DealCardMediaProps) {
  const slides = useMemo(() => {
    const out: string[] = []
    if (cover) out.push(cover)
    for (const u of parseImages(images)) out.push(u)
    return Array.from(new Set(out)).slice(0, MAX_SLIDES)
  }, [cover, images])

  const [idx, setIdx] = useState(0)
  // 실제로 본 장면만 네트워크를 태운다(위 트래픽 보호 주석 참조).
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))

  const go = useCallback((e: React.MouseEvent, delta: number) => {
    // <Link> 안이라 이걸 빼면 사진 넘기기가 페이지 이동이 된다.
    e.preventDefault()
    e.stopPropagation()
    setIdx((cur) => {
      const next = (cur + delta + slides.length) % slides.length
      setSeen((s) => (s.has(next) ? s : new Set(s).add(next)))
      return next
    })
  }, [slides.length])

  const multi = slides.length > 1

  return (
    <div className={`relative ${aspectClass} w-full overflow-hidden group/media ${className}`}>
      {slides.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">{fallback}</div>
      ) : (
        slides.map((src, i) => {
          if (!seen.has(i)) return null
          const isCover = i === 0
          return (
            <img
              key={src}
              src={cfImage(src, { width, format: 'auto' }) || src}
              srcSet={cfSrcSet(src, width) || undefined}
              sizes={`(max-width: 640px) 50vw, (max-width: 1024px) 33vw, ${width}px`}
              alt={isCover ? alt : ''}
              loading={isCover && eager ? 'eager' : 'lazy'}
              fetchPriority={isCover && eager ? 'high' : 'auto'}
              decoding="async"
              onLoad={(e) => {
                const el = e.currentTarget as HTMLImageElement
                el.style.opacity = i === idx ? '1' : '0'
                if (isCover) onCoverLoad?.(el)
              }}
              onError={(e) => cfImageOnError(e.currentTarget, src)}
              style={{ opacity: i === idx ? 1 : 0, transition: 'opacity 220ms ease-out' }}
              className={`absolute inset-0 w-full h-full object-cover ${
                i === idx ? 'transition-transform duration-300 group-hover:scale-[1.03]' : 'pointer-events-none'
              }`}
            />
          )
        })
      )}

      {overlay}

      {/* ◀▶ — 그루폰과 동일하게 **hover 했을 때만** 나타난다(모바일은 터치 시 focus-within 으로 노출).
          갤러리가 1장뿐이면 아예 그리지 않는다(누를 게 없는 버튼은 없는 것보다 나쁘다). */}
      {multi && (
        <>
          <button
            type="button"
            aria-label="이전 사진"
            onClick={(e) => go(e, -1)}
            className="ur-appear absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/70 z-[2]"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="다음 사진"
            onClick={(e) => go(e, 1)}
            className="ur-appear absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/70 z-[2]"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <div className="absolute inset-x-0 bottom-1.5 flex items-center justify-center gap-1 z-[2] pointer-events-none">
            {slides.map((_, i) => (
              <span
                key={i}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === idx ? 10 : 4,
                  background: i === idx ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.55)',
                  boxShadow: '0 0 2px rgba(0,0,0,.35)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default memo(DealCardMedia)
