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
        window.location.href = data.url
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
      const url = new URL(event.url)
      const path = url.pathname + url.search
      if (path) {
        window.location.href = path
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
