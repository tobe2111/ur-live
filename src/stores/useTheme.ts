/**
 * 테마 관리 (다크/라이트)
 * localStorage에 저장, 시스템 설정 폴백
 */
import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('ur_theme') as Theme | null
  if (saved === 'dark' || saved === 'light') return saved
  // 시스템 설정 감지
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: typeof window !== 'undefined' ? getInitialTheme() : 'dark',
  setTheme: (theme) => {
    localStorage.setItem('ur_theme', theme)
    set({ theme })
    applyTheme(theme)
  },
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
}))

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add('light-theme')
    root.classList.remove('dark-theme')
  } else {
    root.classList.add('dark-theme')
    root.classList.remove('light-theme')
  }
}

// 초기 적용
if (typeof window !== 'undefined') {
  applyTheme(getInitialTheme())
}
