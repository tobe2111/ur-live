/**
 * 🎬 "다녀온 사람들" 작은 표식 — 플랫폼 네모 · 유어딜 사람 배지. 줄·창이 같이 쓴다.
 * 플랫폼 색은 각 서비스의 표식 색이다(브랜드 토큰이 아니라 출처 표시라 테마와 무관하게 같다).
 */
import type { ContentItem, ContentPlatform } from '@/shared/creator-content'

const MARK: Record<ContentPlatform, { bg: string; ch: string; label: string }> = {
  youtube: { bg: '#FF0033', ch: '▶', label: '유튜브' },
  instagram: { bg: 'linear-gradient(45deg,#F9A13A,#D62976,#6A3FD1)', ch: '◎', label: '인스타그램' },
  tiktok: { bg: '#111111', ch: '♪', label: '틱톡' },
  naver_clip: { bg: '#00C73C', ch: 'N', label: '네이버 클립' },
  naver_blog: { bg: '#03C75A', ch: 'N', label: '네이버 블로그' },
}

export function PlatformMark({ platform, urdeal, className = '' }: { platform: ContentPlatform; urdeal?: boolean; className?: string }) {
  const m = MARK[platform]
  return (
    <span role="img" aria-label={urdeal ? '유어딜' : m.label}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[12px] font-medium leading-none text-white ${className}`}
      style={{ background: urdeal ? 'var(--brand)' : m.bg, fontSize: 9 }}>
      {urdeal ? 'U' : m.ch}
    </span>
  )
}

/** 유어딜 사람이면 배지 문구, 아니면 null. */
export function urdealBadge(i: ContentItem): string | null {
  if (i.urdeal === 'seeding') return '유어딜 체험단'
  if (i.urdeal === 'urshorts') return '유어쇼츠'
  return null
}

export function platformLabel(p: ContentPlatform): string { return MARK[p].label }
