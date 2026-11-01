/**
 * 📊 **누가 팔았나** — 사장님 매출 분석의 한 카드 (2026-10-24 대표 확정 '누가 팔았나 한 화면')
 *   대표: *"사장님 화면에서 에이전시 별 성과(인플루언서 혹은 고유링크별 성과)를 따로 보여줘야지."*
 *
 * 줄: 사장님 직접 · 에이전시마다 · (아래) 소개 링크로 판 사람마다. 판매·매출·사용·환불을 같은 기준으로 센다
 * (서버 `channel-sales.ts` — 판 순간 그 이용권을 맡고 있던 에이전시 몫). 소개 판매는 위 줄 판매에 **이미 포함**이다 —
 * 같은 판매를 '누가 등록·관리했나' 와 '누구 링크로 왔나' 두 갈래로 본다(화면이 그렇게 말한다).
 *
 * 🔐 사장님 전용 API 라 운영자·에이전시는 403 — 그때 카드를 그리지 않는다(지어낸 0 을 보이지 않는다).
 * ⚠️ 대시보드 = 라이트 고정(`dark:` 금지).
 */
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatNumber } from '@/utils/format'
import { AGENCY_SHARE_NOTE } from '@/pages/seller-operators/AgencyShareEditor'

type Period = 'month' | '30d' | 'all'
interface Metrics { sold: number; revenue: number; used: number; refunded: number }
interface ChannelRow extends Metrics { kind: 'owner' | 'agency'; agencyId: number | null; name: string; products: number; linkStatus: 'active' | 'pending' | 'ended' | null; sharePct: number | null; shareAmount: number }
interface ReferralRow extends Metrics { userId: number; name: string | null; handle: string | null; commission: number }
interface Perf { period: Period; rows: ChannelRow[]; referrals: ReferralRow[] }

const CARD = 'rounded-[var(--dash-radius,16px)] border border-rule bg-white'

export default function StoreChannelPerformance() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('month')
  const { data, isLoading, isError, refetch } = useApiQuery<Perf | null>(
    ['seller', 'analytics', 'channel-performance', period], `/api/seller/agency-link/performance?period=${period}`,
    { select: (r: any) => (r?.success ? r.data : null) },
  )
  const periods: { key: Period; label: string }[] = [
    { key: 'month', label: t('seller.channelPerf.month', { defaultValue: '이번 달' }) },
    { key: '30d', label: t('seller.channelPerf.last30', { defaultValue: '최근 30일' }) },
    { key: 'all', label: t('seller.channelPerf.all', { defaultValue: '전체' }) },
  ]
  // 사장님이 아니면(운영자) 이 카드는 없다 — 403 을 '0건' 으로 그리지 않는다.
  if (isError && !data) {
    return null
  }
  const rows = data?.rows ?? []
  const referrals = data?.referrals ?? []
  const hasAgency = rows.some((r) => r.kind === 'agency')

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-gray-400">{t('seller.channelPerf.title', { defaultValue: '누가 팔았나' })}</p>
        <div className="flex gap-1" role="tablist">
          {periods.map((p) => (
            <button key={p.key} type="button" role="tab" aria-selected={period === p.key} onClick={() => setPeriod(p.key)}
              className={`h-8 rounded-full px-3 text-[12px] font-semibold ${period === p.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && !data ? (
        <p className="mt-3 text-[13px] text-gray-500">{t('common.loading', { defaultValue: '불러오는 중…' })}</p>
      ) : !data ? (
        <button type="button" onClick={() => refetch()} className="mt-3 text-[13px] font-semibold text-brand-text underline">
          {t('common.retry', { defaultValue: '다시 시도' })}
        </button>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="py-2 font-semibold">{t('seller.channelPerf.who', { defaultValue: '누가' })}</th>
                  <th className="py-2 text-right font-semibold">{t('seller.channelPerf.sold', { defaultValue: '판매' })}</th>
                  <th className="py-2 text-right font-semibold">{t('seller.channelPerf.revenue', { defaultValue: '매출' })}</th>
                  <th className="py-2 text-right font-semibold">{t('seller.channelPerf.used', { defaultValue: '사용' })}</th>
                  <th className="py-2 text-right font-semibold">{t('seller.channelPerf.refunded', { defaultValue: '환불' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((r) => (
                  <tr key={r.agencyId ?? 'owner'}>
                    <td className="py-3 pr-2">
                      <span className="block font-semibold text-gray-900 truncate max-w-[180px]">{r.name}</span>
                      <span className="block text-[12px] text-gray-400">
                        {t('seller.channelPerf.products', { n: r.products, defaultValue: '맡은 이용권 {{n}}개' })}
                        {r.linkStatus === 'ended' && ` · ${t('seller.channelPerf.ended', { defaultValue: '운영 끝남' })}`}
                        {r.linkStatus === 'pending' && ` · ${t('seller.channelPerf.pending', { defaultValue: '수락 기다리는 중' })}`}
                      </span>
                      {r.kind === 'agency' && (
                        <span className="block text-[12px] text-gray-500">
                          {r.sharePct == null
                            ? t('seller.channelPerf.shareUnset', { defaultValue: '몫 미정' })
                            : t('seller.channelPerf.share', { pct: r.sharePct, n: formatNumber(r.shareAmount), defaultValue: '몫 {{pct}}% · {{n}}원' })}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right tabular-nums text-gray-900">{formatNumber(r.sold)}</td>
                    <td className="py-3 text-right tabular-nums text-gray-900">{formatNumber(r.revenue)}<span className="text-gray-400">원</span></td>
                    <td className="py-3 text-right tabular-nums text-gray-700">{formatNumber(r.used)}</td>
                    <td className={`py-3 text-right tabular-nums ${r.refunded > 0 ? 'text-tone-bad' : 'text-gray-400'}`}>{formatNumber(r.refunded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasAgency && (
            <p className="mt-2 text-[12px] leading-[1.55] text-gray-500">
              {t('seller.channelPerf.shareNote', { defaultValue: AGENCY_SHARE_NOTE })}
            </p>
          )}
          {!hasAgency && (
            <p className="mt-2 text-[12px] text-gray-500">
              {t('seller.channelPerf.noAgency', { defaultValue: '에이전시에 맡기면 에이전시마다 따로 셉니다(운영자 관리 → 에이전시에 맡기기).' })}
            </p>
          )}

          <p className="mt-5 text-[12px] font-semibold text-gray-400">{t('seller.channelPerf.referralTitle', { defaultValue: '소개 링크로 판매' })}</p>
          {referrals.length === 0 ? (
            <p className="mt-1 text-[13px] text-gray-500">{t('seller.channelPerf.noReferral', { defaultValue: '이 기간에 소개 링크로 팔린 이용권이 없어요.' })}</p>
          ) : (
            <ul className="mt-1 divide-y divide-rule">
              {referrals.map((r) => (
                <li key={r.userId} className="flex items-center gap-3 py-3 text-[13px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900">{r.name || (r.handle ? `@${r.handle}` : t('seller.channelPerf.unknownUser', { defaultValue: '알 수 없는 유저' }))}</span>
                    {r.handle && <span className="block text-[12px] text-gray-400">@{r.handle}</span>}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block text-gray-900">{t('seller.channelPerf.soldN', { n: formatNumber(r.sold), defaultValue: '{{n}}장' })} · {formatNumber(r.revenue)}원</span>
                    <span className="block text-[12px] text-gray-400">{t('seller.channelPerf.commission', { n: formatNumber(r.commission), defaultValue: '인플루언서 수수료 {{n}}원' })}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] leading-[1.55] text-gray-500">
            {t('seller.channelPerf.note', { defaultValue: '소개 링크 판매는 위 판매에 이미 들어 있어요. 같은 판매를 누가 맡았나와 누구 링크로 왔나 두 갈래로 봅니다.' })}
          </p>
        </>
      )}
    </div>
  )
}
