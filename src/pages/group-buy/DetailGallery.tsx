import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cfImage } from '@/utils/cf-image'
import { Z } from '@/constants/z-index'

/**
 * 🖼️ 2026-08-19 (대표 시안 — 그루폰 상세): 이용권 상세 갤러리.
 *
 * **사진이 여러 장일 때만** 그루폰처럼 [좌 대형 + 우 썸네일 스택]으로 편다(PC lg+).
 * 1장이면 예전과 똑같은 단일 대형 — 없는 사진을 있는 척 칸으로 채우지 않는다.
 * 모바일은 손가락으로 넘기는 게 정석이라 **기존 스와이프+도트를 그대로 둔다**(검증된 UX).
 *
 * 썸네일이 4장을 넘으면 마지막 칸에 `+N` 을 얹고, 누르면 전체 사진 모달이 열린다(그루폰의
 * "See all images"). 모달 안에서는 좌우 키/버튼으로 넘긴다.
 */

interface Props {
  images: string[]
  alt: string
  /** 이미지 위에 얹는 배지(할인·카테고리·마감) — 레이아웃마다 위치가 달라 부모가 넘긴다. */
  badges?: React.ReactNode
  /** 사진이 아예 없을 때 그릴 것(카테고리 이모지). */
  fallback?: React.ReactNode
}

/** PC 우측 썸네일 칸 수 — 그루폰은 2칸. 그 이상은 `+N` 으로 접는다. */
const PC_THUMBS = 2

export default function DetailGallery({ images: rawImages, alt, badges, fallback }: Props) {
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const galRef = useRef<HTMLDivElement | null>(null)

  /**
   * 💀 2026-08-19 (대표 확정 B): **원본까지 죽은 사진**을 목록에서 뺀다.
   *
   * 라이브에 실제로 있었다(보드람치킨 id 2822 — 커버 `t1.daumcdn.net/cfile/…` 가 403, 갤러리 4장은 정상).
   * ⚠️ 여기 사진들은 CSS `background-image` 로 그려서 **오류 이벤트가 아예 없다** — 그래서 지금까지
   *    빈 칸으로 남았다. 레이아웃을 건드리지 않고 감지만 하려고, 지금 보이는 사진과 **똑같은 URL** 의
   *    숨은 `<img>` 한 장을 얹는다. 브라우저가 같은 요청을 재사용하므로 **추가 트래픽 0**.
   */
  const [dead, setDead] = useState<Set<string>>(() => new Set())
  const images = useMemo(() => rawImages.filter((u) => !dead.has(u)), [rawImages, dead])

  const has = images.length > 0
  const multi = images.length > 1
  const main = has ? images[Math.min(active, images.length - 1)] : ''

  const onGalScroll = () => {
    const el = galRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== active) setActive(i)
  }

  const step = useCallback((delta: number) => {
    setActive((cur) => (cur + delta + images.length) % images.length)
  }, [images.length])

  // 모달에서 ← → 로 넘기고 Esc 로 닫는다(키보드만 쓰는 사용자도 사진을 다 볼 수 있어야 한다).
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, step])

  /**
   * 🎯 2026-08-31 (대표 승인 — "너가 얘기해준 가장 이상적인 방법들로"): 모바일 히어로 프레임.
   *
   * ## 왜 3:2 인가, 그리고 왜 스마트 크롭인가
   * 원래 정사각(1:1)이었다. 대표가 "지금 비율이 가장 이상적일까? 그루폰은 세로가 짧잖아" 물어
   * **네이버 사진 70장을 직접 쟀다**: 세로가 더 긴 것 37% · 정사각 21% · 4:3 23% · 3:2 11% · 16:9 7%.
   * **중앙값이 정확히 1:1** 이라, 그루폰처럼 16:9 로 가면 열 장 중 여섯이 위아래로 잘려 나간다.
   * ⇒ 프레임은 3:2 로 (가격이 첫 화면에 들어올 만큼 짧고 16:9 보다 덜 잘라낸다),
   *   **자를 위치는 `gravity=auto`** 로 Cloudflare 가 피사체를 찾게 한다. 비율이 제각각인 게
   *   그때부터 문제가 아니게 된다 — 라이브 실측으로 동작 확인(center 대비 다른 곳을 자른다).
   *
   * ⚠️ 프레임을 딜마다 바꾸지 않는다. 높이가 딜마다 다르면 목록→상세가 덜컹거리고 CLS 가 생긴다.
   * ⚠️ PC(대형/썸네일)는 **아직 그대로**다 — 그쪽은 프로브 `<img>` 와 URL 을 공유해 트래픽 0 을
   *   유지하는 구조라(아래 주석), 옵션을 한쪽만 바꾸면 요청이 두 배가 된다. 별도로 다룬다.
   */
  const HERO_RATIO = 3 / 2
  const heroUrl = (src: string, w: number) =>
    cfImage(src, { width: w, height: Math.round(w / HERO_RATIO), fit: 'cover', gravity: 'auto', format: 'auto' }) || src

  const bg = (src: string, w: number) => ({
    backgroundColor: '#1D1F29',
    backgroundImage: src ? `url("${cfImage(src, { width: w, format: 'auto' }) || src}")` : undefined,
    backgroundSize: 'cover' as const,
    backgroundPosition: 'center' as const,
  })

  const rest = images.length - 1 - PC_THUMBS // 썸네일 칸에 다 못 넣고 남는 장수

  /**
   * 🕵️ **지금 화면에 실제로 그려지는 사진 전부**를 감시한다 — 대형 1장 + PC 썸네일 2장.
   *
   * ⚠️ 2026-08-19 정정: 이전 판은 **대형 사진만** 감시했다. 그런데 라이브 실측(활성 50개 · 갤러리
   *   226장)에서 앱 경로로도 죽는 7장 중 **6장이 커버가 아닌 갤러리 사진**이었다 — 즉 실패는
   *   주로 *썸네일 칸*에서 났고, 거기엔 감시가 없어 회색 칸으로 남았다(대표 신고
   *   "눌러보면 사진이 안 뜨는 경우가 있어"). 실패 호스트: 인스타 CDN·siksinhot·daumcdn 등 403,
   *   alba.kr 415.
   *
   * 폭(`width=`)을 **실제 렌더와 같게** 맞춘다 — 다르면 리사이저 URL 이 달라져 요청이 재사용되지
   * 않고 진짜 추가 트래픽이 된다(대형 1200 · 썸네일 600).
   */
  const probes = useMemo(() => {
    const list: Array<{ src: string; w: number }> = []
    if (main) list.push({ src: main, w: 1200 })
    for (const t of images.slice(1, 1 + PC_THUMBS)) list.push({ src: t, w: 600 })
    return list
  }, [main, images])

  return (
    <>
      {/* 화면에 보이지 않는다. 위 `bg()` 와 **같은 URL** 이라 브라우저가 요청을 재사용한다(추가 트래픽 0).
          실패하면 그 사진을 목록에서 빼고 다음 사진이 자동으로 그 자리에 올라온다. */}
      {probes.map(({ src, w }) => (
        <img
          key={`${src}@${w}`}
          src={cfImage(src, { width: w, format: 'auto' }) || src}
          alt=""
          aria-hidden="true"
          loading="eager"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          onError={() => setDead((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))}
        />
      ))}

      {/* 📱 모바일 — 기존 스와이프 갤러리(불변). */}
      <div className={`relative lg:hidden`}>
        <div ref={galRef} onScroll={onGalScroll} className="noscroll" style={{ display: 'flex', overflowX: 'auto', aspectRatio: '3/2', scrollSnapType: 'x mandatory' }}>
          {(has ? images : ['']).map((src, i) => (
            <div key={i} role="img" aria-label={alt} className="flex items-center justify-center text-6xl"
              style={{ flex: '0 0 100%', scrollSnapAlign: 'center',
                backgroundColor: '#1D1F29',
                backgroundImage: src ? `url("${heroUrl(src, 900)}")` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center' }}>
              {!src && fallback}
            </div>
          ))}
        </div>
        {badges}
        {multi && (
          <div style={{ position: 'absolute', right: 16, bottom: 19, display: 'flex', alignItems: 'center', gap: 5 }}>
            {images.map((_, i) => (
              <span key={i} style={{ height: 5, borderRadius: 99, transition: 'width .25s, background .25s', width: i === active ? 16 : 5, background: i === active ? '#fff' : 'rgba(255,255,255,.5)' }} />
            ))}
          </div>
        )}
      </div>

      {/* 🖥️ PC — 사진이 여러 장이면 그루폰식 [좌 대형 + 우 썸네일], 1장이면 단일 대형. */}
      <div className="hidden lg:block relative">
        <div className={multi ? 'grid grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-2' : ''}>
          <button
            type="button"
            onClick={() => has && setLightbox(true)}
            aria-label={has ? '사진 크게 보기' : alt}
            className="relative block w-full text-6xl flex items-center justify-center cursor-zoom-in"
            /* 📐 2026-08-19 (대표 확정 — 상세 1안): 제목·별점이 사진 **위**로 올라갔으므로 사진이
               화면을 통째로 먹으면 안 된다. 1장짜리도 정사각(=800px 높이) 대신 16:9 로 눕힌다.
               모바일 스와이프(위 블록)는 1:1 그대로 — 세로 화면에선 정사각이 맞다. */
            style={{ aspectRatio: multi ? '4 / 3' : '16 / 9', ...bg(main, 1200) }}
          >
            {!has && fallback}
            {/* 배지·그라데이션은 **대형 사진 기준**으로 얹는다(그리드 전체를 덮으면 썸네일까지 어두워진다). */}
            {badges}
          </button>

          {multi && (
            <div className="grid grid-rows-2 gap-2">
              {images.slice(1, 1 + PC_THUMBS).map((src, i) => {
                const isLast = i === PC_THUMBS - 1 && rest > 0
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => (isLast ? setLightbox(true) : setActive(i + 1))}
                    aria-label={isLast ? `전체 사진 ${images.length}장 보기` : `사진 ${i + 2}번째 보기`}
                    className="relative w-full h-full cursor-pointer"
                    style={bg(src, 600)}
                  >
                    {isLast && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white text-[13px] font-bold">
                        <span className="text-[17px] font-extrabold">+{rest}</span>
                        전체 사진 {images.length}장
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 🔍 전체 사진 모달 — 그루폰의 "See all images". */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center"
          style={{ zIndex: Z.MODAL_BODY }}
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} 사진 ${images.length}장`}
        >
          <button type="button" onClick={() => setLightbox(false)} aria-label="닫기"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="relative w-full max-w-[1100px] px-4" onClick={(e) => e.stopPropagation()}>
            {/* 🖼️ 2026-08-19 (대표 신고 — "사진이 너무 커서 잘리는 문제" + "사진 클릭 시 안 나오는 문제가 다수"):
                두 결함이 한 줄에 겹쳐 있었다. 이전엔 `aspectRatio: 4/3` 배경(cover)이라
                  ① 1100px 폭 × 4:3 = **825px 높이** → 노트북 화면(뷰포트 ~800)에서 위아래가 화면 밖으로 나갔고,
                  ② `cover` 라 사진 자체도 가장자리가 **잘려** 보였다(전체 사진을 보려고 연 자리인데),
                  ③ 배경 이미지라 **404 여도 오류 이벤트가 없어** 그냥 검은 화면이었다 — "눌러도 안 나온다".
                ⇒ `<img object-contain max-h-[85vh]>` 로 바꾼다: 화면 안에 들어오고, 사진이 안 잘리고,
                  실패하면 onError 로 그 사진을 목록에서 뺀다(다음 사진이 올라온다). */}
            <img
              src={cfImage(main, { width: 1600, format: 'auto' }) || main}
              alt={alt}
              className="w-full max-h-[85vh] object-contain rounded-xl bg-black/40"
              onError={() => setDead((prev) => (prev.has(main) ? prev : new Set(prev).add(main)))}
            />
            {multi && (
              <>
                <button type="button" onClick={() => step(-1)} aria-label="이전 사진"
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30">
                  <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label="다음 사진"
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30">
                  <ChevronRight className="w-6 h-6" aria-hidden="true" />
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  {images.map((src, i) => (
                    <button key={src} type="button" onClick={() => setActive(i)} aria-label={`${i + 1}번째 사진`}
                      className={`w-14 h-14 rounded-md ${i === active ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'}`}
                      style={bg(src, 160)} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
