/**
 * 🛡️ 2026-04-29 v4 Glass 디자인 토큰 (라이브/쇼츠 페이지 공유)
 *
 * Live Studio · Glassmorphism + Shorts Boutique 톤 통합.
 * v4/live.jsx · v4/shorts.jsx 의 9개 glass 변형 패턴 중앙화.
 *
 * 사용:
 *   import { glass } from '@/components/glass/glassTokens'
 *   <div style={glass.actionRail}>...</div>
 *
 * 영상 위 floating UI 에 사용. 다크 배경 가정.
 */

import type { CSSProperties } from 'react'

const blur = (px: number, sat = 140) => ({
  backdropFilter: `blur(${px}px) saturate(${sat}%)`,
  WebkitBackdropFilter: `blur(${px}px) saturate(${sat}%)`,
})

export const glass: Record<string, CSSProperties> = {
  /** 40×40 dark glass action rail (좋아요 / 상품 / 채팅 / 공유 등) */
  actionRail: {
    background: 'rgba(0,0,0,0.40)',
    ...blur(8),
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
    color: '#fff',
  },

  /** 우측 nav 좌측 nav 의 dark glass pill (셀러 정보 pill 등) */
  navPill: {
    background: 'rgba(0,0,0,0.45)',
    ...blur(12),
  },

  /** 시청자 수 / 좋아요 등 stats glass chip */
  statsChip: {
    background: 'rgba(255,255,255,0.08)',
    ...blur(16),
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
  },

  /** 채팅 input bar — chatOpen 일 때 표시 */
  chatBar: {
    background: 'rgba(0,0,0,0.45)',
    ...blur(12),
    border: '1px solid rgba(255,255,255,0.15)',
  },

  /** 큰 panel — 후원 랭킹 / 상품 시트 등 */
  panel: {
    background: 'rgba(18,18,20,0.55)',
    ...blur(28, 150),
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 36px rgba(0,0,0,0.5)',
  },

  /** 다시보기 play 글래스 원 (44×44 중앙) */
  playCircle: {
    background: 'rgba(255,255,255,0.18)',
    ...blur(24),
    border: '1px solid rgba(255,255,255,0.30)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 18px rgba(0,0,0,0.35)',
  },

  /** LIVE 빨강 둥근 칩 */
  liveBadge: {
    background: 'rgba(239,68,68,0.92)',
    ...blur(12),
  },

  /** scheduled 시간 chip (blue) */
  scheduledChip: {
    background: 'rgba(59,130,246,0.14)',
    border: '1px solid rgba(59,130,246,0.30)',
  },
}

/**
 * Boutique 흰 product card — Live + Shorts 공유.
 * className 으로 사용 권장. style 객체로도 노출.
 */
export const boutiqueCard: CSSProperties = {
  background: 'rgba(255,255,255,0.97)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
}

/** Boutique label strip — 옅은 핑크 그라디언트 배경 */
export const boutiqueLabel: CSSProperties = {
  background: 'linear-gradient(90deg, rgba(239,68,68,0.08), rgba(236,72,153,0.08))',
}

/** Boutique 바로구매 CTA — 빨→핑크 gradient */
export const boutiqueCTA: CSSProperties = {
  background: 'linear-gradient(135deg, #EF4444, #EC4899)',
}
