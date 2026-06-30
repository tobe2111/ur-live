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
`

export default function MarketingLoginPage() {
  useUrAdsFavicon()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nextRaw = params.get('next') || ''
  const dest = /^\/ads(\/|$)/.test(nextRaw) ? nextRaw : DEFAULT_DEST

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

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
        navigate(dest, { replace: true })
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
