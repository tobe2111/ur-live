import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  // 🛡️ 2026-05-25 (migration 0278/0280): 큐레이터 / 호스팅 / 출금 정책 동적화
  { key: 'curator_affiliate_pct', label: '큐레이터 어필리에이트 (%)', default: '1' },
  { key: 'host_incentive_pct', label: '호스팅 인센티브 (%)', default: '1' },
  { key: 'curator_min_withdrawal', label: '큐레이터 최소 출금 (원)', default: '10000' },
  { key: 'curator_withholding_rate', label: '큐레이터 원천징수율 (%)', default: '3.3' },
  { key: 'seller_upgrade_threshold', label: '셀러 승급 안내 누적 정산 (원)', default: '500000' },
  { key: 'pin_max_per_user', label: '유저당 핀 상한 (개)', default: '200' },
  { key: 'hosting_max_active', label: '호스팅 동시 active 상한 (개)', default: '10' },
  { key: 'jeju_extra_fee', label: '제주 추가 배송비 (원)', default: '3000' },
  { key: 'island_extra_fee', label: '도서산간 추가 배송비 (원)', default: '5000' },
]

export default function AdminPlatformSettingsPage() {
  const { t } = useTranslation()
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
      toast.success(t('admin.platformSettings.saveSuccess', { defaultValue: '설정이 저장되었습니다' }))
    } catch { toast.error(t('admin.platformSettings.saveFailed', { defaultValue: '저장 실패' })) }
    finally { setSaving(false) }
  }

  return (
    <AdminLayout title={t('admin.pages.platformSettings')}>
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.pages.platformSettings')}
          subtitle={t('admin.platformSettings.subtitle', { defaultValue: '수수료율, 정책, 기본값 등 플랫폼 파라미터' })}
          icon={<Settings className="h-5 w-5" />}
          actions={
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t('admin.platformSettings.save', { defaultValue: '저장' })}
            </button>
          }
        />

        {/* 🛡️ 2026-05-25: KT Alpha 운영 seller 자동 생성 + admin_seller_id 자동 set */}
        <KtAlphaSystemSellerSection />

        {loading ? <DashboardLoading /> : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {SETTINGS_FIELDS.map(f => (
              <div key={f.key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{f.label}</p>
                  <p className="text-xs text-gray-400">{t('admin.platformSettings.defaultLabel', { defaultValue: '기본값' })}: {f.default}</p>
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

// 🛡️ 2026-05-25: KT Alpha 운영 seller 자동 생성 + admin_seller_id 자동 set.
function KtAlphaSystemSellerSection() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function init() {
    if (!confirm("'유어딜 공식 운영' system seller 자동 생성 + kt_alpha_admin_seller_id 자동 set. 진행하시겠습니까?")) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.post("/api/admin/kt-alpha/init-system-seller", {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      })
      if (r.data?.success) {
        setResult(r.data.message || "완료")
        toast.success(r.data.message || "system seller 설정 완료")
      } else {
        setError(r.data?.error || "실패")
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "실패")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <h3 className="text-sm font-bold text-amber-900 mb-1">🤖 KT Alpha 운영 seller 자동 설정</h3>
      <p className="text-xs text-amber-800 mb-3">
        KT Alpha 자동발송 voucher_orders 가 누구 명의로 기록될지 결정. 기존 fallback (첫 approved seller) → '유어딜 공식 운영' 명의로 분리.<br/>
        클릭 1번 → sellers 신규 row 생성 (idempotent) + platform_settings.kt_alpha_admin_seller_id 자동 set.
      </p>
      <button
        onClick={init}
        disabled={loading}
        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
      >
        {loading ? "처리 중..." : "🤖 자동 설정"}
      </button>
      {result && <p className="mt-2 text-xs text-emerald-700 font-bold">✅ {result}</p>}
      {error && <p className="mt-2 text-xs text-red-600 font-bold">❌ {error}</p>}
    </div>
  )
}
