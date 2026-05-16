/**
 * 🛡️ 2026-05-16: 어드민 정산 마진 조정 페이지.
 *
 * platform_settings 의 6 개 키 직접 조정:
 *   - platform_margin_pct, influencer_commission_pct, user_referral_bonus_pct,
 *     agency_commission_pct, refund_window_days, influencer_payout_min
 *
 * 변경 즉시 반영 (getCommissionRates() 다음 호출 부터). Cache 없음.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Save, DollarSign } from 'lucide-react'

interface Settings {
  platform_margin_pct: string
  influencer_commission_pct: string
  user_referral_bonus_pct: string
  agency_commission_pct: string
  refund_window_days: string
  influencer_payout_min: string
  influencer_payout_frequency: string
  influencer_payout_day_of_month: string
  influencer_deal_bonus_pct: string
  seller_referral_bonus_pct: string
  seller_referral_bonus_months: string
  max_influencer_commission_pct: string
}

const DEFAULTS: Settings = {
  platform_margin_pct: '5',
  influencer_commission_pct: '0.5',
  user_referral_bonus_pct: '0.5',
  agency_commission_pct: '2',
  refund_window_days: '7',
  influencer_payout_min: '100000',
  influencer_payout_frequency: 'monthly',
  influencer_payout_day_of_month: '1',
  influencer_deal_bonus_pct: '20',
  seller_referral_bonus_pct: '1',
  seller_referral_bonus_months: '6',
  max_influencer_commission_pct: '2',
}

export default function AdminCommissionSettingsPage() {
  const { t } = useTranslation()
  const [form, setForm] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/admin-tools/settings')
      .then((r) => {
        if (r.data?.success && Array.isArray(r.data.data)) {
          const map = new Map<string, string>(r.data.data.map((s: { key: string; value: string }) => [s.key, s.value]))
          setForm((prev) => {
            const next = { ...prev }
            for (const key of Object.keys(DEFAULTS) as Array<keyof Settings>) {
              if (map.has(key)) next[key] = String(map.get(key))
            }
            return next
          })
        }
      })
      .catch(() => { /* fallback DEFAULTS */ })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    // 검증: 총 합계 (margin + influencer + user_bonus + agency) 가 50% 넘으면 차단
    const m = Number(form.platform_margin_pct)
    const i = Number(form.influencer_commission_pct)
    const u = Number(form.user_referral_bonus_pct)
    const a = Number(form.agency_commission_pct)
    const total = m + i + u + a
    if (!Number.isFinite(total) || total > 50) {
      toast.error('총 수수료가 50% 를 초과할 수 없습니다 (현재: ' + total.toFixed(1) + '%)')
      return
    }
    setSaving(true)
    try {
      await api.put('/api/admin-tools/settings', form)
      toast.success('수수료 설정이 저장되었습니다')
    } catch {
      toast.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLayout title="정산 마진 설정"><div className="p-6"><DashboardLoading /></div></AdminLayout>

  const totalCommission = (
    Number(form.platform_margin_pct) +
    Number(form.influencer_commission_pct) +
    Number(form.user_referral_bonus_pct) +
    Number(form.agency_commission_pct)
  )
  const sellerReceives = 100 - totalCommission

  return (
    <AdminLayout title="정산 마진 설정">
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="정산 마진 설정"
          subtitle="공구 매출의 4 계정 분배 비율 조정 (변경 즉시 반영)"
          icon={<DollarSign className="h-5 w-5" />}
        />

        {/* 합계 시각화 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="text-sm font-bold text-gray-900">매출 100% 분배</p>
          <div className="flex w-full h-8 rounded overflow-hidden">
            <div className="bg-purple-500" style={{ width: `${form.platform_margin_pct}%` }} title={`유어딜 ${form.platform_margin_pct}%`} />
            <div className="bg-pink-500" style={{ width: `${form.influencer_commission_pct}%` }} title={`인플 ${form.influencer_commission_pct}%`} />
            <div className="bg-yellow-500" style={{ width: `${form.user_referral_bonus_pct}%` }} title={`유저 ${form.user_referral_bonus_pct}%`} />
            <div className="bg-blue-500" style={{ width: `${form.agency_commission_pct}%` }} title={`에이전시 ${form.agency_commission_pct}%`} />
            <div className="bg-emerald-500" style={{ width: `${sellerReceives}%` }} title={`셀러 ${sellerReceives}%`} />
          </div>
          <div className="grid grid-cols-5 gap-2 text-[10px] text-center">
            <span className="text-purple-700">유어딜 {form.platform_margin_pct}%</span>
            <span className="text-pink-700">인플 {form.influencer_commission_pct}%</span>
            <span className="text-yellow-700">유저 {form.user_referral_bonus_pct}%</span>
            <span className="text-blue-700">에이전시 {form.agency_commission_pct}%</span>
            <span className="text-emerald-700">셀러 {sellerReceives.toFixed(1)}%</span>
          </div>
          {totalCommission > 50 && (
            <p className="text-xs text-red-600 font-bold">⚠️ 총 수수료가 50% 초과 — 셀러 매출이 비정상적으로 낮습니다</p>
          )}
        </div>

        {/* 각 비율 input */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          {([
            { key: 'platform_margin_pct', label: '유어딜 운영 마진 (%)', help: '플랫폼 기본 수수료' },
            { key: 'influencer_commission_pct', label: '인플루언서 commission (%)', help: '?ref= 진입 시 인플루언서에게 지급 (차단된 경우 0)' },
            { key: 'user_referral_bonus_pct', label: '사용자 referral 보너스 (%)', help: '?ref= 진입 시 사용자에게 즉시 적립 (차단된 경우도 지급 — 유어딜이 떠안음)' },
            { key: 'agency_commission_pct', label: '에이전시 commission (%)', help: '셀러가 에이전시 소속일 때 추가 차감' },
          ] as Array<{ key: keyof Settings; label: string; help: string }>).map(({ key, label, help }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
              <p className="text-[11px] text-gray-500 mt-1">{help}</p>
            </div>
          ))}

          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-1">환불 가능 기간 (일)</label>
            <input
              type="number"
              min="0"
              max="30"
              value={form.refund_window_days}
              onChange={(e) => setForm((f) => ({ ...f, refund_window_days: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
            <p className="text-[11px] text-gray-500 mt-1">voucher 사용 후 매장 송금까지 대기 일수 (분쟁 시 회수 가능 기간)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">인플루언서 월 최소 송금액 (원)</label>
            <input
              type="number"
              min="0"
              step="10000"
              value={form.influencer_payout_min}
              onChange={(e) => setForm((f) => ({ ...f, influencer_payout_min: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
            <p className="text-[11px] text-gray-500 mt-1">이 금액 이상인 인플루언서만 송금 (미달 시 다음 정산 주기 누적)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">인플 송금 주기</label>
            <select
              value={form.influencer_payout_frequency}
              onChange={(e) => setForm((f) => ({ ...f, influencer_payout_frequency: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            >
              <option value="weekly">매주 (월요일)</option>
              <option value="biweekly">격주 (월요일)</option>
              <option value="monthly">매월</option>
            </select>
          </div>

          {form.influencer_payout_frequency === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">월간 송금 날짜 (1~28)</label>
              <input
                type="number"
                min="1"
                max="28"
                value={form.influencer_payout_day_of_month}
                onChange={(e) => setForm((f) => ({ ...f, influencer_payout_day_of_month: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
              <p className="text-[11px] text-gray-500 mt-1">매월 이 날짜에 송금 처리 (29~31일은 월별 차이로 1일 권장)</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">딜 선택 시 보너스 (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="5"
              value={form.influencer_deal_bonus_pct}
              onChange={(e) => setForm((f) => ({ ...f, influencer_deal_bonus_pct: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
            <p className="text-[11px] text-gray-500 mt-1">인플이 현금 대신 딜 포인트 선택 시 추가 보너스 (락인 효과 유도)</p>
          </div>

          <div className="pt-4 border-t border-gray-100 space-y-4">
            <h4 className="text-sm font-bold text-gray-900">매장 영입 보너스 (인플 → 신규 매장)</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">영입 보너스 추가 % (기본 commission + 이만큼)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.seller_referral_bonus_pct}
                onChange={(e) => setForm((f) => ({ ...f, seller_referral_bonus_pct: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
              <p className="text-[11px] text-gray-500 mt-1">인플이 새 매장 영입 시 그 매장 매출 commission 에 추가 가산</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">영입 보너스 기간 (개월)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={form.seller_referral_bonus_months}
                onChange={(e) => setForm((f) => ({ ...f, seller_referral_bonus_months: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
              <p className="text-[11px] text-gray-500 mt-1">매장 가입 후 이 기간 동안 영입 보너스 적용 (기본 6개월)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">인플 commission 최대 cap (%)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                value={form.max_influencer_commission_pct}
                onChange={(e) => setForm((f) => ({ ...f, max_influencer_commission_pct: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
              <p className="text-[11px] text-gray-500 mt-1">기본 + 영입 + 협업 deal 모두 합산 후 이 % 까지만 (셀러 보호)</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || totalCommission > 50}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
