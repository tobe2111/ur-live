/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 계정 설정 (/ads/account). 라이트 테마(대시보드·랜딩과 통일).
 *   독립 계정(ad_accounts)의 회사정보 수정 · 비밀번호 변경 · 로그아웃.
 *   ⚠️ standalone 라이트 페이지 → 루트 force-light-theme(전역 .dark input 규칙 무력화).
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'
import { toast } from '@/hooks/useToast'

const SCOPED_CSS = `
.ua-acc{min-height:100dvh;padding:32px 24px;
  background:radial-gradient(120% 80% at 50% -10%,#EEF2FB 0%,#F4F5F7 46%,#F4F5F7 100%);
  font-family:Pretendard,system-ui,-apple-system,sans-serif;color:#0B0E14;}
.ua-acc a{text-decoration:none;}
.ua-acc-wrap{max-width:440px;margin:0 auto;}
.ua-acc-card{background:#FFFFFF;border:1px solid #ECEDF1;border-radius:18px;padding:22px 20px;margin-top:14px;box-shadow:0 16px 44px -28px rgba(20,30,60,.25);}
.ua-acc-input{width:100%;height:44px;border-radius:11px;background:#FFFFFF;border:1px solid #D9DEEA;
  padding:0 13px;font-size:14px;color:#0B0E14 !important;outline:none;}
.ua-acc-input:focus{border-color:#3B6EF5;} .ua-acc-input::placeholder{color:#9AA3B5;}
.ua-acc-input:disabled{background:#F4F5F7;color:#565E6C !important;}
.ua-acc-btn{height:42px;border-radius:11px;background:#3B6EF5;color:#fff;font-size:13.5px;font-weight:800;padding:0 18px;}
.ua-acc-btn:disabled{opacity:.55;}
.ua-acc-btn-ghost{height:42px;border-radius:11px;background:#FFFFFF;border:1px solid #E2E6F2;color:#565E6C;font-size:13.5px;font-weight:700;padding:0 16px;}
.ua-acc-label{font-size:11px;color:#8A93A3;margin-bottom:6px;}
.ua-acc-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.16em;color:#8A93A3;}
`

export default function MarketingAccountPage() {
  useUrAdsFavicon()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('ads_token')) { navigate('/ads/login', { replace: true }); return }
    const auth = { Authorization: `Bearer ${localStorage.getItem('ads_token')}` }
    api.get('/api/ads/auth/me', { headers: auth })
      .then(r => {
        if (r.data?.success) {
          setEmail(r.data.account?.email || '')
          setCompany(r.data.account?.company_name || '')
          setPhone(r.data.account?.phone || '')
        }
      })
      .catch(() => { toast.error('계정 정보를 불러오지 못했습니다') })
      .finally(() => setLoaded(true))
  }, [navigate])

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('ads_token')}` })

  async function saveProfile() {
    if (!company.trim()) { toast.error('회사 이름을 입력해주세요'); return }
    setSavingProfile(true)
    try {
      const r = await api.patch('/api/ads/auth/account', { company_name: company.trim(), phone: phone.trim() }, { headers: auth() })
      if (r.data?.success) {
        localStorage.setItem('ads_company', r.data.account?.company_name || '')
        toast.success('저장되었습니다')
      } else toast.error(r.data?.error || '저장 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '저장 실패')
    } finally { setSavingProfile(false) }
  }

  async function changePassword() {
    if (!curPw || !newPw) { toast.error('현재·새 비밀번호를 입력해주세요'); return }
    setSavingPw(true)
    try {
      const r = await api.post('/api/ads/auth/password', { current_password: curPw, new_password: newPw }, { headers: auth() })
      if (r.data?.success) { toast.success('비밀번호가 변경되었습니다'); setCurPw(''); setNewPw('') }
      else toast.error(r.data?.error || '변경 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '변경 실패')
    } finally { setSavingPw(false) }
  }

  function logout() {
    for (const k of ['ads_token', 'ads_account_id', 'ads_company', 'ads_unlocked']) localStorage.removeItem(k)
    navigate('/ads/login', { replace: true })
  }

  return (
    <div className="ua-acc force-light-theme">
      <SEO title="유어애즈 계정 설정 - UR Ads" description="유어애즈 계정 정보·비밀번호 관리" url="/ads/account" noindex />
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <div className="ua-acc-wrap">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/ads/dashboard" aria-label="유어애즈" style={{ color: '#0B0E14' }}><UrAdsLogo size={24} /></Link>
          <Link to="/ads/dashboard" style={{ fontSize: 13, color: '#565E6C', fontWeight: 600 }}>← 대시보드</Link>
        </div>
        <p className="ua-acc-mono" style={{ marginTop: 18 }}>UR ADS · ACCOUNT</p>
        <h1 style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: '#0B0E14' }}>계정 설정</h1>

        {/* 프로필 */}
        <div className="ua-acc-card">
          <div className="ua-acc-label">이메일</div>
          <input className="ua-acc-input" value={email} disabled placeholder={loaded ? '' : '불러오는 중…'} />
          <div className="ua-acc-label" style={{ marginTop: 14 }}>회사(고객사) 이름</div>
          <input className="ua-acc-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="회사 이름" />
          <div className="ua-acc-label" style={{ marginTop: 14 }}>연락처</div>
          <input className="ua-acc-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="연락처 (선택)" />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button className="ua-acc-btn" onClick={saveProfile} disabled={savingProfile || !loaded}>{savingProfile ? '저장 중…' : '저장'}</button>
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="ua-acc-card">
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0B0E14', marginBottom: 12 }}>비밀번호 변경</div>
          <input className="ua-acc-input" type="password" autoComplete="current-password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="현재 비밀번호" />
          <input className="ua-acc-input" style={{ marginTop: 10 }} type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="새 비밀번호 (10자 이상·대소문자·숫자·특수문자)" />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button className="ua-acc-btn" onClick={changePassword} disabled={savingPw}>{savingPw ? '변경 중…' : '비밀번호 변경'}</button>
          </div>
        </div>

        {/* 로그아웃 */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button className="ua-acc-btn-ghost" onClick={logout}>로그아웃</button>
        </div>
      </div>
    </div>
  )
}
