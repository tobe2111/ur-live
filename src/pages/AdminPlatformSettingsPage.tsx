import { useState, useEffect } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { Settings, Save, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

const SETTINGS_FIELDS = [
  { key: 'seller_commission_rate', label: '셀러 기본 수수료율 (%)', default: '5' },
  { key: 'agency_commission_rate', label: '에이전시 추가 수수료율 (%)', default: '2' },
  { key: 'min_donation', label: '최소 후원 금액 (딜)', default: '500' },
  { key: 'free_shipping_threshold', label: '무료배송 기준 (원)', default: '50000' },
  { key: 'default_shipping_fee', label: '기본 배송비 (원)', default: '3000' },
  { key: 'auto_confirm_days', label: '자동 구매확정 (일)', default: '14' },
  { key: 'return_period_days', label: '반품 가능 기간 (일)', default: '7' },
  { key: 'settlement_hold_days', label: '정산 대기 기간 (일)', default: '7' },
  { key: 'review_reward_text', label: '텍스트 리뷰 포인트', default: '50' },
  { key: 'review_reward_image', label: '사진 리뷰 포인트', default: '100' },
  { key: 'review_reward_video', label: '영상 리뷰 포인트', default: '200' },
]

export default function AdminPlatformSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  useEffect(() => {
    api.get('/api/admin/tools/settings', h)
      .then(r => { if (r.data.success) setSettings(r.data.data || {}) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/admin/tools/settings', settings, h)
      toast.success('설정이 저장되었습니다')
    } catch { toast.error('저장 실패') }
    finally { setSaving(false) }
  }

  return (
    <AdminLayout title="플랫폼 설정">
      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">플랫폼 설정</h1>
          <button onClick={save} disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        </div>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {SETTINGS_FIELDS.map(f => (
              <div key={f.key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{f.label}</p>
                  <p className="text-xs text-gray-400">기본값: {f.default}</p>
                </div>
                <input
                  value={settings[f.key] ?? f.default}
                  onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right font-medium"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
