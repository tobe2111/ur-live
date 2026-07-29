/**
 * 🆕 2026-06-27 유어애즈(UR Ads) 로고 — Spark 심볼 + 워드마크. Single source of truth.
 *
 *   디자인: "UR Ads Logo Spark" / "Handoff Spec" (docs/design/urads/).
 *   심볼 = 4점 스파크(상승/타겟 모티프), 브랜드 그라데이션 #3B6EF5→#8B5CF6→#EC4899.
 *   유어딜(모노크롬)·유통스타트와 시각적으로 구분되는 독립 정체성(코스믹 네이비).
 *
 *   워드마크 색은 부모의 `color` 를 상속(inherit) — 라이트 표면은 잉크, 다크 CTA 위는 흰색.
 */
import { useId } from 'react'

interface UrAdsLogoProps {
  /** 심볼 한 변 px (워드마크 크기는 자동 비례). */
  size?: number
  /** 워드마크("UR Ads") 표시 여부. false 면 심볼만. */
  wordmark?: boolean
  className?: string
}

export default function UrAdsLogo({ size = 26, wordmark = true, className = '' }: UrAdsLogoProps) {
  const gid = useId() // SVG 그라데이션 id 충돌 방지(여러 인스턴스)
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-label="UR Ads">
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#3B6EF5" />
            <stop offset=".55" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <path
          d="M28 8 C28 20 30 24 36 27 C42 30 48 28 48 28 C48 28 42 26 36 29 C30 32 28 36 28 48 C28 36 26 32 20 29 C14 26 8 28 8 28 C8 28 14 30 20 27 C26 24 28 20 28 8 Z"
          fill={`url(#${gid})`}
        />
      </svg>
      {wordmark && (
        <span style={{ fontSize: size * 0.69, fontWeight: 800, letterSpacing: '-.02em', whiteSpace: 'nowrap', color: 'inherit' }}>
          UR Ads
        </span>
      )}
    </span>
  )
}
