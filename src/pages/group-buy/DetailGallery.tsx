import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEAL_HERO_VT } from '@/lib/deal-view-transition'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Z } from '@/constants/z-index'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getWarmImage } from '@/utils/image-warm'
import {
  DETAIL_DESKTOP_QUERY, DETAIL_HERO_DESKTOP_WIDTH, DETAIL_HERO_MOBILE_WIDTH, DETAIL_THUMB_WIDTH,
  DETAIL_PC_HERO_RATIO_MULTI, DETAIL_PC_HERO_RATIO_SINGLE, DETAIL_PC_THUMB_RATIO,
  detailCropUrl, detailHeroMobileUrl, detailPlainUrl,
  DETAIL_MOBILE_THUMBS, DETAIL_MOBILE_THUMB_CLS, DETAIL_MOBILE_THUMB_RATIO, DETAIL_MOBILE_THUMB_ROW_CLS,
  detailMobileThumbUrl, showMobileThumbs,
} from '@/shared/detail-hero-image'

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
  /** 🎬 2026-10-26 — 사진 위에 떠 있는 버튼(매장 영상 등). 대형 사진 **밖**에 두어 버튼 안 버튼이 안 생긴다. */
  overlay?: React.ReactNode
}

/** PC 우측 썸네일 칸 수 — 그루폰은 2칸. 그 이상은 `+N` 으로 접는다. */
const PC_THUMBS = 2

export default function DetailGallery({ images: rawImages, alt, badges, fallback, overlay }: Props) {
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const touchX = useRef<number | null>(null)
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
  /**
   * 🧵 2026-09-02 (대표 "사진 로딩이 느리다 · 클릭하면 반응이 늦다"): URL 을 **SSOT 한 곳**에서 만든다.
   *   라이브 워터폴에서 같은 히어로를 세 변형(preload 900 · 감시 <img> 1200 · 슬라이드 900×600 크롭)으로
   *   받고 있었다 — 08-31 크롭 도입 때 슬라이드만 바뀌고 나머지 둘은 옛 폭에 남아서다. 함수가 하나면
   *   갈릴 수 없다(`shared/detail-hero-image` — 워커 preload 도 같은 함수를 쓴다).
   */
  const heroUrl = detailHeroMobileUrl

  /**
   * 🔥 두 겹 배경 — `url(고해상), url(카드에서 이미 받은 것)`. 앞이 위다. 아래 겹은 브라우저 캐시라
   *   클릭 즉시 그려지고, 위 겹이 도착하면 덮는다(추가 요청 0 — `utils/image-warm`).
   */
  const layered = (hi: string, src: string) => {
    const lo = getWarmImage(src)
    return lo && lo !== hi ? `url("${hi}"), url("${lo}")` : `url("${hi}")`
  }

  /**
   * 🖥️ PC 사진 URL — **여기 한 곳**에서 만든다. 배경(`bg`)과 감시 `<img>`(`probes`)가 같은 함수를
   *   부르므로 URL 이 갈릴 수 없다(갈리면 브라우저가 재사용을 못 해 요청이 두 배가 된다).
   */
  const pcHeroUrl = (src: string) =>
    detailCropUrl(src, DETAIL_HERO_DESKTOP_WIDTH, multi ? DETAIL_PC_HERO_RATIO_MULTI : DETAIL_PC_HERO_RATIO_SINGLE)
  const pcThumbUrl = (src: string) => detailCropUrl(src, DETAIL_THUMB_WIDTH, DETAIL_PC_THUMB_RATIO)

  const bg = (src: string, url: string) => ({
    backgroundColor: '#1D1F29',
    backgroundImage: src ? layered(url, src) : undefined,
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
   * 않고 진짜 추가 트래픽이 된다(PC 대형 1200 · 썸네일 600 · 모바일은 3:2 크롭 900 한 장).
   */
  const isDesktop = useMediaQuery(DETAIL_DESKTOP_QUERY)
  const probes = useMemo(() => {
    const list: Array<{ src: string; url: string }> = []
    if (!main) return list
    // 📱 모바일은 숨은 프로브가 **필요 없다** — 2026-10-11 부터 슬라이드를 진짜 <img> 로 그리므로
    //    그 <img> 자신의 onError 가 죽은 사진을 잡는다(그 전엔 CSS 배경이라 오류 이벤트가 없어서
    //    같은 URL 의 1×1 숨은 <img> 를 따로 얹어야 했다). PC 는 아직 배경이라 프로브가 그대로 필요하다.
    if (!isDesktop) return list
    list.push({ src: main, url: pcHeroUrl(main) })
    for (const t of images.slice(1, 1 + PC_THUMBS)) list.push({ src: t, url: pcThumbUrl(t) })
    return list
  }, [main, images, isDesktop])

  return (
    <>
      {/* 화면에 보이지 않는다. 위 `bg()` 와 **같은 URL** 이라 브라우저가 요청을 재사용한다(추가 트래픽 0).
          실패하면 그 사진을 목록에서 빼고 다음 사진이 자동으로 그 자리에 올라온다. */}
      {probes.map(({ src, url }) => (
        <img
          key={url}
          src={url}
          alt=""
          aria-hidden="true"
          loading="eager"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          onError={() => setDead((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))}
        />
      ))}

      {/* 📱 모바일 — 기존 스와이프 갤러리(불변). */}
      <div className={`relative lg:hidden`}>
        <div ref={galRef} onScroll={onGalScroll} className="scrollbar-hide" style={{ display: 'flex', overflowX: 'auto', aspectRatio: '3/2', scrollSnapType: 'x mandatory' }}>
          {(has ? images : ['']).map((src, i) => {
            // 💰 보이는 장면 ±1 만 받는다. 이전엔 5장을 한꺼번에 요청해(각 136~220KB, 콜드 2~4s)
            //    첫 사진이 나머지 넷과 대역폭을 나눴다 — 카드(`DealCardMedia` seen 집합)와 같은 원칙.
            const near = Math.abs(i - active) <= 1
            const hi = src && near ? heroUrl(src, DETAIL_HERO_MOBILE_WIDTH) : ''
            return (
              <div key={i} className="flex items-center justify-center text-[60px]"
                /* 🎬 2026-11-02 시안 D3: 목록 카드 사진이 이 첫 장으로 이어져 커진다(lib/deal-view-transition). */
                data-vt-hero={i === 0 ? '' : undefined}
                role={src ? 'button' : undefined} aria-label={src ? '사진 크게 보기' : undefined}
                onClick={() => { if (src) { setActive(i); setLightbox(true) } }}
                /* ⚠️ position 은 **인라인**이다 — 절대배치 <img> 의 포함 블록은 구조 요건이라
                   유틸 클래스(`relative`)가 번들에 있느냐에 맡기지 않는다. 서버 첫 화면도 같은 자리. */
                style={{ position: 'relative', flex: '0 0 100%', scrollSnapAlign: 'center',
                  viewTransitionName: i === 0 ? DEAL_HERO_VT : undefined,
                  backgroundColor: '#1D1F29',
                  /* 🔥 두 겹 배경은 **밑깔개로 남긴다** — 카드에서 이미 받은 저해상이 클릭 즉시 그려지고,
                     그 위에 아래 <img> 가 도착하면 덮는다(종전과 같은 체감, 추가 요청 0). */
                  backgroundImage: hi ? layered(hi, src) : undefined,
                  backgroundSize: 'cover', backgroundPosition: 'center' }}>
                {/* 🔎 2026-10-11 (대표 "허가 — 진행"): 배경이 아니라 **진짜 <img>** 로 그린다.
                    구글 이미지는 CSS 배경을 못 본다 — 그래서 이 사진이 *목록 페이지*(제목이 일반적인)
                    에만 귀속되고, 정작 제목이 이용권 명칭인 이 상세 페이지엔 붙지 못했다.
                    ⚠️ URL 은 위 배경 윗겹과 **같은 함수·같은 값**이라 요청이 재사용된다(추가 트래픽 0). */}
                {hi && (
                  <img
                    src={hi}
                    alt={alt}
                    loading="eager"
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    decoding="async"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setDead((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))}
                  />
                )}
                {!src && fallback}
              </div>
            )
          })}
        </div>
        {badges}
        {overlay}
        {multi && (
          <div style={{ position: 'absolute', right: 16, bottom: 19, display: 'flex', alignItems: 'center', gap: 5 }}>
            {images.map((_, i) => (
              <span key={i} style={{ height: 5, borderRadius: 99, transition: 'width .25s, background .25s', width: i === active ? 16 : 5, background: i === active ? '#fff' : 'rgba(255,255,255,.5)' }} />
            ))}
          </div>
        )}
      </div>

      {/* 🖼️ 2026-10-27 (대표 "이용권 상세페이지도 그루폰처럼 … 사진 하나밖에 안 보여"): 모바일 큰 사진 아래
          썸네일 2칸 — 그루폰 모바일 상세. 3장 이상일 때만. 마지막 칸은 남은 장수(+N), 누르면 전체 화면.
          서버 첫 화면(`detail-ssr-body`)도 같은 상수로 같은 줄을 그린다(마운트 때 안 밀린다). */}
      {showMobileThumbs(images.length) && (
        <div className={`lg:hidden ${DETAIL_MOBILE_THUMB_ROW_CLS}`}>
          {images.slice(1, 1 + DETAIL_MOBILE_THUMBS).map((src, i) => {
            const left = images.length - 1 - DETAIL_MOBILE_THUMBS
            const isLast = i === DETAIL_MOBILE_THUMBS - 1 && left > 0
            return (
              <button key={src} type="button" onClick={() => { setActive(i + 1); setLightbox(true) }}
                aria-label={isLast ? `전체 사진 ${images.length}장 보기` : `사진 ${i + 2}번째 크게 보기`}
                className={DETAIL_MOBILE_THUMB_CLS}
                style={{ aspectRatio: String(DETAIL_MOBILE_THUMB_RATIO), ...bg(src, detailMobileThumbUrl(src)) }}>
                {isLast && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-[15px] font-bold">+{left}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* 🖥️ PC — 사진이 여러 장이면 그루폰식 [좌 대형 + 우 썸네일], 1장이면 단일 대형. */}
      <div className="hidden lg:block relative">
        <div className={multi ? 'grid grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-2' : ''}>
          <button
            type="button"
            onClick={() => has && setLightbox(true)}
            aria-label={has ? '사진 크게 보기' : alt}
            className="relative block w-full text-[60px] flex items-center justify-center cursor-zoom-in"
            /* 📐 2026-08-19 (대표 확정 — 상세 1안): 제목·별점이 사진 **위**로 올라갔으므로 사진이
               화면을 통째로 먹으면 안 된다. 1장짜리도 정사각(=800px 높이) 대신 16:9 로 눕힌다.
               모바일 스와이프(위 블록)는 1:1 그대로 — 세로 화면에선 정사각이 맞다. */
            style={{ aspectRatio: multi ? '4 / 3' : '16 / 9', ...bg(main, pcHeroUrl(main)) }}
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
                    style={bg(src, pcThumbUrl(src))}
                  >
                    {isLast && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white text-[13px] font-medium">
                        <span className="text-[17px] font-bold">+{rest}</span>
                        전체 사진 {images.length}장
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {overlay}
      </div>

      {/* 🔍 전체 사진 모달 — 그루폰의 "See all images". */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black lg:bg-black/90 flex items-center justify-center"
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
          <div className="relative w-full max-w-[1100px] px-4" onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null }}
            onTouchEnd={(e) => {
              const x0 = touchX.current; touchX.current = null
              const x1 = e.changedTouches[0]?.clientX
              if (x0 != null && x1 != null && Math.abs(x1 - x0) > 40 && multi) step(x1 < x0 ? 1 : -1)
            }}>
            {/* 🖼️ 2026-08-19 (대표 신고 — "사진이 너무 커서 잘리는 문제" + "사진 클릭 시 안 나오는 문제가 다수"):
                두 결함이 한 줄에 겹쳐 있었다. 이전엔 `aspectRatio: 4/3` 배경(cover)이라
                  ① 1100px 폭 × 4:3 = **825px 높이** → 노트북 화면(뷰포트 ~800)에서 위아래가 화면 밖으로 나갔고,
                  ② `cover` 라 사진 자체도 가장자리가 **잘려** 보였다(전체 사진을 보려고 연 자리인데),
                  ③ 배경 이미지라 **404 여도 오류 이벤트가 없어** 그냥 검은 화면이었다 — "눌러도 안 나온다".
                ⇒ `<img object-contain max-h-[85vh]>` 로 바꾼다: 화면 안에 들어오고, 사진이 안 잘리고,
                  실패하면 onError 로 그 사진을 목록에서 뺀다(다음 사진이 올라온다). */}
            <img
              src={detailPlainUrl(main, 1600)}
              alt={alt}
              className="w-full max-h-[85vh] object-contain rounded-xl bg-black/40"
              onError={() => setDead((prev) => (prev.has(main) ? prev : new Set(prev).add(main)))}
            />
            {multi && (
              <>
                <button type="button" onClick={() => step(-1)} aria-label="이전 사진"
                  className="hidden lg:flex absolute left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white items-center justify-center hover:bg-white/30">
                  <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label="다음 사진"
                  className="hidden lg:flex absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white items-center justify-center hover:bg-white/30">
                  <ChevronRight className="w-6 h-6" aria-hidden="true" />
                </button>
                {/* 📱 그루폰 모바일 — 아래에 큰 흰 원 화살표 + "2 / 8". 손가락으로 넘겨도 된다. */}
                <div className="lg:hidden mt-4 flex items-center justify-between">
                  <button type="button" onClick={() => step(-1)} aria-label="이전 사진"
                    className="w-14 h-14 rounded-full bg-white text-gray-900 flex items-center justify-center">
                    <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                  </button>
                  <span className="px-3 py-2 rounded-md bg-white text-gray-900 text-[15px] font-bold">
                    {Math.min(active, images.length - 1) + 1} / {images.length}
                  </span>
                  <button type="button" onClick={() => step(1)} aria-label="다음 사진"
                    className="w-14 h-14 rounded-full bg-white text-gray-900 flex items-center justify-center">
                    <ChevronRight className="w-6 h-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-3 hidden lg:flex items-center justify-center gap-2 flex-wrap">
                  {images.map((src, i) => (
                    <button key={src} type="button" onClick={() => setActive(i)} aria-label={`${i + 1}번째 사진`}
                      className={`w-14 h-14 rounded-md ${i === active ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'}`}
                      style={bg(src, detailCropUrl(src, 160, 1))} />
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
