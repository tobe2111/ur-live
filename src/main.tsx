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

// 🛡️ 2026-04-27 (PWA): Workbox SW 등록 (vite-plugin-pwa 가 빌드 시 sw.js 생성).
//   기존 미사용 SW 들 (예: /static/sw.js) 은 unregister, 새 /sw.js 만 등록.
//   푸시 알림은 PushNotificationSetup 컴포넌트가 별도 처리.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // 1) 기존 등록된 미사용 SW 정리 (이전 버전 / 다른 path)
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => {
      if (r.active && !r.active.scriptURL.endsWith('/sw.js')) r.unregister()
    })
  })

  // 2) 새 PWA SW 등록 (workbox-window 사용)
  import('workbox-window').then(({ Workbox }) => {
    const wb = new Workbox('/sw.js')
    wb.addEventListener('waiting', () => {
      if (confirm('새 버전이 있습니다. 지금 새로고침하시겠습니까?')) {
        wb.messageSW({ type: 'SKIP_WAITING' })
        window.location.reload()
      }
    })
    wb.register().catch(err => {
      if (import.meta.env.DEV) console.warn('[PWA] SW register failed:', err)
    })
  })
} else if ('serviceWorker' in navigator) {
  // DEV 모드: 모든 SW unregister (HMR 충돌 방지)
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
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

