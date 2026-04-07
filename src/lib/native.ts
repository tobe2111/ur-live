/**
 * Capacitor 네이티브 기능 초기화
 * - 푸시 알림 (Apple 심사 통과용 + 실제 기능)
 * - 스플래시 화면
 * - 상태바
 */

import { Capacitor } from '@capacitor/core'

export async function initNativeFeatures() {
  // 웹 브라우저에서는 스킵
  if (!Capacitor.isNativePlatform()) return

  // 1. 스플래시 화면 숨기기
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    // 플러그인 없으면 무시
  }

  // 2. 상태바 설정
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Light })
    await StatusBar.setBackgroundColor({ color: '#ffffff' })
  } catch {
    // 플러그인 없으면 무시
  }

  // 3. 푸시 알림 등록
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permission = await PushNotifications.requestPermissions()
    if (permission.receive === 'granted') {
      await PushNotifications.register()
    }

    // 토큰 수신 (서버에 저장)
    PushNotifications.addListener('registration', (token) => {
      console.log('[Push] Token:', token.value)
      // TODO: 서버에 토큰 저장 (POST /api/push/register)
      localStorage.setItem('push_token', token.value)
    })

    // 알림 수신 (앱이 열려있을 때)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received:', notification.title)
    })

    // 알림 클릭 (앱이 백그라운드일 때)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data
      if (data?.url) {
        window.location.href = data.url
      }
    })
  } catch {
    // 웹에서는 무시
  }
}
