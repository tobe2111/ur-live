import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Save, Loader2, Settings } from 'lucide-react'

export default function AgencyProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', bank_name: '', bank_account: '', account_holder: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token || ''}` }

  useEffect(() => {
    if (!token) {
      navigate('/agency/login', { replace: true })
    }
  }, [token, navigate])

  useEffect(() => {
    api.get('/api/agency/profile', { headers })
      .then(r => {
        if (r.data.success) {
          setProfile(r.data.data)
          setForm({
            name: r.data.data.name || '',
            contact_name: r.data.data.contact_name || '',
            phone: r.data.data.phone || '',
            bank_name: r.data.data.bank_name || '',
            bank_account: r.data.data.bank_account || '',
            account_holder: r.data.data.account_holder || '',
          })
        }
      })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await api.put('/api/agency/profile', form, { headers })
      toast.success('프로필이 수정되었습니다')
    } catch { toast.error('수정 실패') }
    finally { setSaving(false) }
  }

  if (loading) return <AgencyLayout title={t('agency.profile')}><div className="mx-auto max-w-xl p-6"><DashboardLoading /></div></AgencyLayout>

  return (
    <AgencyLayout title={t('agency.profile')}>
      <div className="mx-auto max-w-xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('agency.profile')}
          subtitle={t('agency.profileSubtitle')}
          icon={<Settings className="h-5 w-5" />}
        />

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">에이전시명</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">담당자명</label>
            <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input value={profile?.email || ''} disabled className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">수수료율</label>
            <p className="text-sm text-gray-900 font-bold">{profile?.commission_rate || 2}%</p>
            <p className="text-xs text-gray-400">수수료율은 관리자만 변경할 수 있습니다</p>
          </div>
        </div>

        {/* 🛡️ 2026-04-22 배치 162: 정산 계좌 정보 섹션 (이전엔 UI 없어서 정산 불가 P0 fix) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">정산 계좌 정보</h3>
          <p className="text-xs text-gray-500">정산금 입금 받을 계좌입니다. 에이전시 명의 계좌만 사용 가능합니다.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">은행명</label>
            <select
              value={form.bank_name}
              onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
            >
              <option value="">은행을 선택해주세요</option>
              {['KB국민은행','신한은행','우리은행','하나은행','NH농협은행','IBK기업은행','SC제일은행','한국씨티은행','케이뱅크','카카오뱅크','토스뱅크','새마을금고','신협','우체국','부산은행','경남은행','대구은행','광주은행','전북은행','제주은행','수협은행','산업은행'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
            <input value={form.bank_account}
              onChange={e => setForm(f => ({ ...f, bank_account: e.target.value.replace(/[^\d-]/g, '') }))}
              placeholder="000-000-0000000"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">예금주</label>
            <input value={form.account_holder}
              onChange={e => setForm(f => ({ ...f, account_holder: e.target.value }))}
              placeholder="홍길동"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </AgencyLayout>
  )
}
