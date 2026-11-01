import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { useHomeBanners, type HomeBanner } from '@/components/home/useHomeBanners'
import { BannerWrap, bannerLink } from '@/components/home/HomeBannerStrip'

/**
 * 🖥️ PC 홈 맨 위 — 큰 배너 1장 + 오른쪽 작은 배너 2장 (2026-10-14 대표 확정 "시안 4" — 위는 시안 3).
 *
 * 대표: *"시안은 2번과 3번이 섞이면 좋겠는데? 위 배너 부분은 3번이 마음에 들어"* → *"응 일단 이렇게 만들까?"*.
 * 이 자리는 종전 PC 의 두 블록을 **함께** 대체한다:
 *   ① 히어로(색면 + 위치 칩 + 사진 띠, `HomeHeroBanner`) — 위치 칩은 아래 탐색 영역 왼쪽 필터로 옮겼다
 *   ② 상단 배너(한 줄 세 장, `HomeBannerStrip variant="strip"`) — 같은 배너(`strip` 자리)를 여기서 그린다
 * 모바일 홈은 그대로다(같은 `strip` 배너를 2:1 한 장씩 넘긴다).
 *
 * ## 세 자리가 같은 배너 목록을 돈다
 * 큰 자리 = i번째, 작은 자리 = i+1 · i+2번째(끝에서는 처음으로 돈다). 화살표·자동 넘김이 i 를 옮기면
 * 세 자리가 같이 한 칸씩 간다 — 그래서 오른쪽 두 장이 곧 "다음에 올 배너" 미리보기다.
 *   - 1장이면 큰 자리만(오른쪽 열이 없다 — 빈 칸을 만들지 않는다), 2장이면 오른쪽 한 장.
 *   - 0장이면 아무것도 안 그린다(대표 확정 규칙 "올리지 않으면 아예 보이지 않도록").
 *
 * ## 자동 넘김 — 모바일 띠와 같은 규칙
 * 4.5초마다 한 칸. 마우스가 올라가 있거나 키보드 포커스가 안에 있으면 멈추고, 멈춤 버튼이 있다
 * (WCAG 2.2.2 — 5초 넘게 움직이는 것은 멈출 수 있어야 한다). `prefers-reduced-motion` 이면 안 움직인다.
 *
 * 📏 글자: 큰 배너 제목 24 · 설명 15, 작은 배너 17 · 12 (2026-10-14 대표 *"배너 속 글자 크기들이 커"* 로 정한 값).
 */
const AUTO_MS = 4500

function reducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function Slide({ b, big, eager, hidden }: { b: HomeBanner; big: boolean; eager: boolean; hidden?: boolean }) {
  const src = b.image_url ? cfImage(b.image_url, { width: big ? 1100 : 560, quality: 76 }) : ''
  return (
    <BannerWrap
      link={bannerLink(b)}
      clone={hidden}
      className="absolute inset-0 flex flex-col justify-end isolate overflow-hidden rounded-2xl px-6 pb-5"
      style={src ? undefined : { background: 'var(--brand-grad)' }}
    >
      {src && (
        <img
          src={src} alt="" aria-hidden="true"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          className="absolute inset-0 -z-10 w-full h-full object-cover"
          onError={(e) => cfImageOnError(e.currentTarget, b.image_url)}
        />
      )}
      {src && <div className="absolute inset-x-0 bottom-0 h-[70%] -z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent" aria-hidden="true" />}
      <strong className={`block max-w-[70%] font-bold leading-[1.25] tracking-[-.02em] line-clamp-2 text-white dark:text-white [text-shadow:0_1px_8px_rgba(0,0,0,.25)] ${big ? 'text-[24px]' : 'text-[17px]'}`}>{b.title}</strong>
      {b.description && (
        <span className={`block max-w-[70%] mt-1 line-clamp-1 text-white/90 dark:text-white/90 ${big ? 'text-[15px]' : 'text-[12px]'}`}>{b.description}</span>
      )}
    </BannerWrap>
  )
}

export default function PcHeroBanners() {
  const banners = useHomeBanners('strip').slice(0, 5)
  const n = banners.length
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hover, setHover] = useState(false)
  const reduce = useRef(reducedMotion()).current

  // 배너 수가 줄면(어드민이 내림) 인덱스를 되감는다 — 없는 장을 가리키면 빈 칸이 된다.
  useEffect(() => { if (i >= n && n > 0) setI(0) }, [i, n])

  useEffect(() => {
    if (n < 2 || paused || hover || reduce) return
    const t = window.setInterval(() => setI((v) => (v + 1) % n), AUTO_MS)
    return () => window.clearInterval(t)
  }, [n, paused, hover, reduce])

  if (n === 0) return null
  const at = (k: number) => banners[((i + k) % n + n) % n]
  const go = (d: number) => setI((v) => ((v + d) % n + n) % n)
  const side = n >= 3 ? [1, 2] : n === 2 ? [1] : []

  return (
    <section
      aria-roledescription="carousel"
      aria-label="기획전 배너"
      className={`grid gap-4 h-[clamp(240px,24vw,340px)] ${side.length ? 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : 'grid-cols-1'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
    >
      <div className="relative min-w-0">
        {/* 큰 자리 — 장마다 겹쳐 두고 보이는 장만 불투명(교차 페이드). 안 보이는 장은 탭 순서에서 뺀다. */}
        {banners.map((b, k) => (
          <div key={b.id} className={`absolute inset-0 transition-opacity duration-500 ${k === i ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} aria-hidden={k !== i}>
            <Slide b={b} big eager={k === 0} hidden={k !== i} />
          </div>
        ))}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="이전 배너"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[2] w-10 h-10 rounded-full bg-white/90 dark:bg-white/90 text-gray-900 dark:text-gray-900 flex items-center justify-center shadow-lift hover:bg-white dark:hover:bg-white">
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="다음 배너"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[2] w-10 h-10 rounded-full bg-white/90 dark:bg-white/90 text-gray-900 dark:text-gray-900 flex items-center justify-center shadow-lift hover:bg-white dark:hover:bg-white">
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="absolute right-4 bottom-4 z-[2] flex items-center gap-1">
              {!reduce && (
                <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? '자동 넘김 다시 켜기' : '자동 넘김 멈추기'}
                  className="w-7 h-7 rounded-full bg-black/45 dark:bg-black/45 text-white dark:text-white flex items-center justify-center">
                  {/* 멈춤 표시는 막대 둘(아이콘 봉투에 pause 를 들이지 않으려고 — 홈 첫 페인트 청크 규칙) */}
                  {paused ? <Play className="w-3 h-3" aria-hidden="true" /> : <span className="flex gap-[3px]" aria-hidden="true"><i className="block w-[3px] h-3 rounded-sm bg-white dark:bg-white" /><i className="block w-[3px] h-3 rounded-sm bg-white dark:bg-white" /></span>}
                </button>
              )}
              <span className="h-7 px-3 rounded-full bg-black/45 dark:bg-black/45 text-white dark:text-white text-[12px] font-medium tabular-nums inline-flex items-center" aria-live="polite">
                {i + 1} / {n}
              </span>
            </div>
          </>
        )}
      </div>
      {side.length > 0 && (
        <div className={`grid gap-4 min-w-0 ${side.length === 2 ? 'grid-rows-2' : 'grid-rows-1'}`}>
          {side.map((k) => {
            const b = at(k)
            return <div key={`${k}-${b.id}`} className="relative min-h-0"><Slide b={b} big={false} eager={false} /></div>
          })}
        </div>
      )}
    </section>
  )
}
