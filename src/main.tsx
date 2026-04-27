import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n' // ✅ i18n 초기화
import { logRegionInfo, isKorea } from '@/shared/config/region'
// ✅ Week 5 Day 2: 런타임 환경 변수 검증
import { validateEnvForRuntime } from '@/shared/config/env-validator'
import { initNativeFeatures, isNative } from '@/lib/native'

// ✅ 런타임 환경 변수 검증 (Week 5 Day 2)
validateEnvForRuntime(isKorea() ? 'KR' : 'GLOBAL')

// Sentry 초기화 (lazy — 262KB 번들 차단 방지)
import('./lib/sentry').then(m => m.initSentry()).catch(() => {})

// Region 정보 (개발 환경)
if (import.meta.env.DEV) logRegionInfo()

// 빌드 버전 자동 감지 & 자동 리로드
import('@/lib/version-check').then(({ startVersionCheck }) => startVersionCheck())

// 🚨 2026-04-27 (긴급 롤백): PWA SW 가 OAuth redirect 차단 → 모든 페이지 ERR_FAILED.
//   "FetchEvent resulted in a network error: a redirected response was used for
//   a request whose redirect mode is not 'follow'"
//   원인: vite-plugin-pwa 의 navigateFallback 가 카카오 OAuth redirect 도 가로챔.
//   해결: 모든 SW 강제 unregister. 사용자 한 번 새로고침하면 정상 복구.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => {
      r.unregister().catch(() => {})
    })
  }).catch(() => {})
  // 캐시도 모두 삭제 (SW 가 이전 응답 캐싱했으면 OAuth 재현)
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
  }
}

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
    initNativeFeatures()

    // ✅ React StrictMode 제거 (중복 마운트 방지)
    ReactDOM.createRoot(rootElement).render(
      <App />
    )
  } catch (error) {
    console.error('[App] ❌ React 렌더링 실패:', error)
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fbfbfd;">
        <div style="text-align: center; padding: 2rem;">
          <h1 style="color: #dc2626; margin-bottom: 1rem;">React 렌더링 실패</h1>
          <p style="color: #6e6e73;">${error}</p>
          <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #007aff; color: white; border: none; border-radius: 8px; cursor: pointer;">새로고침</button>
        </div>
      </div>
    `
  }
}

