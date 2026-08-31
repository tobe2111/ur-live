/**
 * 🔁 /seller/relink — 카카오 계정 교체 원스텝 재연결 (2026-07-20 대표 "가장 이상적으로").
 *   폰/카카오 계정이 바뀐 사장님이 스스로 복구: ① 새 카카오로 로그인 → ② 기존 셀러
 *   이메일+비밀번호 입력 → 셀러 권한이 새 카카오 계정으로 이전 + 토큰 즉시 발급 → /seller.
 *   비밀번호가 없는(카카오로만 만든) 계정은 카카오채널 문의 폴백 안내.
 *   standalone 라이트 페이지 — 루트 force-light-theme(다크 전역 input 규칙 무력화, 가드 준수).
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RefreshCw, MessageCircle, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import UrDealLogo from '@/components/brand/UrDealLogo'

const KAKAO_CHANNEL = 'http://pf.kakao.com/_AITdn/chat'

export default function SellerRelinkPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hasConsumer = typeof window !== 'undefined' && !!localStorage.getItem('user_id')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const r = await api.post('/api/seller/relink-kakao', { email, password }, { withCredentials: true })
      const d = r.data
      if (d?.success) {
        const s = d.data || {}
        if (s.seller_token) {
          localStorage.setItem('seller_token', s.seller_token)
          if (s.seller?.id != null) localStorage.setItem('seller_id', String(s.seller.id))
          if (s.seller?.username) localStorage.setItem('seller_username', s.seller.username)
          if (s.seller?.business_name) localStorage.setItem('seller_name', s.seller.business_name)
          if (s.seller?.is_distributor) localStorage.setItem('is_distributor', '1') // multi-role-redirect-ok: 재발급 키 저장만(RouteGuards SelfHeal 동일) — 게이트/redirect 아님
        }
        navigate('/seller', { replace: true })
      } else {
        setError(d?.error || t('seller.relink.fail', { defaultValue: '재연결에 실패했습니다' }))
      }
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string; code?: string } } }
      if (e2.response?.data?.code === 'KAKAO_LOGIN_REQUIRED') {
        setError(t('seller.relink.needKakao', { defaultValue: '새 카카오 계정으로 먼저 로그인해주세요.' }))
      } else {
        setError(e2.response?.data?.error || t('seller.relink.fail', { defaultValue: '재연결에 실패했습니다' }))
      }
    } finally { setBusy(false) }
  }

  const inputCls = 'w-full h-12 px-3.5 rounded-xl border border-gray-300 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'
  return (
    <div className="force-light-theme min-h-[100dvh] bg-[#FAF7F5] flex flex-col items-center px-5 py-10">
      <Link to="/seller/login" className="self-start mb-8"><UrDealLogo size={20} forceLight /></Link>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-7">
        <div className="flex items-center gap-2 mb-1.5">
          <RefreshCw className="w-5 h-5 text-brand" />
          <h1 className="text-[20px] font-extrabold text-[#16181C]">{t('seller.relink.title', { defaultValue: '카카오 계정이 바뀌셨나요?' })}</h1>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500 mb-6">
          {t('seller.relink.desc', { defaultValue: '폰이나 카카오 계정이 바뀌어도 셀러 계정은 그대로예요. 새 카카오로 로그인한 뒤, 기존 셀러 이메일과 비밀번호만 확인하면 바로 이어서 쓸 수 있어요.' })}
        </p>

        {/* STEP 1 — 새 카카오 로그인 */}
        <div className="flex items-center gap-2.5 mb-4">
          {hasConsumer
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            : <span className="w-5 h-5 rounded-full bg-brand text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">1</span>}
          <p className="text-[14px] font-bold text-[#16181C] flex-1">{t('seller.relink.step1', { defaultValue: '새 카카오 계정으로 로그인' })}</p>
          {!hasConsumer && (
            <button onClick={() => navigate('/login?returnUrl=' + encodeURIComponent('/seller/relink'))}
              className="px-3 py-2 rounded-lg bg-[#FEE500] text-[#191919] text-[12.5px] font-extrabold">
              {t('seller.relink.kakaoBtn', { defaultValue: '카카오 로그인' })}
            </button>
          )}
        </div>

        {/* STEP 2 — 기존 셀러 자격 확인 */}
        <form onSubmit={submit} className={hasConsumer ? '' : 'opacity-40 pointer-events-none'}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-5 h-5 rounded-full bg-brand text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">2</span>
            <p className="text-[14px] font-bold text-[#16181C]">{t('seller.relink.step2', { defaultValue: '기존 셀러 계정 확인' })}</p>
          </div>
          <div className="space-y-2.5">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
              placeholder={t('seller.relink.emailPh', { defaultValue: '기존 셀러 이메일' })} className={inputCls} />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
              placeholder={t('seller.relink.pwPh', { defaultValue: '비밀번호' })} className={inputCls} />
          </div>
          {error && <p className="mt-2.5 text-[12.5px] font-bold text-brand">{error}</p>}
          <button type="submit" disabled={busy}
            className="ur-btn ur-btn-lg ur-btn-primary mt-4 w-full text-[15px] disabled:opacity-50 active:scale-[0.98] transition-transform">
            {busy ? t('seller.relink.busy', { defaultValue: '재연결 중…' }) : t('seller.relink.submit', { defaultValue: '재연결하고 대시보드 열기' })}
          </button>
        </form>

        {/* 비번 없는 카카오-born 계정 폴백 */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-[12px] text-gray-500 leading-relaxed">
            {t('seller.relink.noPw', { defaultValue: '카카오로만 가입해서 비밀번호가 없나요? 본인 확인 후 저희가 직접 연결해 드릴게요.' })}
          </p>
          <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#16181C] underline underline-offset-2">
            <MessageCircle className="w-3.5 h-3.5" /> {t('seller.relink.channel', { defaultValue: '카카오채널로 문의하기' })}
          </a>
        </div>
      </div>
    </div>
  )
}
