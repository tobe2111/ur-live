/**
 * 🛒 AI 비서가 건넨 결제 링크(`?qty=N&via=agent`)로 들어왔을 때 — 구매 창을 그 수량으로 연다
 * (2026-10-20 대표 *"4번도 일단은 하자. 가장 이상적으로."*, 규칙 SSOT `shared/agent-checkout.ts`).
 *
 * 하는 일은 **미리 채우기**뿐이다: 수량을 넣고 창을 연다. 결제는 손님이 [구매하기] 를 눌러야 시작되고,
 * 한도·금액은 결제 직전에 서버가 다시 잰다. 그래서 링크를 손으로 고쳐도 얻는 것이 없다.
 * 한 번만 한다 — 처리 뒤 주소에서 표식을 지워, 뒤로 왔다가 다시 와도 창이 저절로 또 열리지 않게 한다.
 */
import { useEffect, useRef, useState } from 'react'
import { readAgentHandoff } from '@/shared/agent-checkout'

/** 로그인 벽 복귀 표식 — `GroupBuyDetailPage.handleJoin` 이 로그인 전에 저장하는 주소. 순수 함수. */
export const LOGIN_RESUME_VIA = 'login'
export function readLoginResume(search: string): { qty: number } | null {
  let p: URLSearchParams
  try { p = new URLSearchParams(search) } catch { return null }
  if (p.get('via') !== LOGIN_RESUME_VIA) return null
  const n = Math.trunc(Number(p.get('qty')))
  return { qty: Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 1 }
}

export function useAgentHandoff({ ready, maxQty, setQuantity, setOpen }: {
  /** 지금 살 수 있고(주인 아님·판매 전 아님) 화면이 다 그려졌을 때 true. */
  ready: boolean
  maxQty: number
  setQuantity: (fn: (q: number) => number) => void
  setOpen: (v: boolean) => void
}): boolean {
  const done = useRef(false)
  const [fromAgent, setFromAgent] = useState(false)
  useEffect(() => {
    if (done.current || !ready || typeof window === 'undefined') return
    // 🔐 2026-11-13 (대표 "응, 고쳐줘") 로그인 벽에서 돌아온 손님(`?via=login&qty=N`)도 같은 창을 그 수량으로 다시 연다 — 구매를 두 번 누르게 하지 않는다.
    const login = readLoginResume(window.location.search)
    const h = readAgentHandoff(window.location.search) ?? login
    if (!h) return
    done.current = true
    const top = maxQty > 0 ? maxQty : 1
    setQuantity(() => Math.min(Math.max(1, h.qty), top))
    setOpen(true)
    setFromAgent(!login) // 'AI 비서가 고른 수량이에요' 는 비서 링크일 때만
    try {
      const u = new URL(window.location.href)
      u.searchParams.delete('via'); u.searchParams.delete('qty')
      window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash)
    } catch { /* 주소 정리 실패는 무해 — 창은 이미 열렸다 */ }
  }, [ready, maxQty, setQuantity, setOpen])
  return fromAgent
}
