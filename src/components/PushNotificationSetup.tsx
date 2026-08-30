import { useEffect, useCallback, useRef } from 'react'
import { isPWAStandalone, isFeatureBlockedSync } from '@/lib/in-app-warning'

/**
 * PushNotificationSetup — **화면에 아무것도 그리지 않는다.**
 *
 * 🗑️ 2026-08-11 (대표 "팝업 삭제해줘"): "알림을 켜시겠어요?" **soft-prompt 배너를 제거**했다.
 *   로그인 10초 뒤 뜨던 그 배너가 유일한 UI 였으므로 이 컴포넌트는 이제 headless 다.
 *
 *   ⚠️ **컴포넌트 자체는 지우지 않았다** — 배너는 "새로 켜자"는 권유일 뿐이고, 이 파일의 나머지는
 *   **이미 알림을 켠 사람의 구독을 살려 두는 자가치유**다(아래 granted 분기). 그걸 같이 지우면
 *   브라우저가 endpoint 를 교체하거나 서버가 410 으로 구독행을 지웠을 때 **조용히 두절**된다 —
 *   어드민 시스템 경보(`/admin/system-monitoring` 푸시)가 그 경로를 쓴다.
 *
 *   복원: 이 파일을 `git show <이 커밋>^:src/components/PushNotificationSetup.tsx` 로 되돌리면 된다
 *   (배너 JSX + `showBanner`/`snooze` + `push.prompt*` i18n 키 4개는 그대로 남겨 뒀다).
 *   새로 켜려는 사용자는 그동안 브라우저 주소창의 사이트 설정에서 알림을 허용하면 이 자가치유가 잡는다.
 *
 * 🛡️ 2026-04-28: body 형식 — 서버 (push.routes.ts) 는 raw subscription 기대.
 *   role 토큰 자동 주입 (admin/seller/agency/user) + session cookie credentials.
 */

/**
 * 🔔 2026-07-01 (라이브 전수조사): VAPID 공개키 해석을 **런타임 서버 우선**으로.
 *   기존엔 빌드타임 `VITE_VAPID_PUBLIC_KEY` 하나에만 의존 — 이 값이 빌드 시점에 비어 있으면
 *   번들에 `const a=void 0`로 인라인돼 구독 함수가 영구 no-op(프로덕션 실측 확인, 웹푸시 0건).
 *   게다가 공개키를 빌드(클라)·런타임(서버 서명) 두 곳에 넣어야 해 drift 위험.
 *   이제 서버 `/api/push/vapid-public-key`(런타임 `VAPID_PUBLIC_KEY`)를 우선 사용하고,
 *   빌드 변수는 폴백. → secret 하나만 설정하면 재배포 없이 구독+서명 키가 자동 일치.
 */
let _vapidKeyPromise: Promise<string> | null = null
function resolveVapidKey(): Promise<string> {
  if (_vapidKeyPromise) return _vapidKeyPromise
  _vapidKeyPromise = (async () => {
    const buildKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (buildKey) return buildKey
    try {
      const res = await fetch('/api/push/vapid-public-key')
      if (!res.ok) return ''
      const data = (await res.json()) as { publicKey?: string }
      return data?.publicKey || ''
    } catch {
      return ''
    }
  })()
  return _vapidKeyPromise
}

export default function PushNotificationSetup() {
  // ⚠️ state 가 아니라 ref 다 — 이 컴포넌트는 아무것도 안 그리므로 재렌더가 의미 없다.
  const busy = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (typeof Notification === 'undefined') return

    // 모든 role 지원: user/seller/admin/agency
    const isLoggedIn =
      localStorage.getItem('user_id') ||
      localStorage.getItem('seller_id') ||
      localStorage.getItem('admin_id') ||
      localStorage.getItem('agency_id')
    if (!isLoggedIn) return

    if (Notification.permission === 'denied') return

    // 🛡️ 2026-04-30 v2: PWA standalone 이면 풀 기능 → 진행. 아니면 인앱 매트릭스 체크.
    if (!isPWAStandalone() && isFeatureBlockedSync('notification')) {
      if (import.meta.env.DEV) console.info('[PushNotification] In-app webview blocked — skipping')
      return
    }
    // VAPID 키(런타임 서버 우선)를 해석한 뒤에만 진행 — 키 없으면 배너/구독 모두 skip.
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    void resolveVapidKey().then((vapidKey) => {
      if (cancelled || !vapidKey) return

      // 🔔 2026-07-01: 권한이 이미 granted 면 **항상** 서버 구독을 재조정(self-heal).
      //   이전엔 localStorage.push_subscribed 플래그가 있으면 조기 return 해서, 브라우저가
      //   endpoint 를 교체하거나 서버가 410 으로 구독행을 지우면 클라는 '구독됨'으로 착각하고
      //   영구 두절됐음. 이제 getSubscription→재전송(ON CONFLICT 멱등)으로 매 마운트 self-heal.
      //
      // 🗑️ 2026-08-11: granted 가 아니면 **아무 일도 하지 않는다.** 예전엔 여기서 10초 뒤
      //   권유 배너를 띄웠다(대표 지시로 제거). 권한 요청은 브라우저 사이트 설정에서만 시작된다.
      if (Notification.permission !== 'granted') return
      timer = setTimeout(() => { void subscribe() }, 8000)
    })
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const subscribe = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const vapidKey = await resolveVapidKey()
      if (!vapidKey) return

      // 🛡️ 2026-04-28: push-sw.js (push-only, no fetch handler) 명시적 등록.
      let reg = await navigator.serviceWorker.getRegistration('/push-sw.js')
      if (!reg) {
        reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
      }
      if (!reg.active) {
        await new Promise<void>((resolve) => {
          const tmo = setTimeout(resolve, 5000)
          const sw = reg!.installing || reg!.waiting
          if (!sw) { clearTimeout(tmo); resolve(); return }
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') { clearTimeout(tmo); resolve() }
          })
        })
      }

      // 🔔 2026-07-01: 기존 브라우저 구독을 우선 재사용(self-heal). 없을 때만 새로 구독.
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        // 🗑️ 2026-08-11: 권한 요청은 여기서 하지 않는다 — 이 경로는 granted 인 사람만 도달한다.
        //   (배너 제거로 제스처 진입점이 없어졌고, 제스처 없는 requestPermission 은 Safari 가 무시하고
        //    Chrome 은 quiet-UI 로 강등하는 최악 패턴이라 되살리면 안 된다.)
        if (Notification.permission !== 'granted') return
        try {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
        } catch (subErr) {
          // 다른 VAPID 키로 만든 구독이 남아 있으면 InvalidStateError — 교체 후 재시도(키 로테이션 self-heal).
          const stale = await reg.pushManager.getSubscription()
          if (stale) { try { await stale.unsubscribe() } catch { /* */ } sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey }) }
          else throw subErr
        }
      }

      const token =
        localStorage.getItem('admin_token') ||
        localStorage.getItem('agency_token') ||
        localStorage.getItem('seller_token') ||
        localStorage.getItem('user_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(sub.toJSON()),
      })

      localStorage.setItem('push_subscribed', 'true')
    } catch {
      // Silently fail — push is non-critical
    } finally {
      busy.current = false
    }
  }, [])

  return null
}

/* 🗑️ 2026-08-11 제거된 soft-prompt 배너 (대표 "팝업 삭제해줘"). 되살리려면 아래를 컴포넌트 안으로
   되돌리고 `showBanner` state·`snooze()`·`fromGesture` 인자를 함께 복원할 것. i18n 키(`push.prompt*`)는
   지우지 않았다 — 문구가 사라지면 복원할 때 문안을 다시 짜게 된다.

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[400px] z-[9000] animate-sheet-up">
      <div className="bg-white dark:bg-[#1A1C21] border border-gray-200 dark:border-[#2C2F35] rounded-2xl shadow-xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-500/10 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-pink-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-900 dark:text-white">
            {t('push.promptTitle', { defaultValue: '알림을 켜시겠어요?' })}
          </p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {t('push.promptDesc', { defaultValue: '교환권 만료 임박, 공구 마감, 적립 소식을 놓치지 않게 알려드려요' })}
          </p>
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => void subscribe(true)} disabled={busy}
              className="px-3.5 py-1.5 bg-pink-500 text-white rounded-lg text-[12px] font-bold disabled:opacity-50">
              {t('push.promptOn', { defaultValue: '켜기' })}
            </button>
            <button onClick={snooze}
              className="px-3.5 py-1.5 bg-gray-100 dark:bg-[#1A1C21] text-gray-600 dark:text-gray-300 rounded-lg text-[12px] font-semibold">
              {t('push.promptLater', { defaultValue: '나중에' })}
            </button>
          </div>
        </div>
        <button onClick={snooze} aria-label="close" className="p-1 -m-1 text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
*/
