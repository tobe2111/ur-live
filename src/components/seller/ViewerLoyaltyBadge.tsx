/**
 * Viewer Loyalty Badge — Phase 2-3 UI 통합
 *
 * 시청자 user_id 기반으로 본 셀러에 대한 충성도 등급 배지 표시.
 * 캐시: 5분 (같은 시청자 반복 호출 방지)
 *
 * 사용 예:
 *   <ViewerLoyaltyBadge userId={message.userId} sellerId={stream.seller_id} />
 *
 * 라이브 채팅 메시지 옆에 마운트 → 시청자 등급에 따라 차등 응대 가능.
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import {
  computeViewerLoyalty,
  VIEWER_LOYALTY_BADGE,
  VIEWER_LOYALTY_LABEL,
  type ViewerLoyalty,
} from '@/shared/utils/viewer-loyalty'

interface Props {
  userId: number
  /** 셀러 본인 시점이면 자동 계산 (token 의 seller). 다른 셀러 보고 싶으면 명시. */
  sellerId?: number
  /** 작은 배지로 표시 (default: true) */
  compact?: boolean
}

interface CacheEntry {
  loyalty: ViewerLoyalty
  fetchedAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, CacheEntry>()

function cacheKey(userId: number, sellerId: number) {
  return `${userId}:${sellerId}`
}

export default function ViewerLoyaltyBadge({ userId, sellerId, compact = true }: Props) {
  const [loyalty, setLoyalty] = useState<ViewerLoyalty | null>(null)

  useEffect(() => {
    if (!userId) return

    const key = cacheKey(userId, sellerId || 0)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setLoyalty(cached.loyalty)
      return
    }

    const token = localStorage.getItem('seller_token')
    if (!token) return

    api.get(`/api/seller/viewers/${userId}/loyalty`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.data?.success) return
        const stats = r.data.data
        const computed = computeViewerLoyalty({
          visits: stats.visits,
          payments: stats.payments,
          totalSpent: stats.total_spent,
        })
        cache.set(key, { loyalty: computed, fetchedAt: Date.now() })
        setLoyalty(computed)
      })
      .catch(() => {
        // 에러 시 표시 안 함 (조용히 fail)
      })
  }, [userId, sellerId])

  if (!loyalty) return null

  const meta = VIEWER_LOYALTY_BADGE[loyalty]

  if (compact) {
    return (
      <span
        className={`inline-flex items-center text-[10px] px-1.5 rounded font-medium ${meta.bg} ${meta.text}`}
        title={`시청자 등급: ${VIEWER_LOYALTY_LABEL[loyalty]}`}
      >
        {meta.emoji}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-bold ${meta.bg} ${meta.text}`}
    >
      {meta.emoji} {VIEWER_LOYALTY_LABEL[loyalty]}
    </span>
  )
}
