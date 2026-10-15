/**
 * 🧊 서버 화면 이어받기의 **우선순위를 올린다** (2026-10-15 — 상세 서버 렌더 3단계, 앱 전체 이어받기).
 *
 * React 18 은 서버가 그린 Suspense 영역을 **"급하지 않음"(OffscreenLane = 유휴 우선순위)** 으로 이어받는다
 * (react-dom `mountDehydratedSuspenseComponent` — *"we'll already be showing the right content … it is no rush"*).
 * 이 앱은 셸 전체가 큰 Suspense 하나 안에 있어서 **페이지 전체**가 유휴 우선순위로 밀렸고, 부팅 중 다른 일이 먼저 돌아
 * 누를 수 있는 시점이 다시 그리기(createRoot)보다 늦었다(로컬 A/B 실측 — 이어받기 3.60초 vs 다시 그리기 3.14초).
 *
 * ⇒ 셸이 커밋된 직후(이 부품의 레이아웃 이펙트) `root.unstable_scheduleHydration(본문)` 으로 그 영역을 **보통 우선순위**로
 *   올린다(React 가 이벤트 대상에 쓰는 바로 그 경로). 이 부품은 그 Suspense **바깥**에 둔다 — 안에 두면 이어받아진 뒤에야 돌아 소용없다.
 * 서버 렌더가 아닌 경로(createRoot)에선 등록된 루트가 없어 아무 일도 안 한다.
 */
import { useEffect, useLayoutEffect } from 'react'

type HydrationRoot = { unstable_scheduleHydration?: (target: Node) => void }
let pending: HydrationRoot | null = null

/** main.tsx 가 hydrateRoot 직후 부른다. (`unstable_scheduleHydration` 은 React 18 런타임에 있고 타입 정의엔 없다.) */
export function setHydrationRoot(root: object): void { pending = root as HydrationRoot }

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function HydrationPriority(): null {
  useIsoLayoutEffect(() => {
    const root = pending
    pending = null
    if (!root?.unstable_scheduleHydration) return
    const target = document.querySelector('#root main') || document.querySelector('#root [data-early-tap]')
    if (target) root.unstable_scheduleHydration(target)
  }, [])
  return null
}
