/**
 * 🎯 2026-10-27 (대표 "데모 이용권 상세 하단에 구매하기보다 응모하기 … 결제하기 눌렀더니 당첨자만 구매할 수
 *   있다고 뜨고 있어"): 추첨 상품의 응모 상태를 **한 곳**에서 들고, 응모 칸(`FcfsApplyBlock`)과 하단 버튼
 *   (`DealBottomBar`·`DealPurchaseBox`·숙소 `StayStickyBar`)이 같은 값을 본다.
 *
 * 공유 저장소로 두는 이유: 여러 부품이 각자 부르면 같은 요청이 여러 번 나간다(첫 화면 중복 요청 가드).
 *   상품마다 한 번만 나가고, 응모하면 모든 버튼이 동시에 '응모 완료' 가 된다.
 *
 * `gate` = 하단 버튼이 결제 대신 응모를 해야 하는가 — 추첨 켜짐 + 당첨자가 아님.
 *   당첨자(selected)는 종전대로 결제 버튼을 본다(서버 `fcfs-gate.ts` 가 그 사람만 통과시킨다).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'

export interface FcfsDetailInfo { enabled: boolean; spots: number; appliedDisplay: number; deadline: string | null }
type MyStatus = 'applied' | 'selected' | 'paid' | 'demo' | null

/**
 * 상품별 공유 저장소 — 같은 상품을 여러 부품이 봐도 요청은 한 번(진행 중이면 이어받는다).
 * React Query 를 쓰지 않는 이유: 이 부품들은 Provider 없이도 렌더된다(단위 시험·잘린 트리).
 */
interface Entry { info: FcfsDetailInfo | null; my: MyStatus; loaded: boolean; meLoaded: boolean; listeners: Set<() => void> }
const store = new Map<number, Entry>()
const entry = (id: number): Entry => {
  let e = store.get(id)
  if (!e) { e = { info: null, my: null, loaded: false, meLoaded: false, listeners: new Set() }; store.set(id, e) }
  return e
}
const emit = (id: number) => { const e = store.get(id); if (e) { store.set(id, { ...e }); e.listeners.forEach((l) => l()) } }
const set = (id: number, patch: Partial<Entry>) => { const e = entry(id); Object.assign(e, patch); emit(id) }
const inflight = new Map<string, Promise<void>>()
function once(key: string, run: () => Promise<void>) {
  if (!inflight.has(key)) inflight.set(key, run().finally(() => inflight.delete(key)))
}

/** 시험용 — 상품별 캐시를 비운다. */
export function __resetFcfsDetailStore() { store.clear(); inflight.clear() }

export interface FcfsDetailState {
  info: FcfsDetailInfo | null
  enabled: boolean
  applied: boolean
  isWinner: boolean
  isPaid: boolean
  closed: boolean
  busy: boolean
  /** 하단 버튼이 결제 대신 응모를 해야 하는가 */
  gate: boolean
  /** 추첨 여부를 아직 모르는가 — 그동안 결제 버튼은 눌러도 아무 일도 안 한다(데모가 잠깐 '구매하기'로 보이는 틈). */
  pending: boolean
  /** 하단 버튼 글자 — gate 일 때만 의미가 있다 */
  ctaLabel: string
  apply: () => void
}

export function fcfsCtaLabel(s: { applied: boolean; closed: boolean; busy: boolean }): string {
  if (s.busy) return '처리 중…'
  if (s.applied) return '응모 완료 · 당첨 시 안내'
  if (s.closed) return '응모 마감'
  return '응모하기 (무료)'
}

export function useFcfsDetail(productId: number): FcfsDetailState {
  const ok = Number.isFinite(productId) && productId > 0
  const e = useSyncExternalStore(
    (cb) => { if (!ok) return () => {}; const en = entry(productId); en.listeners.add(cb); return () => { en.listeners.delete(cb) } },
    () => (ok ? store.get(productId) ?? null : null),
    () => null,
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ok) return
    const en = entry(productId)
    if (!en.loaded) once(`i${productId}`, () => api.get(`/api/fcfs/${productId}`)
      .then((r) => set(productId, { info: r.data?.success ? (r.data.data as FcfsDetailInfo) : null, loaded: true }))
      .catch(() => set(productId, { loaded: true })))
  }, [ok, productId])

  const enabled = !!e?.info?.enabled
  useEffect(() => {
    // 비로그인이면 내 상태를 묻지 않는다(브라우저가 401 을 콘솔에 남긴다 — 2026-07-29 실측).
    if (!ok || !enabled || !getUserIdSync()) return
    const en = entry(productId)
    if (!en.meLoaded) once(`m${productId}`, () => api.get(`/api/fcfs/${productId}/me`)
      .then((r) => {
        const st = r.data?.data?.status
        set(productId, { meLoaded: true, my: r.data?.success && (st === 'applied' || st === 'selected' || st === 'paid' || st === 'demo') ? (st as MyStatus) : null })
      })
      .catch(() => set(productId, { meLoaded: true })))
  }, [ok, enabled, productId])

  const info = e?.info ?? null
  const my = e?.my ?? null
  const applied = my != null
  const isWinner = my === 'selected'
  const isPaid = my === 'paid'
  const closed = info?.deadline ? new Date(info.deadline).getTime() < Date.now() : false

  const apply = useCallback(() => {
    if (busy || applied || closed || !ok) return
    setBusy(true)
    api.post(`/api/fcfs/${productId}/apply`)
      .then((res) => {
        const disp = res.data?.data?.appliedDisplay
        const cur = entry(productId).info
        set(productId, { my: 'applied', meLoaded: true, ...(typeof disp === 'number' && cur ? { info: { ...cur, appliedDisplay: disp } } : {}) })
        toast.success(res.data?.data?.already ? '이미 응모했어요' : '🎉 응모 완료! 당첨 시 안내드려요')
      })
      .catch((err) => {
        if (err?.response?.status === 401) toast.error('응모하려면 로그인이 필요해요')
        else toast.error(err?.response?.data?.error || '응모 처리 중 오류가 발생했어요')
      })
      .finally(() => setBusy(false))
  }, [busy, applied, closed, ok, productId])

  const gate = enabled && !isWinner && !isPaid
  const pending = ok && !e?.loaded
  return { info, enabled, applied, isWinner, isPaid, closed, busy, gate, pending, ctaLabel: fcfsCtaLabel({ applied, closed, busy }), apply }
}
