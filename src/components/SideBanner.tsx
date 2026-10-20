import { useEffect, useState } from 'react'
import { swallow } from '@/shared/utils/swallow'

interface SideBannerItem {
  id: number
  title: string
  image_url: string
  link_url: string | null
  sort_order: number
}

// 🛡️ 2026-05-22 사고 fix:
//   1) sessionStorage cache 5분 — 배너는 자주 바뀌지 않음. 라우트 전환 시 재호출 X.
//   2) 429 응답 시 60초 cooldown (in-memory). 무한 retry 차단.
//   3) 비활성 환경 (results=[]) 도 cache → 매 페이지 진입마다 호출 안 함.
const CACHE_KEY = 'ur_side_banners_v1'
const CACHE_TTL_MS = 5 * 60 * 1000
let cooldownUntil = 0  // module-scope, isolate cool-down

interface CacheEntry { ts: number; data: SideBannerItem[] }

function readCache(): SideBannerItem[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const e = JSON.parse(raw) as CacheEntry
    if (Date.now() - e.ts > CACHE_TTL_MS) return null
    return Array.isArray(e.data) ? e.data : null
  } catch { return null }
}
function writeCache(data: SideBannerItem[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data } satisfies CacheEntry))
  } catch { /* quota */ }
}

export default function SideBanner() {
  const [banners, setBanners] = useState<SideBannerItem[]>(() => readCache() ?? [])

  useEffect(() => {
    // 캐시 있으면 fetch skip (state 이미 초기화됨).
    if (readCache()) return
    // 429 후 60s cooldown — 무한 retry 차단.
    if (Date.now() < cooldownUntil) return

    fetch('/api/side-banners')
      .then(async (res) => {
        if (res.status === 429) {
          cooldownUntil = Date.now() + 60_000
          return { success: true, data: [] }
        }
        return res.json() as Promise<{ success: boolean; data: SideBannerItem[] }>
      })
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setBanners(data.data)
          writeCache(data.data)
        }
      })
      .catch(swallow('SideBanner:fetch'))
  }, [])

  if (banners.length === 0) return null

  return (
    <div className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-50 flex-col gap-3">
      {banners.map((banner) => {
        const content = (
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-[120px] rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 object-cover"
            loading="lazy"
          />
        )
        return banner.link_url ? (
          <a
            key={banner.id}
            href={banner.link_url}
            target="_blank" rel="noopener noreferrer"
            className="block rounded-xl overflow-hidden"
          >
            {content}
          </a>
        ) : (
          <div key={banner.id} className="rounded-xl overflow-hidden">
            {content}
          </div>
        )
      })}
    </div>
  )
}
