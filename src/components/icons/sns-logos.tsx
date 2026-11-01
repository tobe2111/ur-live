/**
 * 🔗 SNS 플랫폼 로고 — 유튜브 · 인스타그램 · 틱톡 (2026-11-01)
 *
 * 유어샵 머리(`CuratorHeader`)에 인라인으로 있던 세 SVG 를 그대로 옮겼다 — 체험 연동 목록이
 * 같은 로고를 쓰게 되면서 **두 벌이 되면 갈리기 때문**이다(path 를 복사하면 한쪽만 고치는 날이 온다).
 *
 * 🎨 **단색이다**(`currentColor`). 플랫폼 공식 컬러를 쓰지 않는 것은 의도다 — 유어딜은 강조색이
 *    하나(브랜드 블루)이고, 로고 셋이 각자 제 색을 내면 그 줄에서 가장 먼저 읽히는 것이 남의 브랜드가 된다.
 */
export type SnsLogoProps = { size?: number; className?: string }

export function YouTubeLogo({ size = 15, className }: SnsLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
    </svg>
  )
}

export function InstagramLogo({ size = 15, className }: SnsLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.7" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TikTokLogo({ size = 15, className }: SnsLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 3c.3 2.2 1.6 3.9 3.8 4.1v2.6c-1.3.1-2.5-.3-3.8-1v5.7c0 4.4-3.4 6.9-6.9 5.8-3.2-1-4.1-5-1.7-7.2 1-.9 2.4-1.3 3.8-1.1v2.7c-.4-.1-.8-.1-1.2 0-1.2.3-1.7 1.4-1.3 2.5.4 1.1 1.8 1.5 2.7.7.5-.4.7-1 .7-1.7V3h3.9Z" />
    </svg>
  )
}

/** 플랫폼 키 → 로고. `SeedingPlatform`('instagram'|'youtube'|'tiktok')과 같은 키를 쓴다. */
export const SNS_LOGO = { youtube: YouTubeLogo, instagram: InstagramLogo, tiktok: TikTokLogo } as const
