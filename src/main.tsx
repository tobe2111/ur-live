// 🛡️ 2026-04-28: 카카오톡 인앱 강제 외부 브라우저 redirect (흰화면 + 무한 reload 회피)
//   *반드시* React/i18n/sentry 등 import 보다 먼저 실행 (모듈 로딩 자체 차단 위해).
import { autoRedirectKakaoToExternal, detectInAppBrowser } from '@/lib/in-app-browser'
const _kakaoRedirected = autoRedirectKakaoToExternal()

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
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
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
    window.requestIdleCallback!(loadGTM, { timeout: 4000 })
  } else {
    setTimeout(loadGTM, 2500)
  }
}

// 🚨 2026-04-27 (긴급 롤백): PWA SW 가 OAuth redirect 차단 → 모든 페이지 ERR_FAILED.
//   "FetchEvent resulted in a network error: a redirected response was used for
//   a request whose redirect mode is not 'follow'"
//   원인: vite-plugin-pwa 의 navigateFallback 가 카카오 OAuth redirect 도 가로챔.
//   해결: 옛 SW 강제 unregister + 캐시 비우기.
//
// 🛡️ 2026-04-28: push-sw.js (push-only, fetch 핸들러 없음) 는 보호.
//   PushNotificationSetup 이 명시적으로 등록한 SW 는 unregister 대상 제외.
// 🛡️ 2026-04-30: pwa-sw.js 도 보호 — PWA installability 위해 등록한 minimal SW.
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => {
        const scriptUrl = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ''
        // push-sw.js / pwa-sw.js 는 보호 (의도적 SW)
        if (scriptUrl.includes('push-sw.js') || scriptUrl.includes('pwa-sw.js')) return
        r.unregister().catch(swallow('main:sw-unregister'))
      })
    }).catch(swallow('main:sw-getRegistrations'))
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => {
        // PWA SW 의 캐시 (ur-pwa-v1) 는 보호
        if (k.startsWith('ur-pwa-')) return
        caches.delete(k)
      })).catch(swallow('main:caches-clear'))
    }

    // 🛡️ 2026-04-30: PWA 설치 가능 만들기 위한 minimal SW 등록.
    //   인앱 webview 면 skip (Kakao webview SW 차단 + OAuth 흐름 보호).
    try {
      // Lazy detect — UA 패턴 minimal check (in-app-browser.ts import 보다 가벼움)
      const ua = navigator.userAgent || ''
      const isInApp = /KAKAOTALK|NAVER\(inapp|FB_IAB|FBAV|FBAN|Instagram|\bLine\/|GSA\/|Bytedance|TikTok/i.test(ua)
      if (!isInApp) {
        navigator.serviceWorker.register('/pwa-sw.js', { scope: '/' })
          .catch((err) => { if (import.meta.env.DEV) console.warn('[PWA SW] register failed:', err) })
      }
    } catch { /* ignore */ }
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
