import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { Mail, Lock, Eye, EyeOff, BarChart2, Users, TrendingUp } from 'lucide-react'

export default function AgencyLoginPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/agency/login', formData)
      if (res.data.success) {
        const { token, agency } = res.data
        localStorage.setItem('agency_token', token)
        localStorage.setItem('agency_id', String(agency.id))
        localStorage.setItem('agency_name', agency.name)
        localStorage.setItem('agency_email', agency.email)
        navigate('/agency', { replace: true })
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      setError(err_.response?.data?.error || '이메일 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex">
      {/* Left branding panel (desktop) */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-[#0A0A0B]">
        <div className="px-10 pt-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-extrabold text-white tracking-tight">UR·DEAL</span>
            <span className="text-xs font-bold tracking-widest text-[#8B5CF6] uppercase">Agency Partner</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10">
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            소속 셀러를 한눈에<br />관리하세요
          </h1>
          <p className="text-gray-400 text-base mb-10">
            에이전시 전용 대시보드에서 소속 셀러의 매출, 주문, 라이브를 통합 관리합니다.
          </p>

          <div className="space-y-5">
            {[
              { icon: Users, title: '셀러 통합 관리', desc: '소속 셀러 현황을 한 화면에서 확인' },
              { icon: BarChart2, title: '매출 집계 분석', desc: '전체/개별 셀러 매출 통계 실시간 확인' },
              { icon: TrendingUp, title: '라이브 모니터링', desc: '진행 중인 라이브 방송 현황 실시간 파악' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-10 pb-8">
          <p className="text-xs text-gray-600">&copy; 2026 유어딜. 에이전시 파트너 전용 서비스</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <span className="text-2xl font-extrabold text-gray-900 tracking-tight">UR·DEAL</span>
            <span className="text-xs font-bold tracking-widest text-[#8B5CF6] uppercase">Agency</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">에이전시 로그인</h2>
            <p className="text-gray-500 text-sm mb-8">에이전시 계정으로 로그인하세요</p>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="agency@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    placeholder="비밀번호 입력"
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link
                  to="/agency/forgot-password"
                  className="text-sm text-[#8B5CF6] hover:text-[#7C3AED] font-medium"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            계정이 없으신가요?{' '}
            <Link to="/agency/register" className="text-[#8B5CF6] hover:underline font-medium">
              에이전시 등록
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
