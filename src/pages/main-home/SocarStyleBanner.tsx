/**
 * 🛡️ 2026-05-16: SVG 그라디언트 배너 — 쏘카의 "장거리 편도 요금 인하" 배너 스타일.
 *
 * Claude 가 inline SVG + 그라디언트 + 추상 도형 + 이모지로 디자인 제작.
 * 라이트/다크 양쪽 지원, 페이지네이션 인디케이터.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

interface Banner {
  title: string
  subtitle: string
  cta: string
  ctaPath: string
  gradient: string         // tailwind 그라디언트 클래스
  decorEmoji: string       // 우측 배경 이모지
  textTone: 'light' | 'dark'  // 텍스트 색상 (배경에 따라)
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
  const banner = BANNERS[idx]
  const textColor = banner.textTone === 'light' ? 'text-white' : 'text-gray-900'
  const subTextColor = banner.textTone === 'light' ? 'text-white/80' : 'text-gray-700'

  return (
    <section className="px-4 py-4">
      <Link to={banner.ctaPath} className="block">
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${banner.gradient} aspect-[16/7] p-5 active:scale-[0.98] transition-transform`}>
          {/* 우측 배경 큰 이모지 (장식) */}
          <span className="absolute -right-2 -bottom-4 text-[140px] opacity-20 select-none leading-none" aria-hidden>
            {banner.decorEmoji}
          </span>
          {/* SVG 추상 도형 — 우측 상단 부드러운 원 */}
          <svg className="absolute top-0 right-0 w-32 h-32 opacity-20" viewBox="0 0 100 100" fill="none">
            <circle cx="80" cy="20" r="40" fill="currentColor" className={textColor} />
            <circle cx="60" cy="40" r="20" fill="currentColor" className={textColor} />
          </svg>

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
                {idx + 1}/{BANNERS.length}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* 페이지네이션 dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {BANNERS.map((_, i) => (
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
