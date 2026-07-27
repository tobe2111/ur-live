/**
 * 🟡 유어애즈 카카오 로그인 착지 (/ads/kakao) — 2026-07-27.
 *   서버 콜백(/api/ads-auth/kakao/callback)이 302 로 보낸 fragment(#t=ads_token)를 localStorage 에
 *   저장하고 /api/ads/auth/me 로 계정정보를 받아 이메일 로그인과 동일한 후처리(회사명 저장 +
 *   베타 액세스 게이트 분기). 토큰이 fragment 라 서버/로그/리퍼러에 안 남음(iOS-safe 표준 패턴).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'

export default function MarketingKakaoCallbackPage() {
  useUrAdsFavicon()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const m = window.location.hash.match(/[#&]t=([^&]+)/)
    const token = m ? decodeURIComponent(m[1]) : null
    // fragment 즉시 청소 — 뒤로가기/히스토리에 토큰 잔존 방지.
    try { window.history.replaceState({}, '', window.location.pathname) } catch { /* ignore */ }
    if (!token) { setFailed(true); return }
    localStorage.setItem('ads_token', token)
    let cancelled = false
    ;(async () => {
      try {
        const r = await api.get('/api/ads/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        if (cancelled) return
        const acc = r.data?.account
        if (!r.data?.success || !acc) { localStorage.removeItem('ads_token'); setFailed(true); return }
        localStorage.setItem('ads_account_id', String(acc.id ?? ''))
        localStorage.setItem('ads_company', acc.company_name || '')
        // 베타 액세스 코드 게이트 — 이메일 로그인(MarketingLoginPage)과 동일 분기.
        if (acc.access_unlocked === 1) { localStorage.setItem('ads_unlocked', '1'); navigate('/ads/dashboard', { replace: true }) }
        else { localStorage.removeItem('ads_unlocked'); navigate('/ads/unlock?next=%2Fads%2Fdashboard', { replace: true }) }
      } catch { if (!cancelled) { localStorage.removeItem('ads_token'); setFailed(true) } }
    })()
    return () => { cancelled = true }
  }, [navigate])

  return (
    <div className="force-light-theme" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#F4F5F7', color: '#0B0E14' }}>
      <UrAdsLogo size={28} />
      {failed ? (
        <>
          <p style={{ fontSize: 14, color: '#565E6C' }}>카카오 로그인에 실패했습니다. 다시 시도해주세요.</p>
          <a href="/ads/login" style={{ fontSize: 13.5, fontWeight: 700, color: '#2A56D4' }}>로그인 화면으로 →</a>
        </>
      ) : (
        <p style={{ fontSize: 14, color: '#565E6C' }}>카카오 로그인 처리 중…</p>
      )}
    </div>
  )
}
