/**
 * 🔔 벨 하나를 알림 시트에 잇는 **최소 배선** (2026-10-11).
 *
 * ```tsx
 * const bell = useNotificationSheet()
 * <button onClick={bell.open} …/>
 * {bell.sheet}
 * ```
 *
 * ## ⚠️ 왜 시트를 `lazy` 로 부르나 — 가드가 잡아서 알게 된 것
 * 벨은 다섯 곳인데 그중 `HomeTopHeader`·`NotificationDropdown` 은 `src/components/main/`
 * = **`app-layout`(첫 페인트 청크)** 에 산다. 그래서 시트를 **정적으로** import 하면
 * 엔트리 → app-layout → (시트가 떨어진 catch-all)`app-components` 정적 엣지가 생기고,
 * app-components 가 radix-ui·app-features·app-kakao-sdk… 를 줄줄이 끌고 온다.
 * 실측: `check-critical-chunks` 가 **새 청크 9개 진입**으로 push 를 막았다.
 *
 * ⇒ 시트는 **벨을 누른 뒤에야** 필요하다 → `lazy` 로 경계를 긋는다. 이 파일이 정적으로 쥐는 것은
 *   React 뿐이고, `vite.config` 가 이 모듈과 `NotificationPanel` 을 `app-layout` 으로 보낸다
 *   (둘 다 app-layout 에서 정적으로 닿기 때문 — 안 그러면 같은 엣지가 다시 생긴다).
 * 🔒 `Suspense` 폴백이 `null` 인 이유: 시트는 사용자가 누른 **뒤** 뜨는 것이라, 로딩 자리를
 *   미리 그리면 화면이 한 번 깜빡인다. 청크는 수 KB 라 사실상 즉시 온다.
 */
import { Suspense, lazy, useState } from 'react'

const NotificationSheet = lazy(() => import('./NotificationSheet'))

export function useNotificationSheet() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return {
    open: () => setOpen(true),
    close,
    isOpen: open,
    sheet: open ? (
      <Suspense fallback={null}>
        <NotificationSheet onClose={close} />
      </Suspense>
    ) : null,
  }
}
