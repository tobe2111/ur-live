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

/**
 * 🔄 저장본을 보여 주는 동안 맨 위에 가는 브랜드색 진행 띠를 띄운다 — 유튜브·인스타가 옛 화면 위에서 새로고침하는 모양.
 *   (2026-11-09 대표 *"A로 하고 새로고침이 되듯 하면 안되나? 유튜브나 인스타, 페이스북도 그런 것 같던데"*)
 *   돌려주는 함수를 부르면 띠가 끝까지 차고 사라진다. 저장본이 아닌 문서에선 아무것도 안 그린다.
 */
export function showShellRefreshBar(): () => void {
  try {
    if (!isShellCacheServed() || document.getElementById('ur-shell-refresh')) return () => {}
    const bar = document.createElement('div')
    bar.id = 'ur-shell-refresh'
    bar.setAttribute('aria-hidden', 'true')
    bar.style.cssText = 'position:fixed;top:0;left:0;height:2px;width:30%;background:var(--brand,#1C69EF);z-index:2147483000;pointer-events:none;transition:width .9s ease-out,opacity .3s ease .2s;'
    document.body.appendChild(bar)
    requestAnimationFrame(() => { bar.style.width = '80%' })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      bar.style.width = '100%'
      bar.style.opacity = '0'
      setTimeout(() => { try { bar.remove() } catch { /* 무시 */ } }, 600)
    }
    setTimeout(finish, 8000) // 어떤 이유로든 안 끝나면 8초 뒤 걷는다
    return finish
  } catch { return () => {} }
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
  applyShellSwTestFlag() // 같은 로드에서 `?__shellsw=1` 이 바로 먹게 — 이 호출이 main 의 렌더 뒤 호출보다 먼저 올 수 있다(라이브 실측: 첫 로드에 등록이 안 됐다)
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
    }
    // 저장소는 등록을 찾았든 못 찾았든 지운다 — 2026-11-09 실측: 다른 코드가 먼저 unregister 해 두면 `mine` 이 없어 저장본이 남았다.
    try { if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.filter((k) => k.startsWith('ur-shell-')).map((k) => caches.delete(k))) } } catch { /* 무시 */ }
  } catch (e) { swallow('shell-sw:sync')(e) }
}
