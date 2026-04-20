import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n' // ✅ i18n 초기화
import { initSentry } from './lib/sentry'
import { logRegionInfo, isKorea } from '@/shared/config/region'
// ✅ Week 5 Day 2: 런타임 환경 변수 검증
import { validateEnvForRuntime } from '@/shared/config/env-validator'
import { initNativeFeatures, isNative } from '@/lib/native'

// ✅ 런타임 환경 변수 검증 (Week 5 Day 2)
validateEnvForRuntime(isKorea() ? 'KR' : 'GLOBAL')

// ✅ 빌드 버전 자동 감지 & 자동 리로드
// Service Worker + 버전 체크 이중 보호로 옛 번들 고착 완전 차단
import('@/lib/version-check').then(({ startVersionCheck }) => startVersionCheck())

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      reg.update()
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (installing) {
          installing.addEventListener('statechange', () => {
            if (installing.state === 'activated') {
              window.location.reload()
            }
          })
        }
      })
    })
  })
}

// Region 정보 출력 (디버깅용)
if (import.meta.env.DEV) {
  logRegionInfo()
}

// Sentry 초기화 (앱 시작 전)
try {
  initSentry()
} catch (error) {
  console.error('[App] Sentry 초기화 실패:', error)
}

// Register service worker for offline caching of static assets
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
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

