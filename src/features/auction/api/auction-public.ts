/**
 * 🔐 2026-11-17 경매 공개 응답 — 로그인 없는 조회에는 입찰자·낙찰자의 실명(카카오 이름)과 유저 id 를 주지 않는다.
 * 이름은 첫 글자만(`정**`), 낙찰 여부는 `has_winner` 로.
 */
import { maskName } from '@/worker/utils/store-actor'

export const publicAuction = (a: Record<string, unknown>) => {
  const { winner_user_id: _w, ...rest } = a
  return { ...rest, winner_name: maskName(a.winner_name), has_winner: a.winner_user_id != null }
}

export const publicBid = (b: Record<string, unknown>) => ({ ...b, user_name: maskName(b.user_name) })
