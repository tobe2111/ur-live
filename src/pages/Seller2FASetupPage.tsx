/**
 * 🛡️ 2026-05-15: 셀러 2FA TOTP 설정 페이지.
 *
 * Flow:
 *   1. setup 호출 → secret + otpauth:// URL
 *   2. QR 코드 표시 (qrcode.react)
 *   3. 6자리 코드 입력 → verify → 활성화
 *   4. 활성화 후 disable 버튼 표시 (코드 입력 후 비활성화)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ShieldCheck, ShieldAlert, KeyRound, Copy, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'

export default function Seller2FASetupPage() {
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  const [enabled, setEnabled] = useState(false)
  const [setupData, setSetupData] = useState<{ secret: string; otpauth_url: string } | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    api.get('/api/2fa/status', { headers })
      .then(r => { if (r.data?.success) setEnabled(!!r.data.data?.enabled) })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false))
  }, [])

  async function startSetup() {
    setSubmitting(true)
    try {
      const res = await api.post('/api/2fa/setup', {}, { headers })
      if (res.data?.success) setSetupData(res.data.data)
      else toast.error(res.data?.error || 'setup 실패')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || 'setup 실패')
    } finally { setSubmitting(false) }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) { toast.error('6자리 숫자 코드'); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/2fa/verify', { code }, { headers })
      if (res.data?.success) {
        toast.success('🎉 2FA 활성화 완료!')
        setEnabled(true)
        setSetupData(null)
        setCode('')
      } else toast.error(res.data?.error || '코드 불일치')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '검증 실패')
    } finally { setSubmitting(false) }
  }

  async function disable2fa() {
    if (!/^\d{6}$/.test(code)) { toast.error('6자리 숫자 코드 입력'); return }
    if (!confirm('정말 2FA 를 비활성화하시겠습니까? 보안이 약해집니다.')) return
    setSubmitting(true)
    try {
      const res = await api.post('/api/2fa/disable', { code }, { headers })
      if (res.data?.success) {
        toast.success('2FA 비활성화 완료')
        setEnabled(false)
        setCode('')
      } else toast.error(res.data?.error || '비활성화 실패')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '비활성화 실패')
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return <SellerLayout title="2단계 인증"><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div></SellerLayout>
  }

  return (
    <SellerLayout title="2단계 인증 (2FA)">
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="2단계 인증"
          subtitle="비밀번호 외 OTP 코드로 로그인 보호"
          icon={<Shield className="h-5 w-5" />}
        />

        {/* 현재 상태 */}
        <div className={`rounded-2xl p-5 border-2 flex items-center gap-4 ${enabled ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          {enabled ? (
            <ShieldCheck className="w-10 h-10 text-green-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-10 h-10 text-amber-600 shrink-0" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-bold ${enabled ? 'text-green-700' : 'text-amber-700'}`}>
              {enabled ? '✅ 2FA 활성화됨' : '⚠️ 2FA 비활성화 상태'}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {enabled
                ? '로그인 시 OTP 코드가 필요합니다 (Google Authenticator, 1Password 등)'
                : '비밀번호만으로 로그인 가능 — 보안 강화 권장'}
            </p>
          </div>
        </div>

        {/* setup flow (비활성화 상태) */}
        {!enabled && !setupData && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
            <KeyRound className="w-12 h-12 text-pink-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900 mb-2">2FA 설정 시작</h3>
            <p className="text-sm text-gray-600 mb-4">
              Google Authenticator, 1Password, Authy 등<br />
              인증 앱이 필요합니다.
            </p>
            <button
              onClick={startSetup}
              disabled={submitting}
              className="px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              설정 시작
            </button>
          </div>
        )}

        {/* QR 코드 + 검증 (setup 진행 중) */}
        {!enabled && setupData && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 space-y-5">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-2">1. QR 코드 스캔</h3>
              <p className="text-xs text-gray-500 mb-4">인증 앱에서 QR 코드를 스캔하세요.</p>
              <div className="flex justify-center bg-white p-4 rounded-xl border border-gray-100">
                <QRCodeSVG value={setupData.otpauth_url} size={200} />
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">또는 코드 직접 입력 (수동):</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                <code className="flex-1 text-sm font-mono text-gray-900 break-all">{setupData.secret}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(setupData.secret); toast.success('복사됨') }}
                  className="p-2 hover:bg-gray-200 rounded-lg shrink-0"
                  aria-label="시크릿 복사"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-gray-900 mb-2">2. 인증 앱에서 6자리 코드 입력</h3>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-2xl font-mono text-center text-gray-900 focus:border-pink-500 focus:outline-none tracking-widest"
                autoComplete="one-time-code"
              />
              <button
                onClick={verifyCode}
                disabled={submitting || code.length !== 6}
                className="w-full mt-3 px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                활성화
              </button>
            </div>
          </div>
        )}

        {/* 활성화 상태 — 비활성화 옵션 */}
        {enabled && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 space-y-3">
            <h3 className="text-base font-bold text-gray-900">2FA 비활성화</h3>
            <p className="text-xs text-gray-500">
              현재 활성화된 인증 앱의 6자리 코드를 입력하세요.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-xl font-mono text-center text-gray-900 focus:border-red-500 focus:outline-none tracking-widest"
              autoComplete="one-time-code"
            />
            <button
              onClick={disable2fa}
              disabled={submitting || code.length !== 6}
              className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold"
            >
              {submitting ? '처리 중…' : '비활성화'}
            </button>
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
