/**
 * 🚑 2026-07-10 [UNLOCK_LOADING] (로딩 전수조사 — 사업자 링크샵 워터폴 완화):
 *   `/u/:handle`(사업자)는 [curator fetch → SellerPublicPage lazy 청크 → seller /public fetch]가
 *   완전 직렬이라 로더가 2-RTT+청크만큼 길었다. 이 모듈은 셀러 `/public` 페치를 in-flight 공유로 —
 *   CuratorPage(부모)가 linked_seller 를 확인한 순간 warm 을 시작하고, SellerPublicPage(lazy 자식)가
 *   마운트 후 같은 promise 를 이어받아 [curator → max(청크, seller fetch)]로 겹친다.
 *
 *   ⚠️ CuratorPage 에서 SellerPublicPage 모듈을 직접 import 하면 lazy 청크 분리가 깨지므로
 *   (페이지 전체가 부모 청크에 딸려옴) 반드시 이 독립 모듈을 통해서만 공유할 것.
 */
import api from '@/lib/api'

const inflight = new Map<string, Promise<unknown>>()
const done = new Map<string, { data: unknown; ts: number }>()
const TTL_MS = 60_000

/** 셀러 공개 프로필 fetch — 같은 id 의 동시/최근(60s) 요청은 1회로 dedupe. 실패는 캐시하지 않음. */
export function fetchSellerPublicShared(sellerId: string | number): Promise<unknown> {
  const key = String(sellerId)
  const hit = done.get(key)
  if (hit && Date.now() - hit.ts < TTL_MS) return Promise.resolve(hit.data)
  const cur = inflight.get(key)
  if (cur) return cur
  const p = api
    .get(`/api/sellers/${encodeURIComponent(key)}/public`)
    .then((r) => {
      const d = r.data?.data ?? null
      done.set(key, { data: d, ts: Date.now() })
      return d as unknown
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

/** fire-and-forget 워밍 (실패 무시 — 자식이 재시도). */
export function warmSellerPublic(sellerId: string | number | undefined | null) {
  if (sellerId == null || sellerId === '') return
  fetchSellerPublicShared(sellerId).catch(() => { /* 자식 fetch 가 fallback */ })
}
