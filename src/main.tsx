import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n' // ✅ i18n 초기화
import { logRegionInfo, isKorea } from '@/shared/config/region'
// ✅ Week 5 Day 2: 런타임 환경 변수 검증
import { validateEnvForRuntime } from '@/shared/config/env-validator'
import { initNativeFeatures, isNative } from '@/lib/native'

// 🛡️ 2026-04-28: 인앱 브라우저(카카오톡/네이버/페북/IG/라인 등) 감지를 window 에 노출
//   App 단에서 안내 배너 렌더 시 사용. 강제 redirect 는 하지 않음 (사용자 이탈 방지).
import { detectInAppBrowser } from '@/lib/in-app-browser'
;(window as { __urInAppBrowser?: string | null }).__urInAppBrowser = detectInAppBrowser()

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

// Service Worker 완전 비활성화 — sw.js 배포 누락으로 MIME 에러 발생 방지
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {})
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
