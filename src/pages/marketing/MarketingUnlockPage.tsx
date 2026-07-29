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
@font-face{font-family:'PretendardV';src:url(https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/woff2/PretendardVariable.woff2) format('woff2-variations');font-weight:45 920;font-style:normal;font-display:swap}
.ua-auth{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:radial-gradient(120% 100% at 50% -10%,#EEF2FB 0%,#F4F5F7 46%,#F4F5F7 100%);
  font-family:"Pretendard Variable","PretendardV",Pretendard,system-ui,-apple-system,sans-serif;color:#0B0E14;}
.ua-auth a{text-decoration:none;}
.ua-auth-card{width:100%;max-width:380px;background:#FFFFFF;border:1px solid #ECEDF1;border-radius:20px;
  padding:34px 28px;box-shadow:0 20px 54px -26px rgba(20,30,60,.28);}
.ua-auth-input{width:100%;height:50px;border-radius:12px;background:#FFFFFF;border:1px solid #D9DEEA;
  padding:0 14px;font-size:20px;letter-spacing:.3em;text-align:center;color:#0B0E14 !important;outline:none;}
.ua-auth-input:focus{border-color:#3B6EF5;} .ua-auth-input::placeholder{color:#C2C9D6;letter-spacing:.1em;font-size:14px;}
.ua-auth-btn{width:100%;height:48px;border-radius:13px;background:#3B6EF5;color:#fff;font-size:15px;font-weight:800;}
.ua-auth-btn:disabled{opacity:.55;}
.ua-auth-mono{font-size:11px;letter-spacing:.18em;color:#8A93A3;}
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
  // 📥 입장 요청 상태 — null(미요청)/pending/approved/rejected
  const [reqStatus, setReqStatus] = useState<string | null>(null)
  const [reqBusy, setReqBusy] = useState(false)
  const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('ads_token')}` })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem('ads_token')) { navigate('/ads/login', { replace: true }); return }
      if (localStorage.getItem('ads_unlocked') === '1') { navigate(dest, { replace: true }); return }
    }
    // 어드민이 승인해 둔 경우 자동 입장(서버 플래그가 SSOT — 코드 입력 불필요) + 기존 요청 상태 표시.
    let cancelled = false
    ;(async () => {
      try {
        const me = await api.get('/api/ads/auth/me', { headers: authH() })
        if (cancelled) return
        if (me.data?.account?.access_unlocked === 1) { localStorage.setItem('ads_unlocked', '1'); navigate(dest, { replace: true }); return }
        const rq = await api.get('/api/ads/auth/request-access', { headers: authH() })
        if (!cancelled && rq.data?.success) setReqStatus(rq.data.request?.status || null)
      } catch { /* 상태 조회 실패는 무해 — 기본 UI 유지 */ }
    })()
    return () => { cancelled = true }
  }, [navigate, dest])

  async function requestAccess() {
    setReqBusy(true)
    try {
      const r = await api.post('/api/ads/auth/request-access', {}, { headers: authH() })
      if (r.data?.unlocked) { localStorage.setItem('ads_unlocked', '1'); navigate(dest, { replace: true }); return }
      if (r.data?.success) setReqStatus('pending')
      else setErr(r.data?.error || '요청에 실패했습니다')
    } catch { setErr('요청에 실패했습니다 — 잠시 후 다시 시도해주세요') } finally { setReqBusy(false) }
  }

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

        {/* 📥 코드가 없는 가입자 — 원클릭 입장 요청(어드민 승인 큐). 승인되면 재방문 시 자동 입장. */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #ECEDF1', textAlign: 'center' }}>
          {reqStatus === 'pending' ? (
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: '#0E8C5A', margin: 0 }}>✅ 입장 요청이 접수되었습니다.<br />승인되면 다시 로그인할 때 자동으로 입장됩니다.</p>
          ) : reqStatus === 'rejected' ? (
            <>
              <p style={{ fontSize: 12.5, color: '#8A93A3', margin: '0 0 8px' }}>이전 요청이 승인되지 않았습니다. 다시 요청할 수 있어요.</p>
              <button type="button" onClick={requestAccess} disabled={reqBusy} style={{ fontSize: 13, fontWeight: 700, color: '#2A56D4', background: 'none', border: '1px solid #D9DEEA', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}>{reqBusy ? '요청 중…' : '다시 입장 요청하기'}</button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: '#8A93A3', margin: '0 0 8px' }}>액세스 코드가 없으신가요?</p>
              <button type="button" onClick={requestAccess} disabled={reqBusy} style={{ fontSize: 13, fontWeight: 700, color: '#2A56D4', background: 'none', border: '1px solid #D9DEEA', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}>{reqBusy ? '요청 중…' : '🔑 입장 요청하기 (승인제)'}</button>
            </>
          )}
        </div>
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button type="button" onClick={logout} style={{ fontSize: 12.5, color: '#8A93A3', background: 'none', border: 'none', cursor: 'pointer' }}>다른 계정으로 로그인</button>
        </div>
      </form>
    </div>
  )
}
