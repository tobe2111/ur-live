/**
 * 🏨 숙소 상세를 **누르기 전에** 데운다 (2026-10-15 — 대표 *"쓸데없는 페이지들이 로딩 중에 잠깐잠깐 뜨거든?
 * 이런 부분들 전체 페이지 전수조사"*).
 *
 * 라이브 실측(아이폰13): `/stays` → `/stays/:id` 이동이 [풀스크린 로더 ~0.2초 → 상세] 였다. 숙소 상세는
 * 화면 코드도, 데이터(`/api/group-buy/stays/:id` — 리액트 쿼리 밖의 생 요청)도 **누른 뒤에야** 받기 시작했다.
 * 숙소 카드(`GroupBuyFeedCard`)의 미리받기는 이용권(`/pass`) 화면을 데우고 있어서 숙소엔 소용이 없었다.
 *
 * 한 모듈에서 **같은 요청을 공유**한다 — 데운 요청이 아직 날아가는 중이면 상세가 새로 묻지 않고 그걸 이어받고
 * (`stayDetailRequest`), 이미 도착했으면 첫 렌더에 동기로 쓴다(`peekWarmStay`). 둘이 갈리면 받아 놓고 못 쓴다.
 */
import api from '@/lib/api'
import { loadRoute } from '@/lib/route-preload' // App.tsx 가 등록한 같은 로더 — 받으면 화면이 '준비됨'이 된다

export interface WarmStayResponse { success?: boolean; data?: { product?: unknown; rooms?: unknown } }

let chunkWarm = false
const inflight = new Map<number, Promise<WarmStayResponse>>()
const ready = new Map<number, { at: number; body: WarmStayResponse }>()
/** 데운 값을 믿는 시간 — 상세는 마운트 뒤 어차피 최신을 다시 확인한다(표시만 앞당긴다). */
const FRESH_MS = 60_000
const MAX = 30

/** 같은 숙소 상세 요청을 하나로 묶는다. 실패하면 비워서 다음에 다시 묻게 한다. */
export function stayDetailRequest(id: number): Promise<WarmStayResponse> {
  const cur = inflight.get(id)
  if (cur) return cur
  const p = api.get(`/api/group-buy/stays/${id}`)
    .then((r) => {
      const body = r.data as WarmStayResponse
      ready.set(id, { at: Date.now(), body })
      if (ready.size > MAX) ready.delete(ready.keys().next().value as number)
      return body
    })
    .finally(() => { inflight.delete(id) })
  inflight.set(id, p)
  return p
}

/** 이미 도착한 데운 값(신선할 때만) — 상세 첫 렌더가 동기로 쓴다. */
export function peekWarmStay(id: number): WarmStayResponse | null {
  const hit = ready.get(id)
  if (!hit || Date.now() - hit.at > FRESH_MS) return null
  return hit.body
}

/** 화면 코드 + 데이터를 데운다. 손가락이 닿은 순간·카드가 선택된 순간에 부른다. */
export function warmStayDetail(id: number | string): void {
  const n = Number(id)
  if (!Number.isFinite(n) || n <= 0) return
  if (!chunkWarm) { chunkWarm = true; loadRoute('stayDetail').catch(() => { chunkWarm = false }) }
  if (!peekWarmStay(n)) stayDetailRequest(n).catch(() => { /* 상세가 다시 묻는다 */ })
}
