import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Save, Loader2, Settings } from 'lucide-react'

export default function AgencyProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '' })
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
          setForm({ name: r.data.data.name || '', contact_name: r.data.data.contact_name || '', phone: r.data.data.phone || '' })
        }
      })
      .catch(() => {})
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

  if (loading) return <AgencyLayout title="프로필"><div className="mx-auto max-w-xl p-6"><DashboardLoading /></div></AgencyLayout>

  return (
    <AgencyLayout title="프로필 설정">
      <div className="mx-auto max-w-xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title="에이전시 프로필"
          subtitle="에이전시 기본 정보 관리"
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

          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </AgencyLayout>
  )
}
