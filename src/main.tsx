// 🛡️ 2026-04-28: 카카오톡 인앱 강제 외부 브라우저 redirect (흰화면 + 무한 reload 회피)
//   *반드시* React/i18n/sentry 등 import 보다 먼저 실행 (모듈 로딩 자체 차단 위해).
import { autoRedirectKakaoToExternal, detectInAppBrowser } from '@/lib/in-app-browser'
import { isChunkLoadError, isAppChunkUrl, recoverFromChunkError, reloadWithCacheBust } from '@/utils/chunk-error'
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
// 🛡️ 2026-05-23 Frontend 에러 telemetry — window.onerror + unhandledrejection 캐치 → /api/_errors/log
import { installErrorTelemetry } from '@/lib/error-telemetry'
installErrorTelemetry()
import { logRegionInfo, isKorea } from '@/shared/config/region'
// 🛡️ 2026-05-27 (loading P1): env-validator (zod ~52KB) dynamic import — critical path 제거.
//   이전: eager import → validation chunk preload (52KB).
//   변경: idle 시점 비동기 검증. production 에서 env 정상이면 사용자 영향 0.
import { initNativeFeatures, isNative } from '@/lib/native'
import { isKeyboardOpen, isEditableElementFocused } from '@/lib/keyboard-viewport'
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

// 🛡️ 2026-06-25: 청크-에러 복구용 캐시버스트 파라미터(`__cb`) 정리 — 복구 성공 후 주소창/공유 URL 오염 방지.
//   reloadOnceForChunk 가 붙인 1회성 토큰. 라우팅엔 영향 없으나 깔끔하게 제거(replaceState — 네비게이션 X).
try {
  const _u = new URL(window.location.href)
  if (_u.searchParams.has('__cb')) {
    _u.searchParams.delete('__cb')
    window.history.replaceState(window.history.state, '', _u.pathname + _u.search + _u.hash)
  }
} catch { /* URL/history 차단 환경 — silent */ }

// 🛡️ 2026-05-07: dynamic import (lazy chunk) 로드 실패 자동 복구.
//   원인: 새 배포 후 사용자 브라우저는 옛 HTML 가지고 있음 → 옛 HTML 이 참조하는 옛 chunk
//   해시 (e.g. SellerPage-Dnxck7Qn.js) 가 새 빌드에 없어 404 → SPA HTML 폴백(text/html) →
//   React lazy() throw / modulepreload MIME 에러.
//   처리: 같은 세션에서 1회만 자동 reload (무한 reload 차단 sessionStorage 가드).
//   🛡️ 2026-06-16 (사용자 신고 — VoucherDetailPage MIME 에러): isChunkLoadError SSOT 로 변종 전부 감지
//     (Chrome MIME "Expected a JavaScript-or-Wasm module script ..." 포함) + modulepreload 리소스 실패도 capture.
//   🛡️ 2026-06-25 (사용자 신고 — /admin/wholesale-overview 일부 사용자 흰화면 영구 고착):
//     기존 plain reload() 는 (1) bfcache/heuristic/edge 가 옛 HTML 을 그대로 재서빙하면 같은 옛 청크 → 또 404,
//     (2) 가드가 "세션당 1회 영구" 라 그 1회가 stale 재서빙을 만나면 더 이상 재시도 안 함 → 영구 흰화면.
//     수정: ① `__cb` 캐시버스트 파라미터 + location.replace 로 옛 문서 재서빙 우회(항상 새 HTML→새 청크 해시),
//           ② 가드를 60초 윈도 내 2회로 — 그 안에서 못 고치면 진짜 에러로 보고 멈춤(무한 reload 차단),
//              60초 지나면 카운트 리셋(나중에 또 배포되면 다음 stale 도 재시도 허용).
// 🛡️ 단일 SSOT(recoverFromChunkError) 위임 — 가드 키/포맷/윈도(60초 2회)·캐시버스트 reload 를
//   ErrorBoundary·인라인 부트가드와 공유(이중 카운트·무한 reload 0). 로직 중복 제거.
const reloadOnceForChunk = () => { recoverFromChunkError() }
window.addEventListener('error', (e) => {
  if (isChunkLoadError(e.message)) { reloadOnceForChunk(); return }
  // modulepreload/script 리소스 로드 실패 (message 없음 — target 검사). 우리 청크(/assets/*.js)만.
  const t = e.target as (HTMLScriptElement & HTMLLinkElement) | null
  const src = t && (t.src || t.href)
  if (src && isAppChunkUrl(src)) reloadOnceForChunk()
}, true) // capture: 리소스 에러는 버블 안 함 → capture 로 window 에서 포착
window.addEventListener('unhandledrejection', (e) => {
  if (isChunkLoadError((e.reason as { message?: string })?.message)) reloadOnceForChunk()
})

// 카카오 외부브라우저 redirect 시도했으면 React 마운트 skip (이미 외부 브라우저로 이동 중)
if (!_kakaoRedirected) {

// ✅ 런타임 환경 변수 검증 — 비동기 (zod chunk lazy). throw 해도 React 마운트는 진행.
import('@/shared/config/env-validator').then(m => {
  try {
    m.validateEnvForRuntime(isKorea() ? 'KR' : 'GLOBAL')
  } catch (err) {
    console.error('[main] env validation failed:', err)
  }
}).catch(swallow('main:env-validator-load'))

// 🛡️ 2026-05-24 (loading P0): Sentry 진짜 lazy — critical path 완전 제외.
//   이전: import().then() 즉시 시작 → 441KB 다운로드가 main 과 경쟁 → LCP 1~2s 지연.
//   이후: requestIdleCallback (or 3s setTimeout) → FCP 완료 후 idle 시점에 fetch.
//   효과: 첫 진입 critical path -441KB. 첫 에러 보고 지연 최대 3s (사용자 영향 0).
if (typeof window !== 'undefined') {
  const initSentryDeferred = () => {
    import('./lib/sentry').then(m => m.initSentry()).catch(swallow('main:sentry-init'))
  }
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => void }).requestIdleCallback
  if (ric) {
    // 🛡️ 2026-05-27 v2 (Lighthouse TBT 910ms): idle timeout 3s → 5s.
    //   Sentry chunk (140KB) 가 FCP/LCP 후 5초 이후 fetch → 첫 paint 영향 더 감소.
    ric(initSentryDeferred, { timeout: 5000 })
  } else {
    setTimeout(initSentryDeferred, 5000)
  }
}

// 🛡️ 2026-05-22 Phase 2: localStorage cache LRU cleanup — 30일+ 안 본 entry 삭제.
//   앱 진입 시 1회 (idle 시점). quota 초과 방지 + 메모리 효율.
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => void }).requestIdleCallback?.(() => {
    import('./hooks/queries/localCache').then(m => m.cleanupExpiredCache()).catch(() => null)
  }, { timeout: 5000 })
} else {
  setTimeout(() => {
    import('./hooks/queries/localCache').then(m => m.cleanupExpiredCache()).catch(() => null)
  }, 3000)
}

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
    let watchdog: ReturnType<typeof setInterval> | null = null
    // 🛡️ 2026-06-22 (대표 신고 — 모바일 하단 네비 사라짐, 영구 방어): 판정은 keyboard-viewport.ts
    //   순수함수(불변식: 편집요소 포커스 없으면 절대 열림 아님) + 워치독으로 stuck 구조적 차단.
    const update = () => {
      const opened = isKeyboardOpen(vv.height, window.innerHeight, isEditableElementFocused())
      if (opened !== isOpen) {
        isOpen = opened
        document.body.classList.toggle('keyboard-open', opened)
        document.documentElement.style.setProperty(
          '--keyboard-height',
          opened ? `${window.innerHeight - vv.height}px` : '0px'
        )
        // 워치독: 열린 동안만 1s 주기 재평가 → resize/blur 이벤트가 누락돼도 닫히면 즉시 해제(stuck 불가).
        if (opened && watchdog == null) watchdog = setInterval(update, 1000)
        if (!opened && watchdog != null) { clearInterval(watchdog); watchdog = null }
      }
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('focusin', update)
    // 블러 직후 activeElement 갱신을 기다렸다 재평가 → 키보드 닫힘 누락에도 네비 복구.
    window.addEventListener('focusout', () => setTimeout(update, 0))
    window.addEventListener('pageshow', update)
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
    // 🛡️ 2026-05-27 v2: 4s → 10s. GTM (153KB) 첫 paint/LCP 후 충분히 늦게 fetch.
    requestIdleCallback(loadGTM, { timeout: 10000 })
  } else {
    setTimeout(loadGTM, 8000)
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
    // 🛡️ 2026-06-30 (대표 신고 — /admin 회색 빈화면, 시크릿창은 정상 = 평소 브라우저에 잔존한 stale SW):
    //   옛 캐시-우선 SW(pwa-sw/sw.js)가 현재 페이지를 '제어(controller)' 중이면, 이미 stale index.html/청크를
    //   서빙해 blank #root / 무한로딩(콘솔 무에러 — 2026-05-16 사고와 동일 증상)을 만든다. 기존 코드는
    //   unregister 만 하고 reload 를 안 해 → 그 stale 페이지가 그대로 남아 사용자가 수동 새로고침해야 복구
    //   ("수차례" 반복 신고의 원인). 수정: unregister+cache clear 를 *기다린 뒤*, stale SW 가 제어 중이었으면
    //   세션당 1회 캐시버스트 reload → SW 제어 해제된 clean 페이지를 자동 수신(무중단 자가복구).
    //   push-sw.js 는 fetch 핸들러가 없어(요청 미가로챔) 무해 → controller 여도 트리거 제외(루프 방지).
    const _ctrl = navigator.serviceWorker.controller
    const _staleControlling = !!_ctrl && !((_ctrl.scriptURL || '').includes('push-sw.js'))
    const _unreg = navigator.serviceWorker.getRegistrations().then(regs =>
      Promise.all(regs.map(r => {
        const scriptUrl = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ''
        // push-sw.js 만 보호 (push 알림 전용, fetch handler 없음)
        if (scriptUrl.includes('push-sw.js')) return Promise.resolve()
        return r.unregister().catch(swallow('main:sw-unregister'))
      }))
    ).catch(swallow('main:sw-getRegistrations'))
    const _cacheClear = ('caches' in window)
      ? caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(swallow('main:caches-clear'))
      : Promise.resolve()
    if (_staleControlling) {
      // stale SW 가 이 페이지를 서빙 중 → 제거 완료 후 1회만 clean reload (SW 제어 해제 반영).
      Promise.all([_unreg, _cacheClear]).then(() => {
        try {
          const K = '__ur_sw_killed_reload__'
          if (!sessionStorage.getItem(K)) { sessionStorage.setItem(K, '1'); reloadWithCacheBust() }
        } catch { /* sessionStorage 차단 — silent */ }
      })
    }
  }
} catch { /* ignore */ }

// 🛡️ 2026-06-20 (A 방식 — iOS 로그인 근본수정): 로그인 직후면 렌더 전에 same-origin 으로
//   httpOnly 세션을 발급받는다. 카카오 콜백이 fragment(#st=)로 넘긴 단명(120초) 세션 티켓을
//   processAuthCallbackParams 가 window.__urEstablishTicket 에 stash → 여기서
//   POST /api/auth/session/establish 로 교환 → 서버가 first-party 200 응답에 ur_session 을 set
//   (cross-site 302 와 달리 iOS Safari/WebKit 에서 영속) → 이후 모든 API 가 쿠키로 인증.
//   토큰을 localStorage 에 두지 않음(OWASP — XSS 면역). 실패해도(타임아웃/네트워크) 앱은 렌더.
async function bootApp() {
  try {
    const w = window as unknown as { __urEstablishTicket?: string }
    const ticket = w.__urEstablishTicket
    if (ticket) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 4000)
      let established = false
      try {
        const res = await fetch('/api/auth/session/establish', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket }),
          signal: ctrl.signal,
        })
        established = res.ok
      } catch { /* establish 실패해도 앱은 뜸 — 302-set 쿠키(Chrome) 또는 아래 재시도 */ }
      clearTimeout(timer)
      if (established) {
        // 성공: 티켓 소비 (기존 동작 그대로).
        try { delete w.__urEstablishTicket } catch { /* */ }
      } else {
        // 🛡️ 2026-06-26 (대표 승인 "모두 해줘" — 소비자 감사 E): establish 실패 분기 보강.
        //   기존엔 결과 무관 티켓 삭제 → 타임아웃/5xx/네트워크 블립 한 번이면 단명 티켓이 소진돼
        //   사파리/카톡 신규 로그인이 '재로그인'밖에 답 없었음. 수정: ① res.ok 검사(위) ② 실패 시
        //   티켓 보존 + 렌더 후 non-blocking 재시도 1회 → 성공하면 ticket-scoped 가드로 단 1회만
        //   reload 해 늦게 도착한 ur_session 쿠키를 픽업. happy-path(established=true)는 위 분기로
        //   기존과 byte-동일 — 이 분기는 원래 '티켓 삭제'뿐이라 순개선(최악=재시도 실패=기존과 동일 재로그인).
        //   reload 는 ticket-scoped 가드(prefix)로 같은 티켓당 최대 1회 → 루프 불가, 새 로그인은 새 티켓이라 재시도 허용.
        const guard = String(ticket).slice(0, 16)
        const retryEstablishOnce = () => {
          try { if (sessionStorage.getItem('ur_establish_retry') === guard) return } catch { /* */ }
          const rc = new AbortController()
          const rt = setTimeout(() => rc.abort(), 4000)
          fetch('/api/auth/session/establish', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket }),
            signal: rc.signal,
          }).then((res) => {
            clearTimeout(rt)
            if (res.ok) {
              try { sessionStorage.setItem('ur_establish_retry', guard) } catch { /* */ }
              try { delete w.__urEstablishTicket } catch { /* */ }
              try { window.location.reload() } catch { /* */ }
            }
          }).catch(() => { clearTimeout(rt) })
        }
        try { setTimeout(retryEstablishOnce, 1500) } catch { /* */ }
      }
    }
  } catch { /* establish 단계 실패 무시 — 렌더 진행 */ }

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

      // 🏭 2026-06-04: 청크-실패 자동 reload 가드를 부팅 성공 후 해제 → "세션당 1회"가 아니라
      //   "장애 1건당 1회". 5초 후에도 앱이 살아있으면 청크 정상 로드된 것 → 다음 배포에서 또 복구 가능.
      setTimeout(() => { try { sessionStorage.removeItem('__ur_chunk_reload__') } catch { /* silent */ } }, 5000)
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
}
void bootApp()

} // end if (!_kakaoRedirected)
