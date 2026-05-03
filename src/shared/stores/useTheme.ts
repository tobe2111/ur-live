/**
 * 🛡️ 2026-05-02: 사용자 테마 토글 스토어 (CLAUDE.md A안 — 화이트 테마 페이지만 적용).
 *
 * - mode: 'system' | 'light' | 'dark' — 사용자 선호 (localStorage 영속)
 * - applied: 'light' | 'dark' — 실제 화면에 적용된 테마 (mode + 시스템 결합 결과)
 * - 초기값: 'system' (OS prefers-color-scheme 추적)
 *
 * Tailwind 의 `dark:` 변형은 <html class="dark"> 일 때만 활성화됨.
 * FOUC 방지를 위해 첫 렌더 전 (index.html inline script) 에 한 번 적용 후,
 * 이 스토어가 mount 되면서 React 트리에서 다시 동기화한다.
 *
 * 적용 범위: 화이트 테마 페이지 (BrowsePage / CartPage / CheckoutPage /
 *   ProductDetailPage / MyOrdersPage / SearchPage / WishlistPage 등).
 *   다크 테마 (홈/라이브/마이페이지) · 라이트 테마 (셀러/어드민) 는 이미 명시
 *   색상 클래스로 강제되어 있어 dark: 변형 무영향.
 */
import { create } from 'zustand'

export type ThemeMode = 'system' | 'light' | 'dark'
export type AppliedTheme = 'light' | 'dark'

const STORAGE_KEY = 'ur_theme_mode_v1'

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch { /* SSR / private mode */ }
  return 'system'
}

function detectSystemTheme(): AppliedTheme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function resolveApplied(mode: ThemeMode): AppliedTheme {
  return mode === 'system' ? detectSystemTheme() : mode
}

function applyToDocument(_applied: AppliedTheme) {
  // 🛡️ 2026-05-03 (revert): 다크 모드 toggle 비활성화.
  // 사용자 신고: 화이트/다크 테마 구별 모호 (화이트 테마 페이지가 dark 토글로 다크 렌더 → 다크 페이지와 구분 안 됨).
  // 정책 복귀:
  //   - 화이트 테마 페이지 (쇼핑/결제) = 항상 화이트
  //   - 다크 테마 페이지 (홈/마이/라이브) = 항상 다크 (bg-[#020202] 명시 강제, 토글 무영향)
  //   - dark class 항상 제거 → 화이트 페이지의 dark: variants 비활성
  try {
    document.documentElement.classList.remove('dark')
  } catch { /* SSR */ }
}

interface ThemeStore {
  mode: ThemeMode
  applied: AppliedTheme
  setMode: (mode: ThemeMode) => void
  /** 시스템 prefers-color-scheme 변화에 반응. ThemeProvider 가 1회 호출. */
  refreshSystem: () => void
}

const initialMode = readMode()
const initialApplied = resolveApplied(initialMode)
applyToDocument(initialApplied)

export const useTheme = create<ThemeStore>((set, get) => ({
  mode: initialMode,
  applied: initialApplied,
  setMode: (mode) => {
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* quota */ }
    const applied = resolveApplied(mode)
    applyToDocument(applied)
    set({ mode, applied })
  },
  refreshSystem: () => {
    if (get().mode !== 'system') return
    const applied = detectSystemTheme()
    applyToDocument(applied)
    set({ applied })
  },
}))
