import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Settings, Save, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'

// 🛡️ 2026-04-22: 실제 코드에서 읽는 키로 정정 (UI-코드 매핑 수정).
// 이전: seller_commission_rate 키가 UI 에만 있고 코드에선 안 읽혀서 어드민 수정이 반영되지 않는 버그.
const SETTINGS_FIELDS = [
  { key: 'commission_rate_default', label: '기본 수수료율 — 일반 상품 (%)', default: '10' },
  { key: 'commission_rate_live', label: '라이브 판매 수수료율 (%)', default: '5' },
  { key: 'commission_rate_meal_voucher', label: '이용권(공동구매) 수수료율 (%)', default: '5' },
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
  // 💸 2026-07-04 F1: 멀티티어 추천트리 요율 어드민 노출 — 코드 기본값(10/3)이 "추천은 CAC라 2%"
  //   결정(2026-06-17)과 어긋남. 예산 캡(INV-CB)이 초과지급은 막지만 기본율 자체도 여기서 조정.
  { key: 'tier1_commission_rate', label: '추천트리 1단계 요율 (%) — 권장 2', default: '10' },
  { key: 'tier2_commission_rate', label: '추천트리 2단계 요율 (%) — 권장 1', default: '3' },
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

// 💸 2026-07-04 [INV-CB] 커미션 예산 아비터 스위치 (docs/design/commission-funding-restructure.md).
//   전부 미설정=현행. 활성화는 staging 실결제 검증 후(설계 §5). select 형은 숫자 검증 제외.
const COMMISSION_BUDGET_FIELDS: Array<{ key: string; label: string; default: string; options?: Array<{ value: string; label: string }>; hint?: string }> = [
  {
    key: 'commission_budget_enabled', label: '커미션 예산 캡 활성화', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행)' }, { value: 'true', label: 'ON — 예산 캡 적용' }],
    hint: '3P 주문당 성장 커미션 총합 ≤ 수수료 − PG준비금 (비례 축소). ⚠️ staging 검증 후 ON',
  },
  {
    key: 'pg_reserve_pct', label: 'PG 준비금 (%)', default: '2.5',
    hint: '예산 = 플랫폼 수수료 − 결제액×이 비율',
  },
  {
    key: 'promo_funding_source', label: '핀 추천(어필리에이트) 재원', default: 'platform',
    options: [{ value: 'platform', label: '플랫폼 부담 (현행)' }, { value: 'owner', label: '주인(셀러) 부담 — promo 슬라이스' }],
    hint: "'owner' 시 추천인 딜 적립은 유지, 같은 금액을 매장/셀러 정산에서 차감",
  },
  {
    key: 'invite_reward_monthly_budget_krw', label: '초대 보상 월 예산 (딜, 0=무제한)', default: '0',
    hint: '이달 지급 합계가 예산 초과 시 자동 skip',
  },
  {
    key: 'agency_signup_bonus_monthly_budget_krw', label: '에이전시 signup 보너스 월 예산 (원, 0=무제한)', default: '0',
    hint: '₩30,000 정액 보너스의 월 상한',
  },
  // 🥇 2026-07-05 (운영 감사 Q10): 캡 발동 시 어느 축을 먼저 보전할지 — "에이전시 1% 보호 최우선" 자문.
  {
    key: 'commission_priority_axes', label: '캡 발동 시 우선 보전 축', default: 'agency_intro',
    options: [
      { value: 'agency_intro', label: '에이전시 매장영입 최우선 (권장)' },
      { value: '', label: '우선 없음 — 전 축 비례 축소' },
    ],
    hint: '계약 기반(24개월) 에이전시 커미션을 캡 축소에서 먼저 보전. 발동 이력은 아래 표',
  },
]

export default function AdminPlatformSettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery. 편집형이라 데이터 도착 시 시드.
  const settingsQ = useApiQuery<Record<string, string>>(['admin', 'platform-settings'], '/api/admin/tools/settings', { select: (r: any) => (r?.success ? r.data || {} : {}) })
  const loading = settingsQ.isLoading
  useEffect(() => { if (settingsQ.data) setSettings(settingsQ.data) }, [settingsQ.data])

  function validateSetting(key: string, value: string): string | null {
    const n = Number(value)
    if (!Number.isFinite(n)) return `${key}: 숫자 값만 허용됩니다`
    if (n < 0) return `${key}: 0 이상이어야 합니다`
    // 수수료/할인율 (%) — 0~100 사이 (pct 표기 포함 — pg_reserve_pct 등)
    if (key.includes('rate') || key.includes('percent') || key.includes('pct')) {
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
    // [INV-CB] 커미션 예산 필드 — select 는 옵션값 검증, 숫자형만 validateSetting
    for (const f of COMMISSION_BUDGET_FIELDS) {
      const v = settings[f.key] ?? f.default
      if (f.options) {
        if (!f.options.some(o => o.value === v)) { toast.error(`${f.key}: 허용되지 않는 값`); return }
      } else {
        const err = validateSetting(f.key, v)
        if (err) { toast.error(err); return }
      }
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
          <>
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

          {/* 💸 [INV-CB] 커미션 예산 아비터 — 2026-07-04 재원 구조 개편. 활성화는 staging 검증 후. */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-sm font-bold text-gray-900">💸 커미션 예산 아비터 (INV-CB)</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                플랫폼 부담 성장 커미션(핀 추천·멀티티어·영입자·에이전시)의 주문당 총액 캡.
                ⚠️ 활성화 전 staging 실결제 검증 필수 — 설계: commission-funding-restructure.md
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {COMMISSION_BUDGET_FIELDS.map(f => (
                <div key={f.key} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{f.label}</p>
                    {f.hint && <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>}
                  </div>
                  {f.options ? (
                    <select
                      value={settings[f.key] ?? f.default}
                      onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium bg-white"
                    >
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      value={settings[f.key] ?? f.default}
                      onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-28 shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 text-right font-medium"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 📊 Q10 캡 관측성 — 발동 이력 (order-commissions 가 Σ요청>예산 주문만 기록) */}
          <CommissionCapLogsSection />
          </>
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
    if (!(await confirmDialog("'유어딜 공식 운영' system seller 자동 생성 + kt_alpha_admin_seller_id 자동 set. 진행하시겠습니까?"))) return
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

// 📊 2026-07-05 (운영 감사 Q10): 커미션 예산 캡 발동 이력 — "캡이 언제 누굴 얼마 깎았나"를
//   어드민이 직접 확인. 발동 0건이면 안내문만(게이트 OFF/여유 예산 = 정상).
function CommissionCapLogsSection() {
  interface CapLog { id: number; order_id: number; budget_krw: number; requested_krw: number; granted_krw: number; detail: string | null; created_at: string }
  const logsQ = useApiQuery<CapLog[]>(
    ['admin', 'commission-budget-logs'],
    '/api/admin/tools/commission-budget-logs',
    { select: (r: any) => (r?.success ? r.data || [] : []) },
  )
  const logs = logsQ.data || []
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 pt-4 pb-2">
        <p className="text-sm font-bold text-gray-900">커미션 캡 발동 이력</p>
        <p className="text-xs text-gray-400 mt-0.5">Σ요청 커미션이 주문 예산(수수료−PG준비금)을 넘어 비례/우선 축소가 실행된 주문 — 최근 100건</p>
      </div>
      {logs.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-gray-400">발동 이력이 없습니다 (캡 OFF 또는 예산 내 정상)</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2 font-semibold">주문</th>
                <th className="px-2 py-2 font-semibold text-right">예산</th>
                <th className="px-2 py-2 font-semibold text-right">요청</th>
                <th className="px-2 py-2 font-semibold text-right">배분</th>
                <th className="px-5 py-2 font-semibold">축별 내역 · 시각</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => {
                let axes = ''
                try {
                  const d = JSON.parse(l.detail || '[]') as Array<{ key: string; requestedKrw: number; grantedKrw: number }>
                  axes = d.map(g => `${g.key} ${g.requestedKrw.toLocaleString()}→${g.grantedKrw.toLocaleString()}`).join(' · ')
                } catch { /* 표시용 */ }
                return (
                  <tr key={l.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-2 font-semibold text-gray-900">#{l.order_id}</td>
                    <td className="px-2 py-2 text-right text-gray-600">{Number(l.budget_krw).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-red-500 font-semibold">{Number(l.requested_krw).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-gray-900 font-semibold">{Number(l.granted_krw).toLocaleString()}</td>
                    <td className="px-5 py-2 text-[11px] text-gray-500">{axes}<span className="text-gray-300"> · {l.created_at}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
