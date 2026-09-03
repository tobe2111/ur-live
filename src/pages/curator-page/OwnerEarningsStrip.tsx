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

  // 🎨 2026-06-17 (C — 편집 모드 정리): 큰 멀티라인 네이비 카드 → 한 줄 탭 가능 바.
  //   상세(구매수/보류 설명)는 콘솔(/creator)에서. 공개뷰에 가깝게 시각 무게만 축소(데이터/링크 동일). theme-dual
  return (
    <div className="max-w-3xl mx-auto px-4 pt-2">
      <Link
        to="/creator"
        className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-white active:opacity-90"
        style={{ background: 'linear-gradient(120deg,#1D1F29,#3A3D44)' }}
      >
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span className="shrink-0 text-[11px] text-white/55">{t('curator.earn30dConfirmed', { defaultValue: '최근 30일 적립' })}</span>
          <b className="text-[15px] font-extrabold leading-none">{formatWon(confirmed)}</b>
          {pending > 0 && <span className="truncate text-[11px] font-bold text-[#FFB59E]">+{formatWon(pending)} {t('curator.pendingEarn', { defaultValue: '예정' })}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2.5 text-[11px] text-white/70">
          <span className="hidden xs:inline">{t('curator.statClicks', { defaultValue: '클릭' })} <b className="text-white">{formatNumber(clicks)}</b></span>
          <span>{t('curator.statConv', { defaultValue: '전환' })} <b className="text-[#37D399]">{conv}%</b></span>
          <span className="font-bold text-white/85">{t('curator.consoleLink', { defaultValue: '콘솔' })} →</span>
        </span>
      </Link>
    </div>
  )
}
