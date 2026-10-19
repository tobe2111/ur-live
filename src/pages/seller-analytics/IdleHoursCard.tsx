/**
 * 🕑 빈 시간대 카드 (2026-10-19) — 이용권이 실제로 쓰인 시각으로 "가장 한가한 시간"을 말한다.
 *
 * 판정은 서버가 `shared/idle-hours.ts` 로 하고, 이 카드는 **표시만** 한다.
 * 표본이 얇으면(20건 미만) 판정을 숨기고 "몇 건 더 쌓이면" 만 말한다 — 얇은 표본으로
 * "이 시간이 한가하다" 고 하면 거짓이 된다.
 */
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { IDLE_MIN_SAMPLES, type IdleHoursReport, type HourBlock } from '@/shared/idle-hours'

const CARD = 'rounded-[var(--dash-radius,16px)] border border-rule bg-white'

export default function IdleHoursCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useApiQuery<IdleHoursReport | null>(
    ['seller', 'analytics', 'idle-hours'], '/api/seller/analytics/idle-hours',
    { select: (r: any) => (r?.success ? r.data : null) },
  )
  if (isLoading || isError || !data) return null

  const hour = (h: number, withHalf: boolean) => {
    const hh = ((h % 24) + 24) % 24
    const n = hh % 12 === 0 ? 12 : hh % 12
    const num = t('seller.idleHours.hour', { n, defaultValue: '{{n}}시' })
    if (!withHalf) return num
    const half = hh < 12 ? t('seller.idleHours.am', { defaultValue: '오전' }) : t('seller.idleHours.pm', { defaultValue: '오후' })
    return `${half} ${num}`
  }
  const label = (b: HourBlock) => {
    const day = b.dayType === 'weekday' ? t('seller.idleHours.weekday', { defaultValue: '평일' }) : t('seller.idleHours.weekend', { defaultValue: '주말' })
    const sameHalf = (b.from < 12) === (b.to <= 12)
    return `${day} ${hour(b.from, true)}~${hour(b.to, !sameHalf)}`
  }

  return (
    <div className={`${CARD} p-4`}>
      <p className="text-[12px] font-semibold text-gray-400">{t('seller.idleHours.title', { defaultValue: '빈 시간대' })}</p>
      {!data.enough || !data.quietest || !data.busiest ? (
        <p className="mt-1 text-[13px] text-gray-500">
          {t('seller.idleHours.notEnough', { min: IDLE_MIN_SAMPLES, n: data.total, defaultValue: '이용권 사용이 {{min}}건 쌓이면 가장 한가한 시간을 알려 드려요. (지금 {{n}}건)' })}
        </p>
      ) : (
        <>
          <p className="mt-1 text-[17px] font-bold text-gray-900">
            {t('seller.idleHours.quietHeadline', { block: label(data.quietest), defaultValue: '{{block}}이 가장 한가해요' })}
          </p>
          <p className="mt-1 text-[13px] text-gray-500">
            {t('seller.idleHours.quietDetail', {
              n: data.quietest.perDay, busy: label(data.busiest), m: data.busiest.perDay,
              defaultValue: '하루 평균 {{n}}건 사용 · 가장 바쁜 {{busy}}은 {{m}}건',
            })}
          </p>
          <p className="mt-3 text-[13px] text-gray-700">
            {t('seller.idleHours.suggest', { defaultValue: '이 시간에만 쓰는 이용권을 내면 빈 자리를 채울 수 있어요.' })}
          </p>
          <button type="button" onClick={() => navigate('/seller/meal-voucher/new')}
            className="mt-3 ur-btn ur-btn-md ur-btn-primary">
            {t('seller.idleHours.cta', { defaultValue: '시간 한정 이용권 만들기' })}
          </button>
        </>
      )}
      <p className="mt-3 text-[12px] text-gray-400">{t('seller.idleHours.basis', { defaultValue: '최근 90일 이용권 사용 시각 기준' })}</p>
    </div>
  )
}
