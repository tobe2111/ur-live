import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import BrandLoader from '@/components/brand/BrandLoader'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { AgencyStaffPanel, type StaffRow } from './AgencyStaffPanel'
import { AgencyInfoPanel } from './AgencyInfoPanel'
import { AgencyStoresPanel } from './AgencyStoresPanel'
import {
  agencyRequest, clearAgencySession, readAgencyProfile, readAgencyToken,
  type AgencyInfo, type AgencyStaffInfo,
} from './agency-api'

/**
 * 🏢 에이전시 콘솔 첫 화면 — 맡은 매장(2단계) + 직원 + 에이전시 정보.
 */
export default function AgencyHomePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const token = readAgencyToken()
  const cached = readAgencyProfile()
  const [me, setMe] = useState<{ staff: AgencyStaffInfo; agency: AgencyInfo } | null>(cached)
  const [staff, setStaff] = useState<StaffRow[] | null>(null)
  const [canManage, setCanManage] = useState(cached?.staff.role === 'admin')
  const [loadError, setLoadError] = useState('')
  const [expired, setExpired] = useState(false)

  const load = useCallback(async () => {
    setLoadError('')
    const [m, s] = await Promise.all([
      agencyRequest<{ staff: AgencyStaffInfo; agency: AgencyInfo }>('/me'),
      agencyRequest<{ staff: StaffRow[]; canManage: boolean }>('/staff'),
    ])
    if (m.status === 401 || s.status === 401) { setExpired(true); return }
    if (!m.ok || !s.ok) { setLoadError(m.data.error || s.data.error || '불러오지 못했어요.'); return }
    setMe({ staff: m.data.staff, agency: m.data.agency })
    setStaff(s.data.staff)
    setCanManage(!!s.data.canManage)
  }, [])

  useEffect(() => { if (token) load() }, [token, load])
  const onExpired = useCallback(() => setExpired(true), [])

  useEffect(() => {
    if (params.get('welcome') === '1') {
      toast.success('에이전시가 만들어졌어요. 함께 일할 직원을 초대해 보세요.')
      params.delete('welcome')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  if (!token || expired) return <Navigate to="/agency/login?returnUrl=%2Fagency" replace />

  async function logout() {
    if (!(await confirmDialog('로그아웃할까요?'))) return
    clearAgencySession()
    navigate('/agency/login', { replace: true })
  }

  return (
    <div className="force-light-theme agency-light-theme min-h-[100dvh] bg-[#F8F7FC] text-gray-900">
      <SEO title="에이전시 콘솔 - 유어딜" description="유어딜 에이전시 콘솔" url="/agency" noindex />
      <header className="sticky top-0 z-10 bg-[#F8F7FC]/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[720px] items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <UrDealLogo size={20} forceLight />
            <span className="text-[13px] font-semibold text-gray-600">에이전시</span>
          </div>
          <button type="button" onClick={logout} className="h-9 rounded-full px-3 text-[13px] font-semibold text-gray-600 hover:bg-white">
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-4 pb-16">
        {!me ? (
          loadError ? <ErrorBox message={loadError} onRetry={load} /> : <BrandLoader forceLight />
        ) : (
          <>
            <section className="pt-4">
              <p className="text-[13px] text-gray-500">{me.staff.name || me.staff.email} · {me.staff.role === 'admin' ? '관리자' : '직원'}</p>
              <h1 className="mt-1 text-[24px] font-bold tracking-[-0.01em] text-gray-900">{me.agency.name}</h1>
            </section>

            <AgencyStoresPanel onExpired={onExpired} />

            {loadError && <div className="mt-6"><ErrorBox message={loadError} onRetry={load} /></div>}

            <AgencyStaffPanel staff={staff} canManage={canManage} onChanged={load} />
            {canManage && <AgencyInfoPanel agency={me.agency} onSaved={load} />}
          </>
        )}
      </main>
    </div>
  )
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow-lift">
      <p className="text-[15px] text-gray-700">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 h-10 rounded-xl bg-brand px-4 text-[15px] font-semibold text-white">다시 시도</button>
    </div>
  )
}
