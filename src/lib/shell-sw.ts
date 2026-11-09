/**
 * 🏠 Shell SW 등록·해제 (2026-11-09 대표 승인 — 결재 docs/decisions/2026-11-09-revisit-instant-shell.md)
 *
 * 켜지는 조건 **둘 중 하나**:
 *   ① `platform_settings.shell_sw_enabled = 'true'`(`/api/consumer-settings` 가 실어 준다 · 어드민 킬스위치 · **기본 OFF**)
 *   ② 시험용 표식 `localStorage.ur_shell_sw_test = '1'` — `?__shellsw=1` 로 켜고 `?__shellsw=0` 으로 끈다.
 *      전체에 켜기 전에 **세션이 자기 폰에서만** 카카오 로그인·결제 복귀를 확인하기 위한 문이다.
 * 꺼져 있으면(둘 다 아님) 등록돼 있던 SW 에 `ur-shell-off` 를 보내 저장소 삭제 + 자기 해제.
 *
 * ⚠️ `main.tsx` 의 옛 SW 청소(2026-05-16)는 `push-sw.js` 와 `shell-sw.js` 만 남긴다 — 거기 예외가 없으면 매 로드마다
 *    이 SW 를 지우고 reload 루프에 빠진다(가드가 대조한다).
 */
import { swallow } from '@/shared/utils/swallow'

export const SHELL_SW_URL = '/shell-sw.js'
export const SHELL_SW_TEST_KEY = 'ur_shell_sw_test'
export const SHELL_CACHE_META = 'ur-shell-cache'

/** 이 문서가 SW 저장본에서 왔나 — 저장본에만 `<meta name="ur-shell-cache">` 가 있다(SW 가 끼운다). */
export function isShellCacheServed(): boolean {
  try { return !!document.querySelector(`meta[name="${SHELL_CACHE_META}"]`) } catch { return false }
}

/** `?__shellsw=1|0` 을 읽어 시험 표식을 켜고 끈다. 주소에서 그 파라미터를 지운다. */
export function applyShellSwTestFlag(): void {
  try {
    const u = new URL(window.location.href)
    const v = u.searchParams.get('__shellsw')
    if (v === null) return
    if (v === '1') localStorage.setItem(SHELL_SW_TEST_KEY, '1'); else localStorage.removeItem(SHELL_SW_TEST_KEY)
    u.searchParams.delete('__shellsw')
    window.history.replaceState(window.history.state, '', u.toString())
  } catch { /* 주소 접근 불가 */ }
}

function testFlagOn(): boolean {
  try { return localStorage.getItem(SHELL_SW_TEST_KEY) === '1' } catch { return false }
}

async function settingOn(): Promise<boolean> {
  try {
    const r = await fetch('/api/consumer-settings', { credentials: 'same-origin' })
    const j = await r.json() as { data?: { shell_sw_enabled?: unknown } }
    return j?.data?.shell_sw_enabled === true
  } catch { return false }
}

/** 한가할 때 한 번. 켜져 있으면 등록, 아니면 있던 것을 해제한다. */
export async function syncShellServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const on = testFlagOn() || await settingOn()
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    const mine = regs.find((r) => ((r.active || r.waiting || r.installing)?.scriptURL || '').includes(SHELL_SW_URL))
    if (on) {
      if (!mine) await navigator.serviceWorker.register(SHELL_SW_URL, { scope: '/' })
      return
    }
    if (mine) {
      const w = mine.active || mine.waiting || mine.installing
      try { w?.postMessage({ type: 'ur-shell-off' }) } catch { /* 무시 */ }
      await mine.unregister().catch(swallow('shell-sw:unregister'))
      try { if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.filter((k) => k.startsWith('ur-shell-')).map((k) => caches.delete(k))) } } catch { /* 무시 */ }
    }
  } catch (e) { swallow('shell-sw:sync')(e) }
}
