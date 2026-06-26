/**
 * 🛡️ 2026-05-25: `/u/me` → 본인 큐레이터 공개페이지 redirect.
 *
 * 사용자 결정: 링크샵 탭은 본인 공개페이지 (`/u/:handle`) 로.
 * 핸들이 없으면 `/creator`(콘솔). (2026-06-17 HOSTING_HIDDEN — /host/new 숨김; 핀은 상품에서 추가)
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
        // 🛡️ 2026-06-26 (소비자 감사 P1): 일시 5xx/콜드 D1 을 '핸들 없음'으로 오인해 기존 유저를 /creator
        //   콘솔로 떨구지 않도록, 비-401 실패면 1회 재시도 후에만 폴백 진입.
        let res: any
        try {
          res = await curatorApi.getDashboard() as any
        } catch (e1: any) {
          if (e1?.response?.status === 401) throw e1
          await new Promise((r) => setTimeout(r, 800))
          res = await curatorApi.getDashboard() as any
        }
        if (!alive) return
        const handle: string | null = res?.handle ?? null
        const linkedSeller = res?.linked_seller as { id: number; username: string } | null | undefined

        // 🛡️ 2026-05-25: localStorage cache — 다음 클릭부터 BottomNav 가 직접 navigate (UMeRedirect 거치지 X)
        try {
          if (linkedSeller?.username) localStorage.setItem('linked_seller_username', linkedSeller.username)
          else localStorage.removeItem('linked_seller_username')
          if (handle) localStorage.setItem('user_handle', handle)
        } catch { /* ignore */ }

        // 🔗 2026-06-17 (사용자 결정 — /u/ 단일화): 큐레이터 핸들(/u/{handle}) 우선.
        //   셀러여도 /u/{handle} 가 CuratorPage 에서 linked_seller 면 storefront inline → URL 통일.
        if (handle) {
          navigate(`/u/${handle}`, { replace: true })
          return
        }
        if (linkedSeller?.username) {
          navigate(`/profile/${linkedSeller.username}`, { replace: true })
          return
        }
        // 🛡️ 2026-05-27 (큐레이터 모델 영구): dashboard endpoint 가 handle 자동 생성 → 여기 도달 거의 X.
        //   🏁 2026-06-17 (HOSTING_HIDDEN): generation 실패 폴백을 /host/new → /creator(콘솔)로. 핀은 상품에서 추가.
        navigate('/creator', { replace: true })
      } catch (err: any) {
        if (err?.response?.status === 401) {
          navigate('/login?returnUrl=' + encodeURIComponent('/u/me'), { replace: true })
        } else {
          // localStorage fallback
          const cached = (() => { try { return localStorage.getItem('user_handle') } catch { return null } })()
          if (cached) navigate(`/u/${cached}`, { replace: true })
          else navigate('/creator', { replace: true })  // 🏁 2026-06-17 (HOSTING_HIDDEN): /host/new → /creator
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
