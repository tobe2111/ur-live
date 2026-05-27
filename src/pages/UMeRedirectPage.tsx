/**
 * 🛡️ 2026-05-25: `/u/me` → 본인 큐레이터 공개페이지 redirect.
 *
 * 사용자 결정: 링크샵 탭은 본인 공개페이지 (`/u/:handle`) 로.
 * 핸들이 없으면 `/host/new` (카탈로그 + 핀 시작 안내).
 * 비로그인이면 `/login?returnUrl=/u/me`.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { curatorApi } from '@/features/curator/api/curator-api'

export default function UMeRedirectPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // 🛡️ 2026-05-25 (loading P0): getDashboard 응답에 handle + linked_seller 동봉.
        //   linked_seller 있으면 바로 /profile/{username} (셀러 공개페이지) 직행.
        //   → 이전 3-step 직렬 (/u/me → /u/{handle} → /profile/...) 1-step 단축.
        const res = await curatorApi.getDashboard() as any
        if (!alive) return
        const handle: string | null = res?.handle ?? null
        const linkedSeller = res?.linked_seller as { id: number; username: string } | null | undefined

        // 🛡️ 2026-05-25: localStorage cache — 다음 클릭부터 BottomNav 가 직접 navigate (UMeRedirect 거치지 X)
        try {
          if (linkedSeller?.username) localStorage.setItem('linked_seller_username', linkedSeller.username)
          else localStorage.removeItem('linked_seller_username')
          if (handle) localStorage.setItem('user_handle', handle)
        } catch { /* ignore */ }

        if (linkedSeller?.username) {
          navigate(`/profile/${linkedSeller.username}`, { replace: true })
          return
        }
        if (handle) {
          navigate(`/u/${handle}`, { replace: true })
          return
        }
        // 🛡️ 2026-05-27 (큐레이터 모델 영구): dashboard endpoint 가 handle 자동 생성 → 여기 도달 거의 X.
        //   극히 드문 generation 실패 case 만 fallback → /host/new (재시도 / 첫 핀 추가 안내).
        navigate('/host/new', { replace: true })
      } catch (err: any) {
        if (err?.response?.status === 401) {
          navigate('/login?returnUrl=' + encodeURIComponent('/u/me'), { replace: true })
        } else {
          // localStorage fallback
          const cached = (() => { try { return localStorage.getItem('user_handle') } catch { return null } })()
          if (cached) navigate(`/u/${cached}`, { replace: true })
          else navigate('/host/new', { replace: true })
        }
      }
    })()
    return () => { alive = false }
  }, [navigate])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
      <div className="text-sm text-gray-500 dark:text-gray-400">⏳ 링크샵 로딩 중...</div>
    </div>
  )
}
