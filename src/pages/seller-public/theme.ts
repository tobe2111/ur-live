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
    bg: 'bg-[#0F151D]', card: 'bg-[#1A2334]', cardAlt: 'bg-[#1A2334]',
    text: 'text-white', textSub: 'text-gray-400', textMuted: 'text-gray-500',
    border: 'border-[#2A3446]', borderAlt: 'border-[#2A3446]',
    cover: 'from-gray-900/50 via-gray-900/40 to-gray-900/30',
    avatarBorder: 'border-[#0F151D]', input: 'bg-[#1A2334] text-white',
    btnOutline: 'border-[#2A3446] text-gray-300',
  } : {
    bg: 'bg-white', card: 'bg-white', cardAlt: 'bg-gray-50',
    text: 'text-gray-900', textSub: 'text-gray-600', textMuted: 'text-gray-500',
    border: 'border-gray-100', borderAlt: 'border-gray-200',
    cover: 'from-gray-200 via-gray-100 to-gray-100',
    avatarBorder: 'border-white', input: 'bg-gray-50 text-gray-900',
    btnOutline: 'border-gray-200 text-gray-700',
  }
}
