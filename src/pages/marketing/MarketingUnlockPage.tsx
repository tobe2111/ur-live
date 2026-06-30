/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 베타 액세스 코드 게이트 (/ads/unlock). 라이트.
 *   로그인(가입)했어도 액세스 코드를 입력해야 대시보드 진입(계정별 1회 해제, 서버 플래그).
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
.ua-auth-card{width:100%;max-width:380px;background:#FFFFFF;border:1px solid #ECEDF1;border-radius:20px;
  padding:34px 28px;box-shadow:0 20px 54px -26px rgba(20,30,60,.28);}
.ua-auth-input{width:100%;height:50px;border-radius:12px;background:#FFFFFF;border:1px solid #D9DEEA;
  padding:0 14px;font-size:20px;letter-spacing:.3em;text-align:center;color:#0B0E14 !important;outline:none;}
.ua-auth-input:focus{border-color:#3B6EF5;} .ua-auth-input::placeholder{color:#C2C9D6;letter-spacing:.1em;font-size:14px;}
.ua-auth-btn{width:100%;height:48px;border-radius:13px;background:#3B6EF5;color:#fff;font-size:15px;font-weight:800;}
.ua-auth-btn:disabled{opacity:.55;}
.ua-auth-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.18em;color:#8A93A3;}
`

export default function MarketingUnlockPage() {
  useUrAdsFavicon()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nextRaw = params.get('next') || ''
  const dest = /^\/ads(\/|$)/.test(nextRaw) ? nextRaw : DEFAULT_DEST

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem('ads_token')) { navigate('/ads/login', { replace: true }); return }
      if (localStorage.getItem('ads_unlocked') === '1') navigate(dest, { replace: true })
    }
  }, [navigate, dest])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) { setErr('액세스 코드를 입력해주세요'); return }
    setBusy(true); setErr(null)
    try {
      const r = await api.post('/api/ads/auth/unlock', { code: code.trim() }, { headers: { Authorization: `Bearer ${localStorage.getItem('ads_token')}` } })
      if (r.data?.success) { localStorage.setItem('ads_unlocked', '1'); navigate(dest, { replace: true }) }
      else setErr(r.data?.error || '코드가 올바르지 않습니다')
    } catch (e2: unknown) {
      setErr((e2 as { response?: { data?: { error?: string } } })?.response?.data?.error || '코드가 올바르지 않습니다')
    } finally { setBusy(false) }
  }

  function logout() {
    for (const k of ['ads_token', 'ads_account_id', 'ads_company', 'ads_unlocked']) localStorage.removeItem(k)
    navigate('/ads/login', { replace: true })
  }

  return (
    <div className="ua-auth force-light-theme">
      <SEO title="유어애즈 액세스 코드 - UR Ads" description="유어애즈 베타 액세스 코드 입력" url="/ads/unlock" noindex />
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <form className="ua-auth-card" onSubmit={submit}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link to="/ads" aria-label="유어애즈" style={{ color: '#0B0E14' }}><UrAdsLogo size={30} /></Link>
        </div>
        <p className="ua-auth-mono" style={{ textAlign: 'center', marginTop: 22 }}>UR ADS · ACCESS</p>
        <h1 style={{ textAlign: 'center', marginTop: 8, fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', color: '#0B0E14' }}>액세스 코드 입력</h1>
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13, lineHeight: 1.6, color: '#565E6C' }}>유어애즈는 현재 초대제로 운영됩니다.<br />발급받은 액세스 코드를 입력해주세요.</p>

        <input className="ua-auth-input" style={{ marginTop: 20 }} inputMode="numeric" autoComplete="off"
          placeholder="● ● ● ● ● ●" value={code} onChange={(e) => setCode(e.target.value)} maxLength={16} />
        {err && <p style={{ marginTop: 10, fontSize: 12.5, color: '#DC2626', textAlign: 'center' }}>{err}</p>}
        <button type="submit" className="ua-auth-btn" style={{ marginTop: 16 }} disabled={busy}>{busy ? '확인 중…' : '입장하기'}</button>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button type="button" onClick={logout} style={{ fontSize: 12.5, color: '#8A93A3', background: 'none', border: 'none', cursor: 'pointer' }}>다른 계정으로 로그인</button>
        </div>
      </form>
    </div>
  )
}
