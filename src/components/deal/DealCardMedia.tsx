import { memo, useCallback, useMemo, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cfImage, cfSrcSet, cfImageOnError } from '@/utils/cf-image'

/** 스와이프로 칠 최소 가로 이동(px). 이보다 작으면 그냥 탭으로 본다. */
const SWIPE_MIN_PX = 36

/**
 * 🖼️ 2026-08-19 (대표 시안 — 그루폰 카드): 딜 카드의 **이미지 영역 SSOT**.
 *   커버 + 갤러리를 hover 시 좌우 화살표로 넘겨 보는 캐러셀. 홈의 두 카드
 *   (`GroupBuyFeedCard` · 홈 섹션)가 **같은 이 컴포넌트**를 쓴다 — 그래야 "섹션 카드와 피드 카드가
 *   다르다"(대표 신고)가 구조적으로 재발하지 않는다.
 *
 * 🚦 **트래픽 보호가 1원칙** (로딩 최적화 잠금의 정신):
 *   - 한 화면에 카드가 50개다. 갤러리를 전부 미리 받으면 트래픽이 5배가 된다.
 *   - 그래서 **커버(0번)만 즉시 로드**하고, 나머지는 *사용자가 실제로 넘긴 장면*만 `<img>` 로 만든다
 *     (`seen` 집합).
 *   - 🕐 **다만 딱 한 장은 미리 받는다** (2026-08-19 대표 신고 — "화면이 너무 늦게 떠 다른 사진으로
 *     보려고 할 때"). 이전엔 화살표를 **누른 그 순간부터** 다운로드가 시작돼, 누른 뒤 빈 회색 칸을
 *     쳐다보는 시간이 생겼다 — 트래픽 보호가 만든 체감 지연이다. ⇒ 마우스를 올렸을 때(=넘길
 *     의사가 보일 때) **다음 1장만** 받아 둔다. 카드 50개가 아니라 **hover 한 카드에서 +1장**이라
 *     첫 화면 트래픽은 그대로다. 연속으로 넘길 때를 위해 넘긴 뒤에도 그다음 1장을 미리 받는다.
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
  /**
   * 💀 2026-08-19 (대표 확정 B — 라이브 실측): **원본까지 죽은** 장면의 인덱스.
   *
   * 배경: 홈에 사진이 안 뜨는 카드가 있었다(보드람치킨 id 2822). 커버가
   * `t1.daumcdn.net/cfile/…` 인데 그 원본이 **403** 이었고, 정작 갤러리 4장은 멀쩡했다.
   * `cfImageOnError` 는 [리사이저 실패 → 원본 → 숨김] 까지만 하므로 **카드가 그냥 빈 채로** 남았다.
   * ⇒ 죽은 장면을 기억해 두고, 그게 지금 보이는 장면이면 **살아 있는 다음 사진으로 넘어간다.**
   * 데이터를 한 건 고치는 대신 같은 사고 전체를 막는다(대표 판단: "코드로 방어").
   */
  const [dead, setDead] = useState<Set<number>>(() => new Set())

  /** 살아 있는 장면들 — 화살표·도트는 이 목록 위에서만 움직인다(죽은 칸을 세지 않는다). */
  const alive = useMemo(
    () => slides.map((_, i) => i).filter((i) => !dead.has(i)),
    [slides, dead],
  )

  /** 지금 보이는 장면이 죽었으면 살아 있는 첫 장면으로 대체(그 장면은 이제 '본' 것이 된다). */
  const shown = dead.has(idx) ? (alive[0] ?? idx) : idx

  const markDead = useCallback((i: number, isShown: boolean) => {
    setDead((prev) => {
      if (prev.has(i)) return prev
      const next = new Set(prev)
      next.add(i)
      return next
    })
    /**
     * 🚦 대체본은 **지금 화면에 보이던 장면이 죽었을 때만** 받는다.
     *
     * 보이지도 않는 뒷장이 죽었다고 다음 장을 미리 받으면, 사용자가 넘기지도 않은 사진을
     * 네트워크에 태우는 셈이라 이 컴포넌트의 1원칙(본 장면만 로드)이 깨진다.
     * 보이던 장면이 죽은 경우에만 **한 장**을 채운다 — 갤러리를 통째로 받지 않는다.
     */
    if (!isShown) return
    setSeen((sv) => {
      const nextIdx = slides.map((_, k) => k).find((k) => k !== i && !sv.has(k))
      if (nextIdx == null) return sv
      const n = new Set(sv)
      n.add(nextIdx)
      return n
    })
  }, [slides])

  /**
   * 🕐 다음 1장만 미리 받아 둔다 — "넘겼는데 빈 칸" 을 없애는 최소 비용.
   * ⚠️ 전량 프리페치가 아니다. `alive` 기준 **바로 다음 한 장**만 `seen` 에 넣는다.
   */
  const prefetchNext = useCallback(() => {
    setSeen((sv) => {
      const list = slides.map((_, i) => i).filter((i) => !dead.has(i))
      if (list.length < 2) return sv
      const at = Math.max(0, list.indexOf(idx))
      const next = list[(at + 1) % list.length]
      return sv.has(next) ? sv : new Set(sv).add(next)
    })
  }, [slides, dead, idx])

  /** 장면 이동 — 화살표와 스와이프가 **같은 로직**을 쓴다(둘이 갈리면 한쪽만 고쳐진다). */
  const step = useCallback((delta: number) => {
    setIdx((cur) => {
      const list = slides.map((_, i) => i).filter((i) => !dead.has(i))
      if (list.length === 0) return cur
      const at = Math.max(0, list.indexOf(dead.has(cur) ? (list[0] ?? cur) : cur))
      const next = list[(at + delta + list.length) % list.length]
      // 지금 갈 장면 + 같은 방향의 **그다음 한 장**(연속으로 넘겨도 빈 칸이 안 뜨게).
      const after = list[(at + delta * 2 + list.length * 2) % list.length]
      setSeen((sv) => {
        if (sv.has(next) && sv.has(after)) return sv
        const n = new Set(sv); n.add(next); n.add(after); return n
      })
      return next
    })
  }, [slides, dead])

  const go = useCallback((e: React.MouseEvent, delta: number) => {
    // <Link> 안이라 이걸 빼면 사진 넘기기가 페이지 이동이 된다.
    e.preventDefault()
    e.stopPropagation()
    step(delta)
  }, [step])

  const multi = alive.length > 1

  /**
   * 👆 손가락으로 넘기기 (2026-08-27 대표 지시 — "이용권 이미지 썸네일 좌우로 스와이프 되어져야 해").
   *   예전엔 좌우 화살표뿐이라 폰에서는 **작은 버튼을 정확히 눌러야** 넘어갔다.
   *
   *   ⚠️ 카드는 `<Link>` 안이다 — 스와이프를 그냥 두면 손을 떼는 순간 **상세 페이지로 이동**한다.
   *      그래서 넘겼다는 사실을 기억해 두고 이어지는 클릭을 capture 단계에서 취소한다.
   *   ⚠️ `preventDefault` 로 세로 스크롤을 막지 않는다 — **가로 이동이 세로보다 우세할 때만**
   *      스와이프로 친다. 사진 위에서 페이지가 안 내려가면 그게 더 큰 불편이다.
   */
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const didSwipe = useRef(false)
  const onTouchStartMedia = useCallback((e: React.TouchEvent) => {
    prefetchNext()
    const t = e.touches[0]
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null
    didSwipe.current = false
  }, [prefetchNext])
  const onTouchMoveMedia = useCallback((e: React.TouchEvent) => {
    const s0 = touchStart.current
    if (!s0 || !multi) return
    const t = e.touches[0]
    if (!t) return
    const dx = t.clientX - s0.x
    const dy = t.clientY - s0.y
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.2) didSwipe.current = true
  }, [multi])
  const onTouchEndMedia = useCallback((e: React.TouchEvent) => {
    const s0 = touchStart.current
    touchStart.current = null
    if (!s0 || !multi || !didSwipe.current) return
    const t = e.changedTouches[0]
    if (!t) return
    step(t.clientX - s0.x < 0 ? 1 : -1)   // 왼쪽으로 밀면 다음 장
  }, [multi, step])
  const onClickCaptureMedia = useCallback((e: React.MouseEvent) => {
    if (!didSwipe.current) return
    e.preventDefault()
    e.stopPropagation()
    didSwipe.current = false
  }, [])

  return (
    <div
      className={`relative ${aspectClass} w-full overflow-hidden group/media ${className}`}
      onMouseEnter={prefetchNext}
      onTouchStart={onTouchStartMedia}
      onTouchMove={onTouchMoveMedia}
      onTouchEnd={onTouchEndMedia}
      onClickCapture={onClickCaptureMedia}
    >
      {slides.length === 0 || alive.length === 0 ? (
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
                el.style.opacity = i === shown ? '1' : '0'
                if (isCover) onCoverLoad?.(el)
              }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement
                cfImageOnError(el, src)
                // `cfFallback === '2'` = 리사이저도 원본도 실패해 숨긴 상태 = 이 장면은 죽었다.
                if (el.dataset.cfFallback === '2') markDead(i, i === shown)
              }}
              style={{ opacity: i === shown ? 1 : 0, transition: 'opacity 220ms ease-out' }}
              className={`absolute inset-0 w-full h-full object-cover ${
                i === shown ? 'transition-transform duration-300 group-hover:scale-[1.03]' : 'pointer-events-none'
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
            {alive.map((i) => (
              <span
                key={i}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === shown ? 10 : 4,
                  background: i === shown ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.55)',
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
