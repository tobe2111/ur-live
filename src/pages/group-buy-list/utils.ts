/**
 * 🛡️ 2026-05-02: TD-018 분할 — GroupBuyListPage 시간/할인율 헬퍼.
 */
import type { GroupBuyProduct } from './types'

// 남은 시간 포맷
export function formatTimeLeft(deadline?: string): string {
  if (!deadline) return ''
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return '마감'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return `${days}일 ${hours}시간 남음`
  if (hours > 0) return `${hours}시간 ${mins}분 남음`
  return `${mins}분 남음`
}

// 최대 할인율 계산
export function calcDiscountRate(p: GroupBuyProduct): number {
  if (!p.original_price || p.original_price <= p.price) return 0
  return Math.round((1 - p.price / p.original_price) * 100)
}
