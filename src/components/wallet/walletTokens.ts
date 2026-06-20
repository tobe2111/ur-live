/**
 * 🛡️ 2026-04-29 v4 Wallet 디자인 토큰 (iOS-style inset grouped lists)
 *
 * MyPage / Orders / Wishlist / Vouchers 4종 페이지 공유 토큰.
 * 다크 우선 적용, 라이트는 향후 테마 토글로 전환 가능.
 *
 * Accent: 잉크 블랙 (#0A0A0A light / #FFFFFF dark) — 2026-06-20 지갑 흑백 iOS-클린
 *   리디자인(`docs/design/my-vouchers-wallet-bw.md`, 사용자 결정 "지갑 전체 잉크 통일")로
 *   기존 핑크-레드(#EC4899) → 잉크 통일. onAccent = accent 필 위 텍스트 색(라이트 흰/다크 잉크).
 *   (이전: amber → 핑크 → 현재 잉크)
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
  onAccent: string
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
    accent:    '#0A0A0A',
    accentSoft:'rgba(10,10,10,0.06)',
    accentGradient: 'linear-gradient(135deg, #1A1A1A, #0A0A0A)',
    onAccent:  '#FFFFFF',
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
    accent:    '#FFFFFF',
    accentSoft:'rgba(255,255,255,0.14)',
    accentGradient: 'linear-gradient(135deg, #FFFFFF, #ECECEC)',
    onAccent:  '#0A0A0A',
    danger:    '#FF453A',
    success:   '#30D158',
    chrome:    '#0A0A0A',
  },
}

export function useWalletTokens(theme: WalletTheme = 'dark'): WalletTokens {
  return walletTokens[theme]
}
