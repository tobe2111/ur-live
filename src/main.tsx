// 🛡️ 2026-04-28: 카카오톡 인앱 강제 외부 브라우저 redirect (흰화면 + 무한 reload 회피)
//   *반드시* React/i18n/sentry 등 import 보다 먼저 실행 (모듈 로딩 자체 차단 위해).
import { autoRedirectKakaoToExternal, detectInAppBrowser } from '@/lib/in-app-browser'
const _kakaoRedirected = autoRedirectKakaoToExternal()

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n' // ✅ i18n 초기화
import { logRegionInfo, isKorea } from '@/shared/config/region'
// ✅ Week 5 Day 2: 런타임 환경 변수 검증
import { validateEnvForRuntime } from '@/shared/config/env-validator'
import { initNativeFeatures, isNative } from '@/lib/native'

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
import('./lib/sentry').then(m => m.initSentry()).catch(() => {})

// Region 정보 (개발 환경)
if (import.meta.env.DEV) {
  try { logRegionInfo() } catch { /* ignore */ }
}

// 빌드 버전 자동 감지 & 자동 리로드
import('@/lib/version-check').then(({ startVersionCheck }) => startVersionCheck()).catch(() => {})

// 🛡️ 2026-04-29: Web Vitals (LCP/CLS/INP) Sentry 추적 — 프로덕션만, lazy.
//   sentry init 후 (1초 deferred) PerformanceMonitor 시작 — 초기 LCP 측정 누락 방지.
if (import.meta.env.PROD) {
  setTimeout(() => {
    import('@/lib/performance-monitor').then(({ PerformanceMonitor }) => {
      PerformanceMonitor.trackPageLoad('app')
    }).catch(() => {})
  }, 1000)
}

// 🚨 2026-04-27 (긴급 롤백): PWA SW 가 OAuth redirect 차단 → 모든 페이지 ERR_FAILED.
//   "FetchEvent resulted in a network error: a redirected response was used for
//   a request whose redirect mode is not 'follow'"
//   원인: vite-plugin-pwa 의 navigateFallback 가 카카오 OAuth redirect 도 가로챔.
//   해결: 옛 SW 강제 unregister + 캐시 비우기.
//
// 🛡️ 2026-04-28: push-sw.js (push-only, fetch 핸들러 없음) 는 보호.
//   PushNotificationSetup 이 명시적으로 등록한 SW 는 unregister 대상 제외.
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => {
        const scriptUrl = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ''
        // push-sw.js 는 보호 (push 받기용, fetch 가로채기 없음 → OAuth 안전)
        if (scriptUrl.includes('push-sw.js')) return
        r.unregister().catch(() => {})
      })
    }).catch(() => {})
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
    }
  }
} catch { /* ignore */ }

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('[App] ❌ Root element not found!')
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fbfbfd;">
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
      <App />
    )
  } catch (error) {
    console.error('[App] ❌ React 렌더링 실패:', error)
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fbfbfd;">
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
