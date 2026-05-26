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

        if (linkedSeller?.username) {
          navigate(`/profile/${linkedSeller.username}`, { replace: true })
          return
        }
        if (handle) {
          try { localStorage.setItem('user_handle', handle) } catch {}
          navigate(`/u/${handle}`, { replace: true })
          return
        }
        // 핸들 없음 → 첫 핀 추가 (카탈로그) — 첫 핀 시 자동 handle 생성
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
