import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Settings, Save, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

// 🛡️ 2026-04-22: 실제 코드에서 읽는 키로 정정 (UI-코드 매핑 수정).
// 이전: seller_commission_rate 키가 UI 에만 있고 코드에선 안 읽혀서 어드민 수정이 반영되지 않는 버그.
const SETTINGS_FIELDS = [
  { key: 'commission_rate_default', label: '기본 수수료율 — 일반 상품 (%)', default: '10' },
  { key: 'commission_rate_live', label: '라이브 판매 수수료율 (%)', default: '5' },
  { key: 'commission_rate_meal_voucher', label: '식사권(공동구매) 수수료율 (%)', default: '5' },
  { key: 'agency_commission_rate', label: '에이전시 추가 수수료율 (%)', default: '2' },
  { key: 'min_donation', label: '최소 후원 금액 (딜)', default: '500' },
  { key: 'free_shipping_threshold', label: '무료배송 기준 (원)', default: '50000' },
  { key: 'default_shipping_fee', label: '기본 배송비 (원)', default: '3000' },
  { key: 'auto_confirm_days', label: '자동 구매확정 (일)', default: '14' },
  { key: 'return_period_days', label: '반품 가능 기간 (일)', default: '7' },
  { key: 'settlement_hold_days', label: '정산 대기 기간 (일)', default: '7' },
  { key: 'invite_reward_amount', label: '초대 보상 딜', default: '1000' },
  { key: 'review_reward_text', label: '텍스트 리뷰 보상 (딜)', default: '100' },
  { key: 'review_reward_image', label: '이미지 리뷰 보상 (딜)', default: '300' },
  { key: 'review_reward_video', label: '영상 리뷰 보상 (딜)', default: '500' },
  { key: 'affiliate_commission_rate', label: '제휴 마케팅 수수료율 (%)', default: '2' },
]

export default function AdminPlatformSettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])
  useEffect(() => {
    api.get('/api/admin/tools/settings', h)
      .then(r => { if (r.data.success) setSettings(r.data.data || {}) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }).finally(() => setLoading(false))
  }, [])

  function validateSetting(key: string, value: string): string | null {
    const n = Number(value)
    if (!Number.isFinite(n)) return `${key}: 숫자 값만 허용됩니다`
    if (n < 0) return `${key}: 0 이상이어야 합니다`
    // 수수료/할인율 (%) — 0~100 사이
    if (key.includes('rate') || key.includes('percent')) {
      if (n < 0 || n > 100) return `${key}: 0~100 사이 값만 허용됩니다`
    }
    // 금액/딜 — 상한 1억
    if (key.includes('amount') || key.includes('fee') || key.includes('threshold') || key.includes('donation') || key.includes('reward')) {
      if (n > 100_000_000) return `${key}: 1억 이하여야 합니다`
    }
    // 일(days) — 1~365
    if (key.endsWith('_days')) {
      if (n < 0 || n > 365) return `${key}: 0~365일 사이여야 합니다`
    }
    return null
  }

  const save = async () => {
    // Pre-save validation
    for (const f of SETTINGS_FIELDS) {
      const v = settings[f.key] ?? f.default
      const err = validateSetting(f.key, v)
      if (err) { toast.error(err); return }
    }
    setSaving(true)
    try {
      await api.put('/api/admin/tools/settings', settings, h)
      toast.success('설정이 저장되었습니다')
    } catch { toast.error('저장 실패') }
    finally { setSaving(false) }
  }

  return (
    <AdminLayout title="플랫폼 설정">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="플랫폼 설정"
          subtitle="수수료율, 정책, 기본값 등 플랫폼 파라미터"
          icon={<Settings className="h-5 w-5" />}
          actions={
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              저장
            </button>
          }
        />
        {loading ? <DashboardLoading /> : (
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
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 text-right font-medium"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
