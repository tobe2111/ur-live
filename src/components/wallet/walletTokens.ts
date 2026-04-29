/**
 * 🛡️ 2026-04-29 v4 Wallet 디자인 토큰 (iOS-style inset grouped lists)
 *
 * MyPage / Orders / Wishlist / Vouchers 4종 페이지 공유 토큰.
 * 다크 우선 적용, 라이트는 향후 테마 토글로 전환 가능.
 *
 * Accent: 핑크-레드 (#EC4899) — ur-live 브랜드 일관성 유지.
 * (디자인 원본은 amber 였으나 사용자 결정으로 핑크 통일)
 */

export type WalletTheme = 'light' | 'dark'

export interface WalletTokens {
  bg: string
  card: string
  cardSub: string
  label: string
  secondary: string
  tertiary: string
  separator: string
  fillSoft: string
  fillSoft2: string
  accent: string
  accentSoft: string
  accentGradient: string
  danger: string
  success: string
  chrome: string
}

export const walletTokens: Record<WalletTheme, WalletTokens> = {
  light: {
    bg:        '#F2F2F7',
    card:      '#FFFFFF',
    cardSub:   '#FFFFFF',
    label:     '#000000',
    secondary: '#8E8E93',
    tertiary:  '#C7C7CC',
    separator: 'rgba(60,60,67,0.12)',
    fillSoft:  'rgba(120,120,128,0.08)',
    fillSoft2: 'rgba(120,120,128,0.16)',
    accent:    '#EC4899',
    accentSoft:'rgba(236,72,153,0.12)',
    accentGradient: 'linear-gradient(135deg, #EF4444, #EC4899)',
    danger:    '#FF3B30',
    success:   '#34C759',
    chrome:    '#FFFFFF',
  },
  dark: {
    bg:        '#020202',
    card:      '#1C1C1E',
    cardSub:   '#2C2C2E',
    label:     '#FFFFFF',
    secondary: '#98989F',
    tertiary:  '#48484A',
    separator: 'rgba(84,84,88,0.34)',
    fillSoft:  'rgba(118,118,128,0.24)',
    fillSoft2: 'rgba(118,118,128,0.36)',
    accent:    '#EC4899',
    accentSoft:'rgba(236,72,153,0.18)',
    accentGradient: 'linear-gradient(135deg, #EF4444, #EC4899)',
    danger:    '#FF453A',
    success:   '#30D158',
    chrome:    '#0A0A0A',
  },
}

export function useWalletTokens(theme: WalletTheme = 'dark'): WalletTokens {
  return walletTokens[theme]
}
