/**
 * 🛡️ 2026-05-16: SVG 그라디언트 배너 + DB 연동.
 *
 * 어드민이 /admin/banners 에서 등록한 배너를 우선 노출.
 * DB 비었거나 fetch 실패 시 코드 하드코딩 4개 fallback.
 *
 * 이미지 비율 권장 (어드민 가이드):
 *   - 1600x500 (16:5) — 균형
 *   - 또는 1200x420 (≈2.86:1)
 *   - 안전영역 중앙 1120x490 (16:7) 유지하면 모바일 / PC 모두 커버
 *
 * 라이트/다크 양쪽 지원, 페이지네이션 인디케이터.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'

interface Banner {
  title: string
  subtitle: string
  cta: string
  ctaPath: string
  gradient: string         // tailwind 그라디언트 클래스 (image_url 없을 때 fallback)
  decorEmoji: string       // 우측 배경 이모지
  textTone: 'light' | 'dark'  // 텍스트 색상 (배경에 따라)
  imageUrl?: string        // 어드민이 업로드한 이미지 (있으면 그라디언트 대체)
}

interface DBBanner {
  id: number
  title: string
  description: string | null
  image_url: string
  link_url: string | null
}

const BANNERS: Banner[] = [
  {
    title: '카카오맵 후기 작성',
    subtitle: '매장 다녀온 후 후기 작성하면 +1,000딜',
    cta: '내 식권 보기 →',
    ctaPath: '/my-vouchers',
    gradient: 'from-amber-400 via-orange-500 to-pink-500',
    decorEmoji: '⭐',
    textTone: 'light',
  },
  {
    title: '친구 추천 보너스',
    subtitle: '내 추천 링크로 친구가 결제하면 commission',
    cta: '인플 활동 시작 →',
    ctaPath: '/influencer/settlement',
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    decorEmoji: '🎤',
    textTone: 'light',
  },
  {
    title: '딜 포인트 충전',
    subtitle: '미리 충전하고 결제 시 즉시 사용',
    cta: '충전하기 →',
    ctaPath: '/points/charge',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-500',
    decorEmoji: '💎',
    textTone: 'light',
  },
  {
    title: '광고 슬롯 입찰',
    subtitle: '셀러님, 메인 노출 우선권 확보',
    cta: '셀러 입찰 →',
    ctaPath: '/seller/ad-slots',
    gradient: 'from-blue-500 via-indigo-500 to-purple-600',
    decorEmoji: '🚀',
    textTone: 'light',
  },
]

export default function SocarStyleBanner() {
  const [idx, setIdx] = useState(0)
  const [banners, setBanners] = useState<Banner[]>(BANNERS)

  // 🛡️ 2026-05-16: 어드민 등록 배너 fetch — DB 우선, 비어 있으면 fallback BANNERS
  useEffect(() => {
    api.get('/api/banners').then((r) => {
      const list: DBBanner[] = r.data?.banners || r.data?.data || []
      if (Array.isArray(list) && list.length > 0) {
        // 어드민 배너 → SocarStyle 형식으로 매핑 (gradient 는 인덱스 회전)
        const fallbackGradients = BANNERS.map(b => b.gradient)
        const fallbackEmojis = BANNERS.map(b => b.decorEmoji)
        const mapped: Banner[] = list.map((b, i) => {
          // 🛡️ 2026-05-16: link_url 안전 처리 — 빈값 / # anchor / 잘못된 형식 모두 안전 fallback
          let safePath = '/group-buy'  // default: 공구 카탈로그
          const raw = (b.link_url || '').trim()
          if (raw) {
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
              // 외부 URL — 원본 그대로 (아래 anchor 태그로 처리)
              safePath = raw
            } else if (raw.startsWith('#')) {
              // anchor — 같은 페이지 내 스크롤
              safePath = `/${raw}`
            } else if (raw.startsWith('/')) {
              safePath = raw
            } else {
              safePath = `/${raw}`
            }
          }
          return {
            title: b.title || '',
            subtitle: b.description || '',
            cta: '자세히 보기 →',
            ctaPath: safePath,
            gradient: fallbackGradients[i % fallbackGradients.length],
            decorEmoji: fallbackEmojis[i % fallbackEmojis.length],
            textTone: 'light',
            imageUrl: b.image_url,
          }
        })
        setBanners(mapped)
      }
    }).catch(() => { /* fallback BANNERS 그대로 사용 */ })
  }, [])

  const banner = banners[idx] || banners[0]
  const textColor = banner.textTone === 'light' ? 'text-white' : 'text-gray-900'
  const subTextColor = banner.textTone === 'light' ? 'text-white/80' : 'text-gray-700'

  // 🛡️ 2026-05-16: 외부 URL 은 <a target="_blank">, 내부는 <Link> 로 분기
  const isExternal = /^https?:\/\//i.test(banner.ctaPath)
  const LinkComponent = isExternal ? 'a' : Link
  const linkProps = isExternal
    ? { href: banner.ctaPath, target: '_blank', rel: 'noopener noreferrer' }
    : { to: banner.ctaPath }

  return (
    <section className="px-4 py-4">
      <LinkComponent {...(linkProps as any)} className="block">
        {/* 🛡️ 2026-05-16: 반응형 aspect — PC에서 배너가 너무 커지는 문제 fix.
             모바일 (16:7) → sm (21:6 더 짧게) → md+ (28:5 가로 길이 늘림 + 높이 짧게)
             max-h-[280px] 도 안전망. */}
        <div
          className={`relative overflow-hidden rounded-2xl ${banner.imageUrl ? '' : `bg-gradient-to-br ${banner.gradient}`} aspect-[16/7] sm:aspect-[21/6] md:aspect-[28/5] max-h-[280px] p-5 active:scale-[0.98] transition-transform`}
          style={banner.imageUrl ? { backgroundImage: `url(${banner.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          {/* 🛡️ 2026-05-17: 검정 그라데이션 오버레이 제거 (사용자 요청) — 이미지 원본 그대로 노출.
              가독성 필요 시 배너 이미지 자체에 어두운 영역을 포함시키도록 함. */}
          {/* 우측 배경 큰 이모지 (그라디언트 배너만 — 이미지 배너엔 숨김) */}
          {!banner.imageUrl && (
            <>
              <span className="absolute -right-2 -bottom-4 text-[140px] opacity-20 select-none leading-none" aria-hidden>
                {banner.decorEmoji}
              </span>
              <svg className="absolute top-0 right-0 w-32 h-32 opacity-20" viewBox="0 0 100 100" fill="none">
                <circle cx="80" cy="20" r="40" fill="currentColor" className={textColor} />
                <circle cx="60" cy="40" r="20" fill="currentColor" className={textColor} />
              </svg>
            </>
          )}

          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <p className={`text-xl sm:text-2xl font-extrabold ${textColor} leading-tight`}>
                {banner.title}
              </p>
              <p className={`text-xs sm:text-sm ${subTextColor} mt-1.5 leading-snug`}>
                {banner.subtitle}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${textColor} bg-white/20 backdrop-blur px-3 py-1.5 rounded-full`}>
                {banner.cta}
              </span>
              <span className={`text-[11px] ${subTextColor}`}>
                {idx + 1}/{banners.length}
              </span>
            </div>
          </div>
        </div>
      </LinkComponent>

      {/* 페이지네이션 dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {banners.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? 'w-6 bg-pink-500' : 'w-1.5 bg-gray-300 dark:bg-[#2A2A2A]'
            }`}
            aria-label={`배너 ${i + 1}`}
          />
        ))}
      </div>
    </section>
  )
}
