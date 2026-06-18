import { useEffect, useState } from 'react'

/**
 * 🔗 2026-06-17 (대표 신고 — PC 에 링크샵 진입 버튼 없음): 본인 링크샵(공개페이지) 경로.
 *   BottomNav.tsx 의 linkshopPath 로직과 동일한 우선순위를 공유(잠긴 BottomNav 는 미변경 — 이 훅은 PC 네비 전용 추가분).
 *     seller_username → linked_seller_username → user_handle → /u/me(UMeRedirectPage 가 해석).
 *     🔗 2026-06-17: 비로그인도 /u/me (로그인 후 본인 핸들 해석; 핸들 없는 신규만 /host/new 폴백). 기존 유저가 만들기 페이지에 떨궈지던 것 수정.
 *   localStorage 캐시 우선(0-RTT). reserved/짧은 핸들은 무시하고 /u/me 로 자연 fallback. SSR-safe.
 */
const RESERVED = new Set(['user', 'me', 'admin', 'seller', 'api', 'host', 'new'])
const badHandle = (v: string | null): boolean => !v || v.length < 3 || RESERVED.has(v.toLowerCase())

export function useLinkshopPath(): string {
  const [path, setPath] = useState('/u/me')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasSellerToken = !!localStorage.getItem('seller_token')
    const isLoggedIn = !!(localStorage.getItem('user_id') || localStorage.getItem('session_login') || hasSellerToken)
    // 🔗 2026-06-17 [UNLOCK_LOADING] (사용자 "가장 이상적으로"): 로그아웃 → /host/new(만들기) 대신 /u/me.
    //   로그인 후 본인 핸들 해석 → 기존 유저 /u/{handle}, 신규만 UMeRedirect 가 /host/new 폴백.
    if (!isLoggedIn) { setPath('/u/me'); return }
    try {
      const sellerUsername = localStorage.getItem('seller_username')
      if (sellerUsername && !badHandle(sellerUsername)) { setPath(`/profile/${sellerUsername}`); return }
      const cachedSeller = localStorage.getItem('linked_seller_username')
      if (cachedSeller && !badHandle(cachedSeller)) { setPath(`/profile/${cachedSeller}`); return }
      const cachedHandle = localStorage.getItem('user_handle')
      if (cachedHandle && !badHandle(cachedHandle)) { setPath(`/u/${cachedHandle}`); return }
    } catch { /* ignore */ }
    setPath('/u/me')
  }, [])
  return path
}
