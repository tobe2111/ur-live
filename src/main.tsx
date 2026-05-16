// 🛡️ 2026-04-28: 카카오톡 인앱 강제 외부 브라우저 redirect (흰화면 + 무한 reload 회피)
//   *반드시* React/i18n/sentry 등 import 보다 먼저 실행 (모듈 로딩 자체 차단 위해).
import { autoRedirectKakaoToExternal, detectInAppBrowser } from '@/lib/in-app-browser'
const _kakaoRedirected = autoRedirectKakaoToExternal()

// 🛡️ 2026-05-07: Safari Date 파싱 글로벌 정상화.
//   원인: SQLite datetime() / CURRENT_TIMESTAMP 가 'YYYY-MM-DD HH:MM:SS' (공백) 반환.
//     - Chrome/Firefox: 로컬 TZ 로 관대하게 파싱
//     - Safari (iOS/macOS): **Invalid Date** → toLocaleString() = "Invalid Date" 표시,
//       getTime() = NaN → 카운트다운/정렬/시간 비교 모두 깨짐.
//   코드 95곳이 가드 없이 `new Date(백엔드_문자열)` 직접 호출 → mass migration 위험.
//   해결: Date 생성자 wrap 으로 SQLite 형식 입력만 자동 ISO 변환 (T + Z 추가).
//   다른 입력 (number / ISO / no args / Date) 은 변환 없이 통과 — side effect 0.
try {
  const _OrigDate = Date
  function PatchedDate(this: unknown, ...args: unknown[]) {
    if (args.length === 1 && typeof args[0] === 'string') {
      const s = args[0]
      // 'YYYY-MM-DD HH:MM[:SS][.sss]' (공백) → ISO 'T...Z'. 이미 T 또는 timezone 있으면 패스.
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) && !/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
        args[0] = s.replace(' ', 'T') + 'Z'
      }
    }
    if (!(this instanceof PatchedDate)) {
      // Date(...) called as function (without `new`) — 원본 동작 그대로
      return (_OrigDate as unknown as (...a: unknown[]) => string)(...args)
    }
    // @ts-ignore — Reflect.construct preserves prototype chain
    return Reflect.construct(_OrigDate, args, PatchedDate)
  }
  PatchedDate.prototype = _OrigDate.prototype
  PatchedDate.now = _OrigDate.now
  PatchedDate.parse = _OrigDate.parse
  PatchedDate.UTC = _OrigDate.UTC
  // @ts-ignore — global override
  globalThis.Date = PatchedDate as unknown as DateConstructor
} catch { /* Date 패치 실패해도 앱은 계속 — 기존 코드 그대로 동작 */ }

// 🛡️ 2026-05-06: localStorage / sessionStorage throw-safe 글로벌 가드.
//   원인: Safari private mode (iOS<14), 카카오/네이버 인앱 webview, sandboxed iframe,
//   ITP 차단, quota 초과 시 setItem/getItem 이 SecurityError/QuotaExceededError throw.
//   코드 395곳이 가드 없이 직접 `localStorage.xxx` 호출 → 한 곳만 throw 해도
//   React tree 전체 unmount → 흰화면 사고. Storage.prototype 한 번만 패치해
//   모든 호출지점이 자동 보호됨 (코드 변경 0건).
//   getItem 실패 → null 반환 (정상 미존재 시와 동일). setItem/removeItem 실패 → 무시.
try {
  const wrap = (proto: Storage | null) => {
    if (!proto) return
    const origGet = proto.getItem
    const origSet = proto.setItem
    const origRemove = proto.removeItem
    proto.getItem = function (k) { try { return origGet.call(this, k) } catch { return null } }
    proto.setItem = function (k, v) { try { origSet.call(this, k, v) } catch { /* quota/security — silent */ } }
    proto.removeItem = function (k) { try { origRemove.call(this, k) } catch { /* silent */ } }
  }
  wrap(window.localStorage)
  wrap(window.sessionStorage)
} catch { /* Storage 자체가 없는 환경 — 무시 */ }


import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ThemeProvider from '@/components/ThemeProvider'
import './index.css'
import './i18n' // ✅ i18n 초기화
import { logRegionInfo, isKorea } from '@/shared/config/region'
// ✅ Week 5 Day 2: 런타임 환경 변수 검증
import { validateEnvForRuntime } from '@/shared/config/env-validator'
import { initNativeFeatures, isNative } from '@/lib/native'
import { swallow } from '@/shared/utils/swallow'
import { processAuthCallbackParams } from '@/utils/auth-callback-bootstrap'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// 🛡️ 2026-05-01 (D fix): 카카오 OAuth callback URL 파라미터 → localStorage.
//   React mount 전 동기 처리로 ProtectedRoute 첫 render 통과 보장.
//   try-catch 로 감싸서 처리 실패해도 React 마운트는 진행 (흰화면 방지).
try {
  processAuthCallbackParams()
} catch (err) {
  if (import.meta.env.DEV) console.error('[main] auth callback bootstrap failed:', err)
}

// 다른 인앱(네이버/페북/IG/라인 등) 감지 → App 단 배너로 안내 (강제 redirect 안 함)
;(window as { __urInAppBrowser?: string | null }).__urInAppBrowser = detectInAppBrowser()

// 🛡️ 2026-05-07: dynamic import (lazy chunk) 로드 실패 자동 복구.
//   원인: 새 배포 후 사용자 브라우저는 옛 HTML 가지고 있음 → 옛 HTML 이 참조하는 옛 chunk
//   해시 (e.g. SellerPage-Dnxck7Qn.js) 가 새 빌드에 없어 404 → React lazy() throw.
//   처리: 같은 세션에서 1회만 자동 reload (무한 reload 차단 sessionStorage 가드).
//   Sentry 에는 noisy 한 chunk-load 에러 안 올림 (빌드 사이 정상 케이스).
window.addEventListener('error', (e) => {
  const msg = String(e.message || '')
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('error loading dynamically imported module')) {
    try {
      const k = '__ur_chunk_reload__'
      if (sessionStorage.getItem(k)) return // 이미 1회 시도 — 무한 reload 차단
      sessionStorage.setItem(k, '1')
      window.location.reload()
    } catch { /* sessionStorage 차단 환경 — silent */ }
  }
})
window.addEventListener('unhandledrejection', (e) => {
  const msg = String((e.reason as { message?: string })?.message || '')
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('error loading dynamically imported module')) {
    try {
      const k = '__ur_chunk_reload__'
      if (sessionStorage.getItem(k)) return
      sessionStorage.setItem(k, '1')
      window.location.reload()
    } catch { /* silent */ }
  }
})

// 카카오 외부브라우저 redirect 시도했으면 React 마운트 skip (이미 외부 브라우저로 이동 중)
if (!_kakaoRedirected) {

// ✅ 런타임 환경 변수 검증 — throw 해도 React 마운트는 진행 (흰화면 방지)
try {
  validateEnvForRuntime(isKorea() ? 'KR' : 'GLOBAL')
} catch (err) {
  console.error('[main] env validation failed:', err)
}

// Sentry 초기화 (lazy — 262KB 번들 차단 방지)
import('./lib/sentry').then(m => m.initSentry()).catch(swallow('main:sentry-init'))

// Region 정보 (개발 환경)
if (import.meta.env.DEV) {
  try { logRegionInfo() } catch { /* ignore */ }
}

// 빌드 버전 자동 감지 & 자동 리로드
import('@/lib/version-check').then(({ startVersionCheck }) => startVersionCheck()).catch(swallow('main:version-check'))

// 🛡️ 2026-04-29: Web Vitals (LCP/CLS/INP) Sentry 추적 — 프로덕션만, lazy.
//   sentry init 후 (1초 deferred) PerformanceMonitor 시작 — 초기 LCP 측정 누락 방지.
if (import.meta.env.PROD) {
  setTimeout(() => {
    import('@/lib/performance-monitor').then(({ PerformanceMonitor }) => {
      PerformanceMonitor.trackPageLoad('app')
    }).catch(swallow('main:perf-monitor'))
  }, 1000)
}

// 🛡️ iOS Safari web: visualViewport API 로 키보드 감지 → body.keyboard-open 클래스 토글.
//   기존 Capacitor 핸들러는 native 앱 전용. 웹 Safari/Chrome 모바일 에서도 동일 동작 필요.
//   100px threshold = 키보드 외 다른 viewport 변화(주소창 등) 와 구분.
try {
  if (typeof window !== 'undefined' && 'visualViewport' in window) {
    const vv = window.visualViewport!
    let isOpen = false
    const handler = () => {
      const opened = vv.height < window.innerHeight - 100
      if (opened !== isOpen) {
        isOpen = opened
        document.body.classList.toggle('keyboard-open', opened)
        document.documentElement.style.setProperty(
          '--keyboard-height',
          opened ? `${window.innerHeight - vv.height}px` : '0px'
        )
      }
    }
    vv.addEventListener('resize', handler)
    vv.addEventListener('scroll', handler)
  }
} catch { /* noop */ }

// 🛡️ 2026-05-04 (perf): GTM lazy load — React mount 후 idle 시점에 로드해
//   초기 페이로드 ~100KB 차단 회피 (iPhone Safari freeze 완화).
if (import.meta.env.PROD) {
  const loadGTM = () => {
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-B1ST2L37CM'
    s.onload = () => { try { window.gtag?.('config', 'G-B1ST2L37CM') } catch { /* */ } }
    document.head.appendChild(s)
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadGTM, { timeout: 4000 })
  } else {
    setTimeout(loadGTM, 2500)
  }
}

// 🚨 2026-04-27 (긴급 롤백): PWA SW 가 OAuth redirect 차단 → 모든 페이지 ERR_FAILED.
// 🛡️ 2026-04-28: push-sw.js (push-only, fetch 핸들러 없음) 는 보호.
// 🛡️ 2026-05-16 영구 fix: pwa-sw.js 도 unregister 대상 추가.
//   원인: pwa-sw.js v1 (cache-first) 가 사용자 폰에 old chunk 캐시 → 새 빌드 후
//   무한 로딩 / 콘솔 empty / MIME type 오류 사고 (2026-05-16).
//   해결: pwa-sw.js 도 강제 unregister + 모든 ur-pwa-* 캐시 삭제.
//        PWA 설치 가능성보다 안정성이 우선. push-sw.js 만 보호.
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => {
        const scriptUrl = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ''
        // push-sw.js 만 보호 (push 알림 전용, fetch handler 없음)
        if (scriptUrl.includes('push-sw.js')) return
        r.unregister().catch(swallow('main:sw-unregister'))
      })
    }).catch(swallow('main:sw-getRegistrations'))
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => {
        // 모든 캐시 삭제 (ur-pwa-* 포함)
        caches.delete(k)
      })).catch(swallow('main:caches-clear'))
    }
    // pwa-sw.js 등록 제거 — 사고 재발 방지
  }
} catch { /* ignore */ }

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('[App] ❌ Root element not found!')
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100dvh; background: #fbfbfd;">
      <div style="text-align: center; padding: 2rem;">
        <h1 style="color: #dc2626; margin-bottom: 1rem;">앱 초기화 실패</h1>
        <p style="color: #6e6e73;">Root element를 찾을 수 없습니다.</p>
        <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #007aff; color: white; border: none; border-radius: 8px; cursor: pointer;">새로고침</button>
      </div>
    </div>
  `
} else {
  try {
    // ✅ Capacitor 네이티브 앱 감지 → html class 추가
    if (isNative()) {
      document.documentElement.classList.add('native-app')
    }
    // ✅ 네이티브 기능 초기화 (스플래시, 상태바, 푸시, 딥링크)
    try { initNativeFeatures() } catch (e) { console.error('[main] native init failed:', e) }

    // ✅ React StrictMode 제거 (중복 마운트 방지)
    ReactDOM.createRoot(rootElement).render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    )

    // 🛡️ 2026-05-15: Web Vitals 자동 수집 (1% sampling, KV 카운터로 0원 운영)
    import('./lib/web-vitals-report').then(m => m.reportWebVitals()).catch(() => { /* silent */ })
  } catch (error) {
    console.error('[App] ❌ React 렌더링 실패:', error)
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100dvh; background: #fbfbfd;">
        <div style="text-align: center; padding: 2rem;">
          <h1 style="color: #dc2626; margin-bottom: 1rem;">앱을 표시할 수 없어요</h1>
          <p style="color: #6e6e73; font-size: 14px; margin-bottom: 12px;">브라우저 환경이 호환되지 않을 수 있습니다.</p>
          <p style="color: #8e8e93; font-size: 12px; word-break: break-all;">${String(error)}</p>
          <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #007aff; color: white; border: none; border-radius: 8px; cursor: pointer;">새로고침</button>
        </div>
      </div>
    `
  }
}

} // end if (!_kakaoRedirected)
