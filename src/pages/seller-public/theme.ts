/**
 * 🛡️ 2026-05-07: TD-018 분할 — SellerPublicPage 테마 토큰 공유.
 */

export interface ThemeTokens {
  bg: string; card: string; cardAlt: string
  text: string; textSub: string; textMuted: string
  border: string; borderAlt: string
  cover: string
  avatarBorder: string
  input: string
  btnOutline: string
}

export function getThemeTokens(isDark: boolean): ThemeTokens {
  return isDark ? {
    bg: 'bg-[#020202]', card: 'bg-[#121212]', cardAlt: 'bg-[#1A1A1A]',
    text: 'text-white', textSub: 'text-gray-400', textMuted: 'text-gray-500',
    border: 'border-[#1A1A1A]', borderAlt: 'border-[#2A2A2A]',
    cover: 'from-pink-900/50 via-purple-900/40 to-orange-900/30',
    avatarBorder: 'border-[#020202]', input: 'bg-[#121212] text-white',
    btnOutline: 'border-[#2A2A2A] text-gray-300',
  } : {
    bg: 'bg-white', card: 'bg-white', cardAlt: 'bg-gray-50',
    text: 'text-gray-900', textSub: 'text-gray-600', textMuted: 'text-gray-500',
    border: 'border-gray-100', borderAlt: 'border-gray-200',
    cover: 'from-pink-200 via-purple-100 to-orange-100',
    avatarBorder: 'border-white', input: 'bg-gray-50 text-gray-900',
    btnOutline: 'border-gray-200 text-gray-700',
  }
}
