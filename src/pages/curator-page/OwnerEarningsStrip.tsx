/**
 * 🧱 2026-09-02 (file-size 래칫 — 유어샵 안3/안P1 구현): `CuratorPage.tsx` 에서 **그대로 추출** — 동작·마크업 불변.
 *   CuratorPage 가 701줄 동결이라 카테고리 칩·PC 2단을 얹으려면 자기완결 블록을 먼저 떼어내야 했다.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon, formatNumber } from '@/utils/format'
import type { DashboardStats } from '@/features/curator/api/curator-api'

// 🏁 2026-06-16 (유어샵 개선안 — 정직한 적립 표시): 본인 뷰 상단 적립 strip.
//   ⚠️ T+7 hold(2026-06-15) 도입으로 적립은 보류→확정 단계가 있음 — 시안의 "이번 주 적립" 단일 숫자를
//   그대로 쓰면 크리에이터가 즉시 현금을 기대 → 혼란. 확정(출금가능) + 예정(보류) 을 명확히 분리 표기.
export default function OwnerEarningsStrip() {
  const { t } = useTranslation()
  // 🏎️ 2026-06-17 (유어샵 감사): 무거운 9쿼리 /me/dashboard 를 수익 콘솔(CuratorEarningsPage)과
  //   동일 RQ 키로 공유 — 유어샵 strip → 콘솔 진입 시 재요청 없이 캐시 재사용(staleTime 60s). D1 부하 절감.
  const dashQ = useApiQuery<DashboardStats | null>(
    ['curator', 'dashboard'],
    '/api/curator/me/dashboard',
    { select: (raw) => ((raw as { success?: boolean; stats?: DashboardStats })?.success ? ((raw as { stats: DashboardStats }).stats) : null) },
  )
  const stats = dashQ.data ?? null
  // 로딩/실패 시 숨김 (레이아웃 점프 없이 핀이 먼저). 적립 0 이어도 표시 — 시작 동기 부여.
  if (!stats) return null
  const confirmed = stats.month_earnings ?? 0
  const pending = stats.pending_earnings ?? 0
  const clicks = stats.unique_clicks_30d ?? stats.clicks_30d ?? 0
  const conv = stats.conversion_rate_30d ?? 0

  // 🎫 2026-09-28 (e3 — 관리 화면으로 이사): 잉크 **그라디언트** 바 → 흰 카드 + 큰 숫자.
  //   디자인 시스템 표면 규칙 ⑥(그라디언트 0)·②(강조색 하나, 자리 셋)을 그 바가 정면으로 어기고 있었다
  //   (잉크 그라디언트 + 초록 전환율 + 연어색 예정액 = 한 줄에 색이 셋). 관리 화면은 볼륨 규율에서는
  //   자유롭지만 **색 규율은 브랜드 전체 규칙**이라 예외가 아니다. 숫자가 주인공이 되게 27px 로 올린다.
  return (
    <Link to="/creator" className="block max-w-3xl mx-auto rounded-xl bg-surface shadow-lift p-4 active:opacity-90">
      <div className="flex items-center">
        <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
          {t('curator.earn30dConfirmed', { defaultValue: '최근 30일 적립' })}
        </span>
        <span className="ml-auto text-[12px] font-semibold text-brand-text">
          {t('curator.consoleLink', { defaultValue: '콘솔' })} ›
        </span>
      </div>
      <div className="mt-1 text-[28px] font-bold tracking-[-0.035em] tabular-nums text-gray-900 dark:text-white">{formatWon(confirmed)}</div>
      <div className="mt-1 text-[12px] text-gray-400 dark:text-gray-500 tabular-nums">
        {pending > 0 && <>{t('curator.pendingEarn', { defaultValue: '예정' })} {formatWon(pending)} · </>}
        {t('curator.statClicks', { defaultValue: '클릭' })} {formatNumber(clicks)} · {t('curator.statConv', { defaultValue: '전환' })} {conv}%
      </div>
    </Link>
  )
}
