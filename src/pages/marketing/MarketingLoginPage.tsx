/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 독립 로그인 (/ads/login). 라이트 테마(대시보드·랜딩과 통일).
 *   자체 이메일/비밀번호 계정(ad_accounts). same-origin JSON 200(XHR) → iOS-safe.
 *   성공 시 ads_token(+계정정보) localStorage 저장 후 대시보드로.
 *   ⚠️ standalone 라이트 페이지 → 루트 force-light-theme(전역 .dark input 규칙 무력화).
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'

const DEFAULT_DEST = '/ads/dashboard'

const SCOPED_CSS = `
.ua-auth{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:radial-gradient(120% 100% at 50% -10%,#EEF2FB 0%,#F4F5F7 46%,#F4F5F7 100%);
  font-family:Pretendard,system-ui,-apple-system,sans-serif;color:#0B0E14;}
.ua-auth a{text-decoration:none;}
.ua-auth-card{width:100%;max-width:400px;background:#FFFFFF;border:1px solid #ECEDF1;border-radius:20px;
  padding:34px 28px;box-shadow:0 20px 54px -26px rgba(20,30,60,.28);}
.ua-auth-input{width:100%;height:46px;border-radius:12px;background:#FFFFFF;border:1px solid #D9DEEA;
  padding:0 14px;font-size:14px;color:#0B0E14 !important;outline:none;}
.ua-auth-input:focus{border-color:#3B6EF5;}
.ua-auth-input::placeholder{color:#9AA3B5;}
.ua-auth-btn{width:100%;height:48px;border-radius:13px;background:#3B6EF5;color:#fff;font-size:15px;font-weight:800;
  transition:filter .15s,transform .05s;}
.ua-auth-btn:hover{filter:brightness(1.06);} .ua-auth-btn:active{transform:translateY(1px);}
.ua-auth-btn:disabled{opacity:.55;}
.ua-auth-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.18em;color:#8A93A3;}
.ua-kakao-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:48px;border-radius:13px;
  background:#FEE500;color:#191919 !important;font-size:15px;font-weight:800;transition:filter .15s,transform .05s;}
.ua-kakao-btn:hover{filter:brightness(.97);} .ua-kakao-btn:active{transform:translateY(1px);}
`

// 카카오 콜백 실패 사유(→ /ads/login?error=) 한국어화 — 미지정 코드는 일반 메시지.
const KAKAO_ERR: Record<string, string> = {
  kakao_denied: '카카오 로그인이 취소되었습니다',
  state_mismatch: '보안 검증에 실패했습니다 — 다시 시도해주세요',
  kakao_env: '카카오 로그인이 아직 설정되지 않았습니다',
  kakao_token: '카카오 인증에 실패했습니다 — 다시 시도해주세요',
  kakao_profile: '카카오 프로필을 불러오지 못했습니다',
}

export default function MarketingLoginPage() {
  useUrAdsFavicon()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nextRaw = params.get('next') || ''
  const dest = /^\/ads(\/|$)/.test(nextRaw) ? nextRaw : DEFAULT_DEST

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  // 카카오 콜백 실패(?error=)는 초기 에러로 표시 — 이후 입력 시도가 지움.
  const kakaoErr = params.get('error')
  const [err, setErr] = useState<string | null>(kakaoErr ? (KAKAO_ERR[kakaoErr] || '카카오 로그인에 실패했습니다') : null)

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('ads_token')) navigate(dest, { replace: true })
  }, [navigate, dest])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) { setErr('이메일과 비밀번호를 입력해주세요'); return }
    setBusy(true); setErr(null)
    try {
      const r = await api.post('/api/ads/auth/login', { email: email.trim(), password })
      if (r.data?.success && r.data.token) {
        localStorage.setItem('ads_token', r.data.token)
        localStorage.setItem('ads_account_id', String(r.data.account?.id ?? ''))
        localStorage.setItem('ads_company', r.data.account?.company_name || '')
        // 베타 액세스 코드 게이트: 해제된 계정만 대시보드로, 아니면 코드 입력 화면.
        if (r.data.account?.access_unlocked === 1) { localStorage.setItem('ads_unlocked', '1'); navigate(dest, { replace: true }) }
        else { localStorage.removeItem('ads_unlocked'); navigate(`/ads/unlock?next=${encodeURIComponent(dest)}`, { replace: true }) }
      } else setErr(r.data?.error || '로그인에 실패했습니다')
    } catch (e2: unknown) {
      setErr((e2 as { response?: { data?: { error?: string } } })?.response?.data?.error || '로그인에 실패했습니다')
    } finally { setBusy(false) }
  }

  const signupHref = `/ads/signup${nextRaw ? `?next=${encodeURIComponent(dest)}` : ''}`

  return (
    <div className="ua-auth force-light-theme">
      <SEO title="유어애즈 로그인 - UR Ads" description="유어애즈에 로그인하세요. 네이버 검색광고 자동입찰·통합 실적·AI 마케터." url="/ads/login" />
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <form className="ua-auth-card" onSubmit={submit}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link to="/ads" aria-label="유어애즈" style={{ color: '#0B0E14' }}><UrAdsLogo size={30} /></Link>
        </div>
        <p className="ua-auth-mono" style={{ textAlign: 'center', marginTop: 22 }}>UR ADS · SIGN IN</p>
        <h1 style={{ textAlign: 'center', marginTop: 8, fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: '#0B0E14' }}>유어애즈 로그인</h1>

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="ua-auth-input" type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="ua-auth-input" type="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {err && <p style={{ marginTop: 10, fontSize: 12.5, color: '#DC2626' }}>{err}</p>}

        <button type="submit" className="ua-auth-btn" style={{ marginTop: 16 }} disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>

        {/* 🟡 카카오 로그인 — /api/ads-auth/kakao/start (서버 302 → 카카오 인가 → 콜백 → /ads/kakao) */}
        <a href="/api/ads-auth/kakao/start" className="ua-kakao-btn" style={{ marginTop: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#191919" aria-hidden><path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65l-.95 3.54c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.86C22 6.54 17.52 3 12 3z" /></svg>
          카카오로 시작하기
        </a>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Link to="/ads/forgot" style={{ fontSize: 12.5, color: '#8A93A3' }}>비밀번호를 잊으셨나요?</Link>
        </div>

        <div style={{ marginTop: 14, paddingTop: 16, borderTop: '1px solid #ECEDF1', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: '#565E6C' }}>아직 계정이 없으신가요? </span>
          <Link to={signupHref} style={{ fontSize: 13, color: '#2A56D4', fontWeight: 700 }}>회원가입</Link>
        </div>
      </form>
    </div>
  )
}
