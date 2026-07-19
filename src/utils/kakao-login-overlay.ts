/**
 * 🚑 2026-07-10 (로딩 전수조사 후속 — 대표 "카카오 로그인 스플래시도 모두 이상적으로"):
 *   카카오 로그인 시작(전체 페이지 이탈) 순간의 풀스크린 로딩 오버레이 — 공용 SSOT.
 *
 * 왜 순수 DOM 인가: 2026-05-04 사고 — 카카오 클릭 시 React setState → re-render → iOS Safari 가
 *   navigation 을 큐잉하고 freeze. 그래서 렌더 사이클과 무관한 순수 DOM 주입 후 즉시 navigation.
 *
 * 왜 BrandLoader 와 별개 구현이 아닌가(=이상적): 번들 CSS 의 동일 클래스(ur-loader-breathe/sweep)를
 *   그대로 부착하고 BrandLoader.tsx 와 동일한 FCP-기준 음수 animation-delay 를 계산 —
 *   워드마크 치수(34px, 워커 정적 로더와 동일)·바(96×3/38%)·위상까지 픽셀 단위로 일치해
 *   [버튼 탭 → (카카오) → 콜백 BrandLoader → 목적지 로더]가 한 로더처럼 이어진다.
 *   주기 상수(1.5s/1.15s)는 index.css ↔ BrandLoader ↔ 여기 3곳 동기(check-loader-continuity 가드 참조).
 *
 * 사용처: LoginPage(테마 추종) · SellerLoginPage/AgencyLoginPage(라이트 고정 — forceLight).
 * reduced-motion 은 번들 CSS(.ur-loader-* { animation:none })가 처리.
 */

const OVERLAY_ID = 'ur-kakao-loading'

export function showKakaoLoadingOverlay(opts: { forceLight?: boolean; label?: string } = {}): void {
  try {
    if (typeof document === 'undefined' || document.getElementById(OVERLAY_ID)) return
    const isDark = !opts.forceLight && document.documentElement.classList.contains('dark')
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // 🎨 2026-07-19 확정 로고: 워드마크 잉크 = UrDealLogo 와 동일(라이트 네이비 #1A2C42 ↔ 다크 웜화이트 #FAF7F5).
    const bg = isDark ? '#0F151D' : '#ffffff'
    const ink = isDark ? '#FAF7F5' : '#1A2C42'
    const track = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(229,231,235,0.7)' // = dark:bg-white/10 · bg-gray-200/70
    const barInk = opts.forceLight ? '#111827' : '#E0526B'                     // = BrandLoader: forceLight 중립 · 기본/다크 bg-brand
    const sub = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(17,24,39,0.40)'
    // 🎯 위상 전역동기 — BrandLoader.tsx 와 동일 계산(FCP 기준 음수 delay).
    let phaseBase = 0
    try {
      const paints = typeof performance !== 'undefined' ? performance.getEntriesByType('paint') : []
      const fp = paints.find((e) => e.name === 'first-contentful-paint') || paints.find((e) => e.name === 'first-paint')
      if (fp) phaseBase = fp.startTime
    } catch { /* 미지원 — 0 폴백 */ }
    const nowSec = typeof performance !== 'undefined' ? Math.max(0, performance.now() - phaseBase) / 1000 : 0
    const breatheDelay = `-${(nowSec % 1.5).toFixed(3)}s`
    const sweepDelay = `-${(nowSec % 1.15).toFixed(3)}s`
    const o = document.createElement('div')
    o.id = OVERLAY_ID
    o.setAttribute('role', 'alert')
    o.setAttribute('aria-live', 'assertive')
    o.style.cssText = `position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:${bg};${reduce ? '' : 'animation:ur-kakao-fade 0.28s ease both'}`
    // 워드마크 — 워커 정적 로더(urdealLoaderHtml)/UrDealLogo 와 픽셀 동일(34px "urdeal"+로즈 점, 2026-07 확정 로고).
    const logo = document.createElement('div')
    logo.className = 'ur-loader-breathe'
    logo.setAttribute('aria-label', 'urdeal — 유어딜')
    logo.style.cssText = `animation-delay:${breatheDelay};display:inline-flex;align-items:baseline;font-family:'Poppins','Pretendard Variable',system-ui,sans-serif;font-weight:800;font-size:34px;line-height:1;letter-spacing:-0.035em;color:${ink}`
    logo.appendChild(document.createTextNode('urdeal'))
    const dot = document.createElement('span')
    dot.style.cssText = 'display:inline-block;width:6.12px;height:6.12px;background:#E0526B;border-radius:50%;margin-left:2.72px'
    logo.appendChild(dot)
    // 진행 바 — BrandLoader 와 동일(96×3, 38% 세그먼트, 번들 sweep 클래스 + 위상 delay).
    const bar = document.createElement('div')
    bar.style.cssText = `position:relative;width:96px;height:3px;border-radius:999px;background:${track};overflow:hidden`
    const seg = document.createElement('div')
    seg.className = 'ur-loader-sweep'
    seg.style.cssText = `animation-delay:${sweepDelay};position:absolute;top:0;bottom:0;left:0;width:38%;border-radius:999px;background:${barInk}`
    bar.appendChild(seg)
    const tx = document.createElement('div')
    tx.style.cssText = `color:${sub};font-size:12.5px;font-weight:500;letter-spacing:0.01em`
    tx.textContent = opts.label || '로그인 중이에요'
    o.appendChild(logo); o.appendChild(bar); o.appendChild(tx)
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
