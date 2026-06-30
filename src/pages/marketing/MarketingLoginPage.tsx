/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 독립 로그인 (/ads/login).
 *
 *   대표 결정(2026-06-28): "유어애즈는 유어딜·도매몰과 전혀 무관" → 셀러/카카오 의존 제거.
 *   자체 이메일/비밀번호 계정(ad_accounts)으로 로그인. same-origin JSON 200(XHR) → iOS-safe.
 *   성공 시 ads_token(+계정정보) localStorage 저장 후 대시보드로.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'

const DEFAULT_DEST = '/ads/dashboard'

const SCOPED_CSS = `
.ua-login{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:radial-gradient(120% 100% at 50% -10%,#101A36 0%,#0A0E1C 42%,#06080F 100%);
  font-family:Pretendard,system-ui,-apple-system,sans-serif;color:#E7ECF7;}
.ua-login a{text-decoration:none;}
.ua-login-card{width:100%;max-width:400px;background:#0E1322;border:1px solid #1B2233;border-radius:20px;
  padding:34px 28px;box-shadow:0 24px 60px -20px rgba(0,0,0,.6);}
.ua-login-input{width:100%;height:46px;border-radius:12px;background:#070B16;border:1px solid #232C42;
  padding:0 14px;font-size:14px;color:#E7ECF7 !important;outline:none;}
.ua-login-input:focus{border-color:#3B6EF5;}
.ua-login-input::placeholder{color:#5B678A;}
.ua-login-btn{width:100%;height:48px;border-radius:13px;background:#3B6EF5;color:#fff;font-size:15px;font-weight:800;
  transition:filter .15s,transform .05s;}
.ua-login-btn:hover{filter:brightness(1.06);} .ua-login-btn:active{transform:translateY(1px);}
.ua-login-btn:disabled{opacity:.55;}
.ua-login-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.18em;color:#7E8AA8;}
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
    <div className="ua-login">
      <SEO title="유어애즈 로그인 - UR Ads" description="유어애즈에 로그인하세요. 네이버 검색광고 자동입찰·통합 실적·AI 마케터." url="/ads/login" />
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <form className="ua-login-card" onSubmit={submit}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link to="/ads" aria-label="유어애즈" style={{ color: '#fff' }}><UrAdsLogo size={30} /></Link>
        </div>
        <p className="ua-login-mono" style={{ textAlign: 'center', marginTop: 22 }}>UR ADS · SIGN IN</p>
        <h1 style={{ textAlign: 'center', marginTop: 8, fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: '#fff' }}>유어애즈 로그인</h1>

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="ua-login-input" type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="ua-login-input" type="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {err && <p style={{ marginTop: 10, fontSize: 12.5, color: '#F87171' }}>{err}</p>}

        <button type="submit" className="ua-login-btn" style={{ marginTop: 16 }} disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #1B2233', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: '#9AA6C2' }}>아직 계정이 없으신가요? </span>
          <Link to={signupHref} style={{ fontSize: 13, color: '#7EA2FF', fontWeight: 700 }}>회원가입</Link>
        </div>
      </form>
    </div>
  )
}
