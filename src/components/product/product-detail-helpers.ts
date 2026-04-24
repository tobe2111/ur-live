import type { GroupTier } from '@/components/product/product-detail-types'

export const DEFAULT_TIERS: GroupTier[] = [
  { count: 2, discount: 10 },
  { count: 5, discount: 20 },
  { count: 10, discount: 30 },
]

export function parseTiers(raw: unknown): GroupTier[] {
  if (!raw) return DEFAULT_TIERS
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(arr) && arr.length > 0) {
      return arr
        .filter((t: unknown): t is GroupTier => {
          const item = t as Record<string, unknown>
          return typeof item?.count === 'number' && typeof item?.discount === 'number'
        })
        .sort((a: GroupTier, b: GroupTier) => a.count - b.count)
    }
  } catch {
    // fall through
  }
  return DEFAULT_TIERS
}

export function formatTimeRemaining(expiresAt?: string): string {
  if (!expiresAt) return ''
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return '마감됨'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}일 ${h}시간 남음`
  if (h > 0) return `${h}시간 ${m}분 남음`
  return `${m}분 남음`
}
