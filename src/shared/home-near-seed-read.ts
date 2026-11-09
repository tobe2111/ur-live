/**
 * 📍 홈 거리순 피드 시드 읽기 (2026-11-09) — 짝: `src/worker/utils/home-near-seed.ts`.
 *   워커가 위치 쿠키의 격자 키로 실은 `<script id="__SSR_INITIAL_MAINNEAR__" data-near="키">` 를,
 *   화면의 격자 키가 **같을 때만** 돌려준다(다르면 undefined → 화면이 종전처럼 받는다).
 */
export const HOME_NEAR_SEED_ID = '__SSR_INITIAL_MAINNEAR__'

export function readHomeNearSeed<T = unknown>(nearKey: string): T[] | undefined {
  try {
    if (typeof document === 'undefined' || !nearKey) return undefined
    const el = document.getElementById(HOME_NEAR_SEED_ID)
    if (!el?.textContent || el.getAttribute('data-near') !== nearKey) return undefined
    const parsed = JSON.parse(el.textContent)
    return Array.isArray(parsed?.data) ? (parsed.data as T[]) : undefined
  } catch {
    return undefined
  }
}
