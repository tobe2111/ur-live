/**
 * 🚑 2026-07-10 (로딩 전수조사 후속 — 대표 "카카오 로그인 스플래시도 모두 이상적으로"):
 *   카카오 로그인 시작(전체 페이지 이탈) 순간의 풀스크린 로딩 오버레이 — 공용 SSOT.
 *
 * 왜 순수 DOM 인가: 2026-05-04 사고 — 카카오 클릭 시 React setState → re-render → iOS Safari 가
 *   navigation 을 큐잉하고 freeze. 그래서 렌더 사이클과 무관한 순수 DOM 주입 후 즉시 navigation.
 *
 * ⏳ 2026-11-02 (대표 — 로딩 화면 = 위쪽 얇은 막대 + 화면 모양): 로고·왕복 막대를 걷고 **같은 막대**(`shared/brand-loader-markup.ts`)
 *   를 순수 DOM 으로 붙인다. 다음 화면이 카카오(남의 화면)라 화면 모양은 그리지 않고(rows 0) 가운데 한 줄만 둔다.
 *   위상은 BrandLoader 와 같은 첫 페인트 기준 음수 delay(`loaderPhaseVars`) — 콜백에서 BrandLoader 로 넘어가도 막대가 이어진다.
 *
 * 사용처: LoginPage(테마 추종) · SellerLoginPage/AgencyLoginPage(라이트 고정 — forceLight).
 * reduced-motion 은 막대 문자열 안 규칙이 처리.
 */

import { brandLoaderMarkup, loaderPhaseVars } from '@/shared/brand-loader-markup'

const OVERLAY_ID = 'ur-kakao-loading'

export function showKakaoLoadingOverlay(opts: { forceLight?: boolean; label?: string } = {}): void {
  try {
    if (typeof document === 'undefined' || document.getElementById(OVERLAY_ID)) return
    const isDark = !opts.forceLight && document.documentElement.classList.contains('dark')
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const bg = isDark ? '#11141C' : '#ffffff'
    const sub = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(17,24,39,0.40)'
    let since = 0
    try {
      const paints = typeof performance !== 'undefined' ? performance.getEntriesByType('paint') : []
      const fp = paints.find((e) => e.name === 'first-contentful-paint') || paints.find((e) => e.name === 'first-paint')
      since = typeof performance !== 'undefined' ? Math.max(0, performance.now() - (fp ? fp.startTime : 0)) / 1000 : 0
    } catch { /* 미지원 — 0 */ }
    const o = document.createElement('div')
    o.id = OVERLAY_ID
    o.setAttribute('role', 'alert')
    o.setAttribute('aria-live', 'assertive')
    o.style.cssText = `position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:${bg};${reduce ? '' : 'animation:ur-kakao-fade 0.28s ease both'}`
    for (const [k, v] of Object.entries(loaderPhaseVars(since))) o.style.setProperty(k, v)
    o.innerHTML = brandLoaderMarkup(0)
    const tx = document.createElement('div')
    tx.style.cssText = `color:${sub};font-size:13px;font-weight:500`
    tx.textContent = opts.label || '로그인 중이에요'
    o.appendChild(tx)
    if (!document.getElementById('ur-kakao-spin-kf')) {
      const st = document.createElement('style'); st.id = 'ur-kakao-spin-kf'
      st.textContent = '@keyframes ur-kakao-fade{from{opacity:0}to{opacity:1}}'
      document.head.appendChild(st)
    }
    document.body.appendChild(o)
  } catch { /* 오버레이 실패가 navigation 막지 않음 */ }
}

/** 실패 경로(navigation 취소)에서 오버레이 제거 — 호출부 catch 에서 사용. */
export function removeKakaoLoadingOverlay(): void {
  try { document.getElementById(OVERLAY_ID)?.remove() } catch { /* noop */ }
}
