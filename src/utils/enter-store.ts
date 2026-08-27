/**
 * 🏪 매장 좌석 진입 SSOT — "방금 만든/고른 매장으로 들어간다" (2026-08-26)
 *
 * 매장을 등록하거나 전환하면 **그 매장의 seller_token 을 받아 localStorage 에 심어야** 셀러 화면이
 * 열린다. 이 절차가 지금 세 곳에서 필요하다: 대시보드 매장 패널 · 지도의 사장님 클레임 · 매장 등록 페이지.
 *
 * 🩸 손으로 세 번 쓰면 반드시 갈린다 — 이 레포가 이미 겪은 클래스다(`linkshopPath` 가 BottomNav 와
 *   useLinkshopPath 에서 갈렸던 2026-06-19). 특히 여기서 갈리면 **한 경로에서만 좌석이 안 잡혀**
 *   "등록은 됐는데 내 매장으로 못 들어가는" 막다른 길이 생긴다(실제로 지도 경로가 그랬다).
 *
 * ⚠️ 실패해도 throw 하지 않는다. 매장은 **이미 서버에 만들어졌으므로**, 전환이 안 되면 대시보드로
 *   보내 거기서 이어가게 하는 것이 맞다 — 여기서 막으면 사장님은 자기 매장을 잃은 것처럼 느낀다.
 */
import api from '@/lib/api'

export async function enterStoreSeat(sellerId?: number | null): Promise<boolean> {
  const id = Number(sellerId)
  if (!Number.isFinite(id) || id <= 0) return false
  try {
    const r = await api.post(`/api/seller/stores/${id}/token`)
    const d = r.data?.data
    if (!r.data?.success || !d?.seller_token) return false
    localStorage.setItem('seller_token', d.seller_token)
    localStorage.setItem('seller_id', String(d.seller.id))
    if (d.seller.username) localStorage.setItem('seller_username', d.seller.username)
    localStorage.setItem('is_distributor', String(d.seller.is_distributor ?? 0))
    return true
  } catch {
    return false
  }
}
