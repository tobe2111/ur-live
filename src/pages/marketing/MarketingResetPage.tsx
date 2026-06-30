/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 비밀번호 재설정 (/ads/reset?token=). 라이트.
 *   토큰으로 새 비밀번호 설정 → 성공 시 로그인으로.
 */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'
import { toast } from '@/hooks/useToast'

const SCOPED_CSS = `
.ua-auth{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:radial-gradient(120% 100% at 50% -10%,#EEF2FB 0%,#F4F5F7 46%,#F4F5F7 100%);
  font-family:Pretendard,system-ui,-apple-system,sans-serif;color:#0B0E14;}
.ua-auth a{text-decoration:none;}
.ua-auth-card{width:100%;max-width:400px;background:#FFFFFF;border:1px solid #ECEDF1;border-radius:20px;
  padding:34px 28px;box-shadow:0 20px 54px -26px rgba(20,30,60,.28);}
.ua-auth-input{width:100%;height:46px;border-radius:12px;background:#FFFFFF;border:1px solid #D9DEEA;
  padding:0 14px;font-size:14px;color:#0B0E14 !important;outline:none;}
.ua-auth-input:focus{border-color:#3B6EF5;} .ua-auth-input::placeholder{color:#9AA3B5;}
.ua-auth-btn{width:100%;height:48px;border-radius:13px;background:#3B6EF5;color:#fff;font-size:15px;font-weight:800;}
.ua-auth-btn:disabled{opacity:.55;}
.ua-auth-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.18em;color:#8A93A3;}
`

export default function MarketingResetPage() {
  useUrAdsFavicon()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!pw) { setErr('새 비밀번호를 입력해주세요'); return }
    setBusy(true); setErr(null)
    try {
      const r = await api.post('/api/ads/auth/reset', { token, new_password: pw })
      if (r.data?.success) { toast.success('비밀번호가 변경되었습니다. 로그인해주세요.'); navigate('/ads/login', { replace: true }) }
      else setErr(r.data?.error || '재설정에 실패했습니다')
    } catch (e2: unknown) {
      setErr((e2 as { response?: { data?: { error?: string } } })?.response?.data?.error || '재설정에 실패했습니다')
    } finally { setBusy(false) }
  }

  return (
    <div className="ua-auth force-light-theme">
      <SEO title="비밀번호 재설정 - UR Ads" description="유어애즈 비밀번호 재설정" url="/ads/reset" noindex />
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <form className="ua-auth-card" onSubmit={submit}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link to="/ads" aria-label="유어애즈" style={{ color: '#0B0E14' }}><UrAdsLogo size={30} /></Link>
        </div>
        <p className="ua-auth-mono" style={{ textAlign: 'center', marginTop: 22 }}>UR ADS · NEW PASSWORD</p>
        <h1 style={{ textAlign: 'center', marginTop: 8, fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: '#0B0E14' }}>새 비밀번호 설정</h1>

        {!token ? (
          <>
            <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#DC2626' }}>유효하지 않은 링크입니다. 재설정을 다시 요청해주세요.</p>
            <Link to="/ads/forgot" className="ua-auth-btn" style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>재설정 다시 요청</Link>
          </>
        ) : (
          <>
            <input className="ua-auth-input" style={{ marginTop: 20 }} type="password" autoComplete="new-password" placeholder="새 비밀번호 (10자 이상·대소문자·숫자·특수문자)" value={pw} onChange={(e) => setPw(e.target.value)} />
            {err && <p style={{ marginTop: 10, fontSize: 12.5, color: '#DC2626' }}>{err}</p>}
            <button type="submit" className="ua-auth-btn" style={{ marginTop: 14 }} disabled={busy}>{busy ? '변경 중…' : '비밀번호 변경'}</button>
          </>
        )}
      </form>
    </div>
  )
}
