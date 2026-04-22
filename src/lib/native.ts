/**
 * Capacitor 네이티브 기능 초기화 + 유틸리티
 *
 * 플러그인: SplashScreen, StatusBar, PushNotifications,
 *          App (딥링크/뒤로가기), Keyboard, Haptics, Share, Browser
 */

import { Capacitor } from '@capacitor/core'

/** 네이티브 앱인지 여부 */
export const isNative = () => Capacitor.isNativePlatform()
export const isIOS = () => Capacitor.getPlatform() === 'ios'
export const isAndroid = () => Capacitor.getPlatform() === 'android'

/**
 * v32 CRITICAL FIX: 내부 경로 검증
 * 푸시 알림 / 딥링크 타고 들어오는 URL이 외부 도메인으로 리다이렉트되는 것을 차단.
 * 반드시 '/'로 시작하고 '//' 프로토콜 탈출을 막은 상대 경로만 허용.
 */
function sanitizeInternalPath(raw: string | undefined | null): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  // '//example.com' 같은 scheme-relative URL 차단
  if (s.startsWith('//')) return null
  if (!s.startsWith('/')) return null
  // 줄바꿈/공백 문자 섞인 경우 차단
  if (/[\r\n\t]/.test(s)) return null
  // 🛡️ 2026-04-22: backslash URL rewrite trick 차단 (일부 파서가 '\' 를 '/' 로 변환)
  if (s.includes('\\')) return null
  // javascript:, data:, vbscript: 접두가 path 에 섞여 들어오는 경우 차단
  const lower = s.toLowerCase()
  if (lower.includes('javascript:') || lower.includes('data:') || lower.includes('vbscript:')) return null
  return s
}

/**
 * 앱 시작 시 한 번 호출
 */
export async function initNativeFeatures() {
  if (!isNative()) return

  // 1. 스플래시 화면
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {}

  // 2. 상태바
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // 다크 테마 메인 → 밝은 텍스트
    await StatusBar.setStyle({ style: Style.Dark })
    if (isAndroid()) {
      await StatusBar.setBackgroundColor({ color: '#020202' })
      await StatusBar.setOverlaysWebView({ overlay: false })
    }
  } catch {}

  // 3. 푸시 알림
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permission = await PushNotifications.requestPermissions()
    if (permission.receive === 'granted') {
      await PushNotifications.register()
    }

    PushNotifications.addListener('registration', (token) => {
      console.log('[Push] Token:', token.value)
      localStorage.setItem('push_token', token.value)
      // 서버에 토큰 저장
      import('@/lib/api').then(({ default: api }) => {
        api.post('/api/push/register', { token: token.value, platform: Capacitor.getPlatform() }).catch(() => {})
      })
    })

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Foreground:', notification.title)
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data
      if (data?.url) {
        // v32 CRITICAL FIX: URL 검증 — 상대경로만 허용 또는 동일 오리진
        const safePath = sanitizeInternalPath(String(data.url))
        if (safePath) window.location.href = safePath
      }
    })
  } catch {}

  // 4. 하드웨어 뒤로가기 (Android)
  try {
    const { App } = await import('@capacitor/app')

    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back()
      } else {
        App.exitApp()
      }
    })

    // 딥링크 처리
    App.addListener('appUrlOpen', (event) => {
      // v32 CRITICAL FIX: 딥링크 open-redirect 방지
      // event.url: urlive://some/path 또는 https://live.ur-team.com/path 형태
      try {
        const url = new URL(event.url)
        const allowedHosts = new Set(['live.ur-team.com', 'www.live.ur-team.com'])
        const isCustomScheme = url.protocol === 'urlive:' || url.protocol === 'urdeal:'
        const isAllowedHttps = (url.protocol === 'https:' || url.protocol === 'http:') && allowedHosts.has(url.host)
        if (!isCustomScheme && !isAllowedHttps) {
          return // 외부 도메인 redirect 차단
        }
        const safePath = sanitizeInternalPath(url.pathname + url.search + url.hash)
        if (safePath) window.location.href = safePath
      } catch {
        // URL 파싱 실패 — 무시
      }
    })
  } catch {}

  // 5. 키보드 (iOS 자동 스크롤 방지)
  try {
    const { Keyboard } = await import('@capacitor/keyboard')

    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`)
      document.body.classList.add('keyboard-open')
    })

    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px')
      document.body.classList.remove('keyboard-open')
    })
  } catch {}
}

/**
 * 상태바 스타일 변경 (페이지별)
 */
export async function setStatusBarStyle(mode: 'dark' | 'light') {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: mode === 'dark' ? Style.Dark : Style.Light })
    if (isAndroid()) {
      await StatusBar.setBackgroundColor({ color: mode === 'dark' ? '#020202' : '#ffffff' })
    }
  } catch {}
}

/**
 * 네이티브 공유
 */
export async function nativeShare(opts: { title: string; text?: string; url: string }) {
  if (!isNative()) {
    // 웹 fallback
    if (navigator.share) {
      return navigator.share(opts)
    }
    navigator.clipboard.writeText(opts.url)
    return
  }
  try {
    const { Share } = await import('@capacitor/share')
    await Share.share({
      title: opts.title,
      text: opts.text,
      url: opts.url,
      dialogTitle: opts.title,
    })
  } catch {}
}

/**
 * 햅틱 피드백
 */
export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] })
  } catch {}
}

/**
 * 외부 URL을 인앱 브라우저로 열기
 */
export async function openExternalUrl(url: string) {
  if (!isNative()) {
    window.open(url, '_blank')
    return
  }
  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } catch {
    window.open(url, '_blank')
  }
}
