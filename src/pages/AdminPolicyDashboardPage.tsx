/**
 * 🛡️ 2026-05-22: 정책 SSOT 대시보드 (read-only 시각화).
 *
 * 표시:
 *   - REFUND_POLICY / COMMISSION_DEFAULTS / TAX_POLICY / TIME_CONSTANTS
 *   - 동적 platform_settings DB 값 (현재 적용중 — fallback 상수와 비교)
 *
 * 변경 방법:
 *   ① 정적 정책 → `src/shared/constants/policy.ts` 수정 + PR
 *   ② 동적 정책 → `/admin/payouts` 에서 platform_settings 편집
 *
 * 이 페이지는 읽기 전용 — 어드민이 "지금 어떤 정책이 적용 중인지" 한눈에 확인용.
 */

import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import SEO from '@/components/SEO'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { swallow } from '@/shared/utils/swallow'
import {
  REFUND_POLICY,
  COMMISSION_DEFAULTS,
  TAX_POLICY,
  TIME_CONSTANTS,
  WITHHOLDING_RATES,
} from '@/shared/constants/policy'
import { ShieldCheck, ExternalLink } from 'lucide-react'

interface DynamicSetting {
  key: string
  value: string
}

function PolicyTable({ title, rows }: {
  title: string
  rows: Array<{ key: string; value: string | number; unit?: string; desc?: string; dynamic?: string }>
}) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <h2 className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-800">
        {title}
      </h2>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs">
          <tr>
            <th className="px-4 py-2 text-left font-medium w-1/3">키</th>
            <th className="px-4 py-2 text-right font-medium w-1/6">현재 값</th>
            <th className="px-4 py-2 text-left font-medium">설명</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.key} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-mono text-xs text-gray-700">{r.key}</td>
              <td className="px-4 py-2 text-right">
                <span className="font-bold text-gray-900">
                  {typeof r.value === 'number' ? r.value.toLocaleString() : r.value}
                </span>
                {r.unit && <span className="ml-1 text-xs text-gray-500">{r.unit}</span>}
                {r.dynamic && (
                  <div className="text-[10px] text-blue-600 mt-0.5">
                    동적 적용중: <strong>{r.dynamic}</strong>
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-xs text-gray-600">{r.desc || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function AdminPolicyDashboardPage() {
  const [dynamicSettings, setDynamicSettings] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api
      .get('/api/admin/payouts/commission-rates')
      .then((res) => {
        const data = res.data?.data || {}
        setDynamicSettings({
          platform_fee_pct: String(data.platform_fee_pct ?? ''),
          seller_commission_pct: String(data.seller_commission_pct ?? ''),
          agency_share_pct: String(data.agency_share_pct ?? ''),
          influencer_intro_share_pct: String(data.influencer_intro_share_pct ?? ''),
        })
      })
      .catch(swallow('admin-policy-dashboard:fetch'))
      .finally(() => setLoaded(true))
  }, [])

  const refundRows = [
    { key: 'APPOINTMENT_NOSHOW_ALERT_MIN', value: REFUND_POLICY.APPOINTMENT_NOSHOW_ALERT_MIN, unit: '분', desc: '예약 노쇼 자동 알림 — 시작 후 N분' },
    { key: 'APPOINTMENT_CANCEL_DEADLINE_HOURS', value: REFUND_POLICY.APPOINTMENT_CANCEL_DEADLINE_HOURS, unit: '시간', desc: '예약 취소 환불 마감 (시작 N시간 이내 = 환불 X)' },
    { key: 'VOUCHER_REFUND_AFTER_EXPIRY_DAYS', value: REFUND_POLICY.VOUCHER_REFUND_AFTER_EXPIRY_DAYS, unit: '일', desc: '만료 voucher 자동 환불 마감' },
    { key: 'VOUCHER_ARCHIVE_AFTER_EXPIRY_DAYS', value: REFUND_POLICY.VOUCHER_ARCHIVE_AFTER_EXPIRY_DAYS, unit: '일', desc: '미사용 voucher 만료 후 archive' },
    { key: 'DISPUTE_ESCALATION_HOURS', value: REFUND_POLICY.DISPUTE_ESCALATION_HOURS, unit: '시간', desc: '분쟁 미처리 → admin escalation' },
    { key: 'DISPUTE_REPEAT_STORE_THRESHOLD', value: REFUND_POLICY.DISPUTE_REPEAT_STORE_THRESHOLD, unit: '건', desc: '30일 분쟁 N건+ → 재발 매장 경고' },
    { key: 'DISPUTE_REPEAT_USER_THRESHOLD', value: REFUND_POLICY.DISPUTE_REPEAT_USER_THRESHOLD, unit: '건', desc: '30일 분쟁 N건+ → 어뷰징 의심' },
    { key: 'TOSS_REFUND_MAX_RETRY', value: REFUND_POLICY.TOSS_REFUND_MAX_RETRY, unit: '회', desc: '토스 환불 재시도 최대 (exponential backoff)' },
    { key: 'COMMISSION_MIN_WITHDRAWAL', value: REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL, unit: '원', desc: '최소 출금 금액' },
  ]

  const commissionRows = [
    { key: 'PLATFORM_FEE_PCT', value: COMMISSION_DEFAULTS.PLATFORM_FEE_PCT, unit: '%', desc: '플랫폼 fee (어드민 조정 가능)', dynamic: dynamicSettings.platform_fee_pct ? `${dynamicSettings.platform_fee_pct}%` : undefined },
    { key: 'SELLER_COMMISSION_PCT', value: COMMISSION_DEFAULTS.SELLER_COMMISSION_PCT, unit: '%', desc: '위탁 셀러 commission', dynamic: dynamicSettings.seller_commission_pct ? `${dynamicSettings.seller_commission_pct}%` : undefined },
    { key: 'AGENCY_SHARE_PCT', value: COMMISSION_DEFAULTS.AGENCY_SHARE_PCT, unit: '%', desc: '에이전시 입점 분배 (platform_fee 중)', dynamic: dynamicSettings.agency_share_pct ? `${dynamicSettings.agency_share_pct}%` : undefined },
    { key: 'INFLUENCER_INTRO_SHARE_PCT', value: COMMISSION_DEFAULTS.INFLUENCER_INTRO_SHARE_PCT, unit: '%', desc: '인플 입점 분배 (platform_fee 중)', dynamic: dynamicSettings.influencer_intro_share_pct ? `${dynamicSettings.influencer_intro_share_pct}%` : undefined },
    { key: 'AGENCY_OWN_RATE', value: COMMISSION_DEFAULTS.AGENCY_OWN_RATE, unit: '%', desc: '에이전시 본인 매출 commission' },
    { key: 'AFFILIATE_COMMISSION_PCT', value: COMMISSION_DEFAULTS.AFFILIATE_COMMISSION_PCT, unit: '%', desc: '제휴 마케팅 (쿠팡파트너스형) 추천인 보상' },
    { key: 'REFERRAL_BONUS_BOTHSIDES_PCT', value: COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT, unit: '%', desc: '공구 양쪽 보너스 (추천인 + 피추천인)' },
    { key: 'STAYS_COMMISSION_CAP_PCT', value: COMMISSION_DEFAULTS.STAYS_COMMISSION_CAP_PCT, unit: '%', desc: '숙박 카테고리 commission 상한' },
    { key: 'TIER_COMMISSION_BONUS', value: 'bronze 0 / silver 1 / gold 2 / platinum 3', unit: '%', desc: '셀러 등급별 보너스' },
  ]

  const taxRows = [
    { key: 'WITHHOLDING_RATES.business_income', value: (WITHHOLDING_RATES.business_income * 100).toFixed(1), unit: '%', desc: '사업소득 (반복 활동 — default 대부분 인플)' },
    { key: 'WITHHOLDING_RATES.other_income', value: (WITHHOLDING_RATES.other_income * 100).toFixed(1), unit: '%', desc: '기타소득 (단발성 협업)' },
    { key: 'OTHER_INCOME_THRESHOLD', value: TAX_POLICY.OTHER_INCOME_THRESHOLD, unit: '원/년', desc: '기타소득 연 누계 분리과세 한도' },
  ]

  const timeRows = [
    { key: 'ALERT_DEDUP_DEFAULT_SEC', value: TIME_CONSTANTS.ALERT_DEDUP_DEFAULT_SEC, unit: '초', desc: 'Discord/Slack alert 중복 dedup window' },
    { key: 'YOUTUBE_LIVE_POLL_SEC', value: TIME_CONSTANTS.YOUTUBE_LIVE_POLL_SEC, unit: '초', desc: 'YouTube 라이브 status 폴링' },
    { key: 'LIVE_IMMINENT_THRESHOLD_SEC', value: TIME_CONSTANTS.LIVE_IMMINENT_THRESHOLD_SEC, unit: '초', desc: '라이브 임박 알림 threshold' },
    { key: 'PWA_DISMISS_DAYS', value: TIME_CONSTANTS.PWA_DISMISS_DAYS, unit: '일', desc: 'PWA 설치 prompt dismiss 만료' },
    { key: 'REFERRAL_ATTRIBUTION_HOURS', value: TIME_CONSTANTS.REFERRAL_ATTRIBUTION_HOURS, unit: '시간', desc: '추천 attribution sessionStorage TTL' },
    { key: 'RATE_LIMIT_WINDOW_SEC', value: TIME_CONSTANTS.RATE_LIMIT_WINDOW_SEC, unit: '초', desc: 'rate_limit_attempts window' },
    { key: 'ERROR_SPIKE_THRESHOLD', value: TIME_CONSTANTS.ERROR_SPIKE_THRESHOLD, unit: '건/분', desc: '5xx 스파이크 detection threshold' },
  ]

  return (
    <AdminLayout title="정책 대시보드">
      <SEO title="정책 대시보드 — Admin" />
      <DashboardPageHeader
        icon={<ShieldCheck className="w-5 h-5" />}
        title="정책 SSOT 대시보드"
        subtitle="환불 / 수수료 / 세금 / 시간 상수 — 단일 진실원천"
      />

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
        <p className="font-bold mb-1">📖 정책 변경 방법</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>
            <strong>정적 정책</strong> (코드 상수): <code className="font-mono">src/shared/constants/policy.ts</code> 수정 + PR
          </li>
          <li>
            <strong>동적 정책</strong> (수수료 비율): <a href="/admin/payouts" className="underline font-bold">/admin/payouts</a> 에서 platform_settings 편집
          </li>
          <li>
            <strong>원천징수율</strong>: 한국 세법 (소득세법 §127) — hardcode 임 (BUSINESS_INCOME 3.3% / OTHER_INCOME 8.8%)
          </li>
        </ul>
      </div>

      <div className="space-y-4">
        <PolicyTable title="① REFUND_POLICY — 환불 / 만료 / 분쟁 / 출금" rows={refundRows} />
        <PolicyTable title="② COMMISSION_DEFAULTS — 수수료율 (% 단위)" rows={commissionRows} />
        <PolicyTable title="③ TAX_POLICY — 원천징수율 (한국 세법)" rows={taxRows} />
        <PolicyTable title="④ TIME_CONSTANTS — 폴링 / dedup / threshold (초/일)" rows={timeRows} />
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
        <p className="font-bold mb-2 text-gray-700">관련 페이지</p>
        <div className="grid grid-cols-2 gap-2">
          <a href="/admin/payouts" className="flex items-center gap-1 text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> /admin/payouts (수수료 비율 편집)
          </a>
          <a href="/admin/withholding" className="flex items-center gap-1 text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> /admin/withholding (원천징수 / 지급조서)
          </a>
          <a href="/admin/disputes" className="flex items-center gap-1 text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> /admin/disputes (분쟁 관리)
          </a>
          <a href="/admin/health" className="flex items-center gap-1 text-blue-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> /admin/health (시스템 헬스)
          </a>
        </div>
        {!loaded && <p className="mt-2 text-gray-400">동적 정책 로딩중…</p>}
      </div>
    </AdminLayout>
  )
}
