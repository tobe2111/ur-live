import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { useHomeBanners, type HomeBanner } from './useHomeBanners'
import type { BannerSlot } from '@/shared/constants/home-showcase'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'

/**
 * 🏠 ③ 중간 배너 (2026-08-04 대표 시안 승인).
 *
 * `inline` = 3열 프로모션, `wide` = 가로 전체 한 줄. 섹션 사이에 놓인다.
 *
 * 📐 **가로 여백(max-w·px)은 갖지 않는다** — 홈 컨테이너 안에 놓이므로 여기서 또 주면
 *    안쪽으로 한 겹 더 들어가 다른 블록과 좌우가 어긋난다. 세로는 **아래쪽(pb)만** —
 *    위가 아니라 아래여야 아무것도 안 그려질 때 유령 여백이 남지 않는다.
 *
 * 🚫 **등록된 배너가 없으면 아무것도 안 그린다**(대표 확정 규칙 — "올리지 않으면 아예
 *    보이지 않도록"). 제목만 남거나 회색 자리가 생기지 않고 레이아웃이 위로 붙는다.
 *
 * 배경은 이미지가 있으면 이미지, 없으면 잉크 톤 단색이다. 배너 문구가 사진 위에서
 * 안 읽히는 사고를 막으려고 어두운 오버레이를 항상 깐다 — 어떤 사진이 올라올지 모른다.
 */

/** 스트립 항목 사이 간격(px). 위 `gap-2` 와 **같은 값이어야** 점 계산이 맞는다. */
const STRIP_GAP_PX = 8

function bannerHref(b: HomeBanner): string {
  return b.link_url ? safeInternalPath(b.link_url, '') : ''
}

function Wrap({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return href
    ? <Link to={href} className={className}>{children}</Link>
    : <div className={className}>{children}</div>
}

export default function HomeBannerStrip({ variant }: { variant: Extract<BannerSlot, 'strip' | 'inline' | 'wide'> }) {
  const banners = useHomeBanners(variant)
  if (banners.length === 0) return null

  /**
   * 🎫 2026-09-05 (대표 "인기 이용권 섹션 위에 배너가 작게" → 시안 **안 3 확정**):
   *   첫 섹션 **위** 옆으로 넘기는 스트립. 렌더는 `StripRail`(아래) 이 맡는다.
   *   ⚠️ 안 2(가로 카드)로 먼저 만들었다가 대표 확정으로 안 3 으로 바꿨다 — 안 2 를 되살리지 말 것.
   */
  if (variant === 'strip') {
    return <StripRail banners={banners.slice(0, 5)} />
  }

  if (variant === 'wide') {
    const b = banners[0]
    const href = bannerHref(b)
    const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.wide.requestWidth, quality: 76 }) : ''
    return (
      <div className="pb-6">
        <Wrap
          href={href}
          className="relative block overflow-hidden rounded-xl isolate min-h-[104px] flex items-center justify-between gap-5 px-6 py-5 bg-gray-900 dark:bg-[#1D1F29] transition-transform hover:scale-[1.004]"
        >
          {bg && <img src={bg} alt="" aria-hidden="true" className="absolute inset-0 -z-10 w-full h-full object-cover" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 to-black/25" aria-hidden="true" />
          <div className="min-w-0">
            <strong className="block text-[17px] font-black tracking-tight text-white">{b.title}</strong>
            {b.description && <span className="block mt-1 text-[13px] text-white/78">{b.description}</span>}
          </div>
          {href && (
            <span className="shrink-0 px-5 py-2.5 rounded-lg bg-brand text-white text-[13px] font-bold">
              바로가기
            </span>
          )}
        </Wrap>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* 📐 열 수를 **개수에 맞춘다** — 1장을 3열 그리드에 두면 1/3 폭에 홀로 서서
          가로로 긴 홍보 이미지가 잘린다(2026-08-04 대표 신고 화면이 정확히 그랬다). */}
      <div className={`grid gap-3 ${
        banners.length === 1 ? 'grid-cols-1'
        : banners.length === 2 ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}>
        {banners.slice(0, 3).map(b => {
          const href = bannerHref(b)
          const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.inline.requestWidth, quality: 76 }) : ''
          return (
            <Wrap
              key={b.id}
              href={href}
              className="relative block overflow-hidden rounded-xl isolate min-h-[96px] flex flex-col justify-center px-5 py-4 bg-gray-800 dark:bg-[#1D1F29] transition-transform hover:scale-[1.008]"
            >
              {bg && <img src={bg} alt="" aria-hidden="true" className="absolute inset-0 -z-10 w-full h-full object-cover" />}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/62 to-black/38" aria-hidden="true" />
              {b.description && (
                <small className="block mb-1 text-[11px] font-bold tracking-wide text-white/82">{b.description}</small>
              )}
              <strong className="text-[15px] font-bold leading-snug tracking-tight text-white">{b.title}</strong>
            </Wrap>
          )
        })}
      </div>
    </div>
  )
}


/**
 * 🎫 상단 띠 — 옆으로 넘기는 스트립 (2026-09-05 대표 확정 "안 3").
 *
 * ## 왜 JS 캐러셀이 아닌가
 * 네이티브 가로 스크롤 + CSS `scroll-snap` 이면 **라이브러리 0**으로 손가락 감각이 그대로 나온다.
 * 관성·고무줄·접근성(키보드 스크롤)까지 브라우저가 이미 갖고 있는 것을 다시 만들 이유가 없다.
 * 자동 재생은 **하지 않는다** — 첫 화면에서 저절로 움직이는 것은 읽는 사람을 방해하고,
 * 그 순간 무엇을 보고 있었는지 사용자가 통제할 수 없게 된다.
 *
 * ## 한 장일 때는 스트립이 아니다
 * 한 장을 74% 폭으로 두면 오른쪽에 아무것도 없는 빈 자리가 생기고, 점 하나짜리 인디케이터가
 * 덩그러니 남는다(시안에서 이 점을 안 3 의 약점으로 적었다). ⇒ **한 장이면 꽉 채우고 점을 안 그린다.**
 * 두 장부터 74% + 다음 장 살짝 보이기 + 점.
 */
function StripRail({ banners }: { banners: HomeBanner[] }) {
  const railRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const many = banners.length > 1

  /** 점은 스크롤 위치에서 파생한다 — 상태를 따로 들고 있으면 손가락과 어긋난다. */
  const onScroll = () => {
    const el = railRef.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const step = first.offsetWidth + STRIP_GAP_PX
    const i = Math.round(el.scrollLeft / step)
    setActive(Math.max(0, Math.min(banners.length - 1, i)))
  }

  return (
    <div className="pb-4">
      <div
        ref={railRef}
        onScroll={many ? onScroll : undefined}
        className={`flex gap-2 ${many ? 'overflow-x-auto snap-x snap-mandatory scrollbar-hide' : ''}`}
      >
        {banners.map((b) => {
          const href = bannerHref(b)
          const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.strip.requestWidth, quality: 76 }) : ''
          return (
            <Wrap
              key={b.id}
              href={href}
              className={`relative ${many ? 'snap-start shrink-0 basis-[74%]' : 'flex-1'} overflow-hidden rounded-xl isolate h-24 flex flex-col justify-center px-4 py-3 bg-brand transition-transform active:scale-[.995]`}
            >
              {bg && (
                <img
                  src={bg} alt="" aria-hidden="true" loading="lazy"
                  className="absolute inset-0 -z-10 w-full h-full object-cover"
                  onError={(e) => cfImageOnError(e.currentTarget, b.image_url)}
                />
              )}
              {/* 어떤 사진이 올라올지 모른다 — 글자가 안 읽히는 사고를 막으려고 항상 덮는다. */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/62 to-black/28" aria-hidden="true" />
              {b.description && (
                <small className="block text-[10.5px] font-bold text-white/80 truncate">{b.description}</small>
              )}
              <strong className="block mt-0.5 text-[15px] font-extrabold leading-snug tracking-tight text-white line-clamp-2">{b.title}</strong>
            </Wrap>
          )
        })}
      </div>
      {many && (
        <div className="flex justify-center gap-1 pt-2" aria-hidden="true">
          {banners.map((b, i) => (
            <span
              key={b.id}
              className={`h-[5px] rounded-full transition-all ${i === active ? 'w-3 bg-gray-900 dark:bg-white' : 'w-[5px] bg-gray-300 dark:bg-white/25'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
