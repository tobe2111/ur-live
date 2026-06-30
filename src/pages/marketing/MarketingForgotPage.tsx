/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 비밀번호 재설정 요청 (/ads/forgot). 라이트.
 *   이메일 입력 → 재설정 링크 발송(가입된 경우). 열거 방지 위해 항상 동일 안내.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import UrAdsLogo from '@/components/brand/UrAdsLogo'
import { useUrAdsFavicon } from '@/components/brand/useUrAdsFavicon'

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

export default function MarketingForgotPage() {
  useUrAdsFavicon()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    try {
      await api.post('/api/ads/auth/forgot', { email: email.trim() })
      setSent(true)
    } catch { setSent(true) /* 열거 방지 — 실패도 동일 안내 */ } finally { setBusy(false) }
  }

  return (
    <div className="ua-auth force-light-theme">
      <SEO title="비밀번호 재설정 - UR Ads" description="유어애즈 비밀번호 재설정" url="/ads/forgot" noindex />
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <form className="ua-auth-card" onSubmit={submit}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link to="/ads" aria-label="유어애즈" style={{ color: '#0B0E14' }}><UrAdsLogo size={30} /></Link>
        </div>
        <p className="ua-auth-mono" style={{ textAlign: 'center', marginTop: 22 }}>UR ADS · RESET</p>
        <h1 style={{ textAlign: 'center', marginTop: 8, fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: '#0B0E14' }}>비밀번호 재설정</h1>

        {sent ? (
          <>
            <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, lineHeight: 1.7, color: '#565E6C' }}>
              가입된 이메일이면 <b>재설정 링크</b>를 보냈습니다.<br />메일함(스팸함 포함)을 확인해주세요. 링크는 1시간 동안 유효합니다.
            </p>
            <Link to="/ads/login" className="ua-auth-btn" style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로그인으로</Link>
          </>
        ) : (
          <>
            <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13, lineHeight: 1.6, color: '#565E6C' }}>가입한 이메일을 입력하면 재설정 링크를 보내드립니다.</p>
            <input className="ua-auth-input" style={{ marginTop: 18 }} type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="ua-auth-btn" style={{ marginTop: 14 }} disabled={busy}>{busy ? '전송 중…' : '재설정 링크 받기'}</button>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link to="/ads/login" style={{ fontSize: 13, color: '#2A56D4', fontWeight: 700 }}>로그인으로 돌아가기</Link>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
