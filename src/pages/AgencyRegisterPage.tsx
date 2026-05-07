import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { Mail, Lock, Eye, EyeOff, User, Phone, Building2, CheckCircle } from 'lucide-react'

export default function AgencyRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', contact_name: '', email: '', password: '', password_confirm: '', phone: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [done, setDone] = useState(false)

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (form.password !== form.password_confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/agency/register', {
        name: form.name,
        contact_name: form.contact_name,
        email: form.email,
        password: form.password,
        phone: form.phone,
      })
      setDone(true)
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      setError(err_.response?.data?.error || '가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('agency.agencyRegister.doneTitle', { defaultValue: '가입 신청 완료' })}</h2>
          <p className="text-gray-500 text-sm mb-1">
            {t('agency.agencyRegister.doneDesc1', { defaultValue: '에이전시 가입 신청이 접수되었습니다.' })}
          </p>
          <p className="text-gray-500 text-sm mb-8">
            {t('agency.agencyRegister.doneDesc2', { defaultValue: '관리자 검토 후 승인 시 이메일로 안내드립니다.' })}
          </p>
          <Link
            to="/agency/login"
            className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {t('agency.agencyRegister.goToLogin', { defaultValue: '로그인 페이지로' })}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex">
      {/* Left branding */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-white border-r border-gray-200">
        <div className="px-10 pt-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-white text-lg font-bold">A</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Ur Agency</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-10">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-3">
            {t('agency.agencyRegister.brandingTitle', { defaultValue: '에이전시 파트너로 함께 성장하세요' })}
          </h1>
          <p className="text-gray-500 text-base mb-8">
            {t('agency.agencyRegister.brandingDesc', { defaultValue: '유어딜 에이전시로 등록하면 소속 셀러들의 라이브 커머스를 통합 관리하고 수익을 함께 나눌 수 있습니다.' })}
          </p>
          <div className="space-y-4">
            {[
              t('agency.agencyRegister.feature1', { defaultValue: '소속 셀러 매출·주문·라이브 통합 대시보드' }),
              t('agency.agencyRegister.feature2', { defaultValue: '에이전시 전담 고객지원' }),
              t('agency.agencyRegister.feature3', { defaultValue: '셀러 퍼포먼스 리포트 제공' }),
            ].map(text => (
              <div key={text} className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="px-10 pb-8">
          <p className="text-xs text-gray-400">{t('agency.agencyRegister.copyright', { defaultValue: '© 2026 유어딜. 에이전시 파트너 전용 서비스' })}</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-white text-lg font-bold">A</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Ur Agency</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('agency.agencyRegister.formTitle', { defaultValue: '에이전시 가입 신청' })}</h2>
            <p className="text-gray-500 text-sm mb-7">{t('agency.agencyRegister.formDesc', { defaultValue: '가입 신청 후 관리자 승인 시 이용 가능합니다' })}</p>

            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 에이전시명 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('agency.agencyRegister.labelAgencyName', { defaultValue: '에이전시명' })} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text" required value={form.name} onChange={update('name')}
                    placeholder="(주)베스트에이전시"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 담당자명 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('agency.agencyRegister.labelContactName', { defaultValue: '담당자명' })} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text" required value={form.contact_name} onChange={update('contact_name')}
                    placeholder="홍길동"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('agency.agencyRegister.labelEmail', { defaultValue: '이메일' })} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email" required value={form.email} onChange={update('email')}
                    placeholder="agency@example.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 전화번호 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('agency.agencyRegister.labelPhone', { defaultValue: '전화번호' })}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel" value={form.phone} onChange={update('phone')}
                    placeholder="010-1234-5678"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('agency.agencyRegister.labelPassword', { defaultValue: '비밀번호' })} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPw ? 'text' : 'password'} required value={form.password} onChange={update('password')}
                    placeholder="8자 이상"
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('agency.agencyRegister.labelPasswordConfirm', { defaultValue: '비밀번호 확인' })} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPw ? 'text' : 'password'} required value={form.password_confirm} onChange={update('password_confirm')}
                    placeholder="비밀번호 재입력"
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      form.password_confirm && form.password !== form.password_confirm
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                  />
                </div>
                {form.password_confirm && form.password !== form.password_confirm && (
                  <p className="text-xs text-red-500 mt-1">{t('agency.agencyRegister.passwordMismatch', { defaultValue: '비밀번호가 일치하지 않습니다.' })}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors mt-2"
              >
                {loading ? t('agency.agencyRegister.submitting', { defaultValue: '신청 중...' }) : t('agency.agencyRegister.submitBtn', { defaultValue: '가입 신청하기' })}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-500 mt-5">
            이미 계정이 있으신가요?{' '}
            <Link to="/agency/login" className="text-blue-600 hover:underline font-medium">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
