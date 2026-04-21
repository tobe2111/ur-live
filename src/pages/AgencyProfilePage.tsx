import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AgencyLayout from '@/components/AgencyLayout'
import { Save, Loader2 } from 'lucide-react'

export default function AgencyProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token') || ''}` }

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

  if (loading) return <AgencyLayout title="프로필"><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div></AgencyLayout>

  return (
    <AgencyLayout title="프로필 설정">
      <div className="max-w-xl mx-auto p-6 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">에이전시 프로필</h1>

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
            <input value={profile?.email || ''} disabled className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 text-gray-500 bg-gray-50" />
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
