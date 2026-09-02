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
    bg: 'bg-[#11141C]', card: 'bg-[#1D1F29]', cardAlt: 'bg-[#1D1F29]',
    text: 'text-white', textSub: 'text-gray-400', textMuted: 'text-gray-500',
    border: 'border-[#2C2F35]', borderAlt: 'border-[#2C2F35]',
    cover: 'from-gray-900/50 via-gray-900/40 to-gray-900/30',
    avatarBorder: 'border-[#11141C]', input: 'bg-[#1D1F29] text-white',
    btnOutline: 'border-[#2C2F35] text-gray-300',
  } : {
    // 🎨 2026-08-30: bg 를 흰색 → 웜 그라운드(#F8F7FC, 브랜드 --bg 토큰).
    // 그전까지 bg 와 card 가 **둘 다 흰색**이라 카드를 구분할 방법이 실선뿐이었고,
    // 그래서 유어샵의 모든 것에 테두리가 붙어 있었다(대표 지적 "테두리가 AI스럽다").
    // 다크 모드는 이미 bg #0F151D ↔ card #1A2334 로 분리돼 있었다 — 라이트만 깨져 있었다.
    // 이제 흰 카드가 웜 바탕 위에 저절로 떠오르므로 실선이 할 일이 없어진다.
    bg: 'bg-warm', card: 'bg-white', cardAlt: 'bg-[#F1ECE8]',
    text: 'text-gray-900', textSub: 'text-gray-600', textMuted: 'text-gray-500',
    border: 'border-gray-100', borderAlt: 'border-gray-200',
    cover: 'from-gray-200 via-gray-100 to-gray-100',
    avatarBorder: 'border-white', input: 'bg-gray-50 text-gray-900',
    btnOutline: 'border-gray-200 text-gray-700',
  }
}
