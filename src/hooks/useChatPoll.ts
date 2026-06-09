// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 Wave 4b — adaptive 채팅 폴링 훅 (D1 비용 보호).
//   useChatPoll(fn, { baseInterval, maxInterval, enabled })
//     • document.hidden 이면 폴링 중단 (탭 안 보이면 0 호출).
//     • 가시 상태 복귀(focus/visibilitychange) 시 즉시 1회 + 재개.
//     • 콜백이 false 반환(에러) → 지수 백오프 (base → 2x → … → max).
//       true 반환 → base 로 복귀.
//     • enabled=false (로그아웃 등) 면 아무것도 안 함.
//
//   용도:
//     • unread 배지   : base ~25s   (가벼움)
//     • 열린 스레드    : base ~3s, max ~30s (focus 한정)
//   DashboardNotificationBell 의 백오프 패턴을 재사용 + open-thread 지원.
// ──────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'

interface ChatPollOptions {
  /** 정상 폴링 간격(ms). */
  baseInterval: number
  /** 백오프 상한(ms). */
  maxInterval: number
  /** false 면 폴링 완전 중단. */
  enabled?: boolean
}

/**
 * @param fn 매 tick 실행. `Promise<boolean>` 반환 — true=성공(base 유지), false=실패(백오프).
 */
export function useChatPoll(
  fn: () => Promise<boolean>,
  { baseInterval, maxInterval, enabled = true }: ChatPollOptions,
) {
  // fn 은 매 렌더 새로 만들어질 수 있으므로 ref 로 최신값 고정 — 폴링 effect 재생성 방지.
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let currentInterval = baseInterval
    let timerId: ReturnType<typeof setTimeout> | null = null

    const runOnce = async () => {
      if (cancelled || document.hidden) return
      const ok = await fnRef.current().catch(() => false)
      if (cancelled) return
      currentInterval = ok ? baseInterval : Math.min(currentInterval * 2, maxInterval)
    }

    const scheduleNext = () => {
      if (cancelled) return
      timerId = setTimeout(async () => {
        if (cancelled) return
        // 탭 숨김이면 호출 스킵(타이머만 계속) — 0 네트워크.
        if (!document.hidden) await runOnce()
        scheduleNext()
      }, currentInterval)
    }

    // 즉시 1회 + 스케줄.
    runOnce()
    scheduleNext()

    // 가시 상태 복귀 → 즉시 새로고침 + base 복귀.
    const onVisible = () => {
      if (cancelled || document.hidden) return
      currentInterval = baseInterval
      runOnce()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      cancelled = true
      if (timerId) clearTimeout(timerId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // baseInterval/maxInterval/enabled 변경 시에만 재생성. fn 변경은 ref 로 흡수.
  }, [baseInterval, maxInterval, enabled])
}
