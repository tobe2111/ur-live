/**
 * 🧾 소개 수익 카드 — 정산 탭 안 (2026-09-15 대표 확정 C안 · `seller-dashboard-2nd-directions-2026-09.md`).
 *
 *   대표: *"`/u/me/earnings` 소개 수익 페이지는 왜 따로 셀러대시보드에서 보지 않고 메인 형태에서 보는거지?"*
 *   담기(소개)는 **유저 행위**라 커미션이 users 에 쌓이고(`/api/curator/me/dashboard`), 셀러 대시보드는 좌석(seller_token)
 *   도구다. 그래서 두 돈이 두 곳으로 갈렸다. 여기서는 **같은 API 를 읽어 한 화면에** 둔다 — 새 서버 코드 0.
 *   - 소비자 세션 쿠키(ur_session)가 없거나 401 이면 **아무것도 그리지 않는다**(이메일 로그인 셀러 = 소개 수익 없음).
 *   - 확정(출금 가능)과 보류(T+7)를 분리 표기 — 유어샵 상단 strip(OwnerEarningsStrip)과 같은 규칙.
 *   - 출금은 여기서 하지 않는다(유저 출금 체계 `/u/me/earnings` 링크). 머니 경로 무접촉.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Layers } from 'lucide-react'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon } from '@/utils/format'
import DashboardCard from '@/components/dashboard/DashboardCard'

interface DashboardStats {
  month_earnings?: number
  pending_earnings?: number
  unique_clicks_30d?: number
  clicks_30d?: number
  conversion_rate_30d?: number
  purchases_30d?: number
}

export default function ReferralEarningsCard() {
  const { t } = useTranslation()
  // 🏎️ 유어샵 strip·소개 콘솔과 같은 RQ 키 — 세 화면이 한 응답을 나눠 쓴다(staleTime 60s).
  const q = useApiQuery<DashboardStats | null>(
    ['curator', 'dashboard'],
    '/api/curator/me/dashboard',
    { select: (raw) => ((raw as { success?: boolean; stats?: DashboardStats })?.success ? ((raw as { stats: DashboardStats }).stats) : null) },
  )
  const stats = q.data ?? null
  // 로딩 중·실패·소비자 세션 없음 → 자리를 만들지 않는다(빈 카드가 "소개 수익 0" 으로 읽힌다).
  if (!stats) return null

  const confirmed = stats.month_earnings ?? 0
  const pending = stats.pending_earnings ?? 0
  const conv = stats.conversion_rate_30d ?? 0
  const cells = [
    { label: t('seller.referral.confirmed', { defaultValue: '확정 (출금 가능)' }), value: formatWon(confirmed), strong: true },
    { label: t('seller.referral.pending', { defaultValue: '보류 (T+7)' }), value: formatWon(pending) },
    { label: t('seller.referral.conv', { defaultValue: '전환율 30일' }), value: `${conv}%` },
  ]
  return (
    <DashboardCard
      title={t('seller.referral.title', { defaultValue: '소개 수익' })}
      subtitle={t('seller.referral.subtitle', { defaultValue: '유어샵에 담은 남의 이용권이 팔리면 쌓이는 커미션' })}
      actions={
        <Link to="/u/me/earnings" className="flex items-center gap-1 text-[12px] font-bold text-brand-text">
          <Layers size={14} />
          {t('seller.referral.console', { defaultValue: '소개 콘솔' })}
          <ChevronRight size={14} />
        </Link>
      }
      noPadding
    >
      <div className="grid grid-cols-3 divide-x divide-rule">
        {cells.map((c) => (
          <div key={c.label} className="px-4 py-3">
            <p className={`dash-num text-[length:var(--dash-stat,24px)] font-extrabold leading-tight ${c.strong ? 'text-gray-900' : 'text-gray-700'}`}>{c.value}</p>
            <p className="mt-1 text-[11.5px] text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}
