import { Link } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatNumber } from '@/utils/format'
import type { DashboardStats } from '@/features/curator/api/curator-api'

/**
 * 🧾 유어샵 B — **주인만 보는 요약 판** (2026-11-03 대표 *"유어샵은 B"*, 시안 I4·I5).
 *
 * [최근 30일 내 유어샵 · 자세히 ›] / [방문 · 구매 · 소개 수익] / [이용권 담기(블루) · 공유하기].
 * ⚠️ 2026-09-02 *"주인·방문자 차이는 헤더 버튼 한 자리뿐"* 을 대표가 B 로 **바꿨다**(방문자에겐 여전히 안 뜬다).
 *
 * 숫자는 수익 콘솔과 **같은 요청·같은 RQ 키**(`['curator','dashboard']`)다 — 재요청이 없고 두 화면이 같은 값을 말한다.
 * ⏳ 주인은 첫 그림부터 안다(localStorage) — 숫자가 오기 전에도 판의 자리를 잡아 아래가 밀리지 않는다.
 *   모르면 숫자를 지어내지 않는다(`—`). 실패해도 판은 남는다(담기·공유는 숫자 없이도 쓴다).
 */
/**
 * @param hasSns 유어샵에 SNS 가 하나라도 걸려 있는가. 없으면 판 아래에 '+ SNS 연결' 이 선다(주인에게만 — 이 판이 주인 전용이다).
 *   ⚠️ 머리(`CuratorHeader`)에는 넣지 않는다 — 머리의 주인 전용 자리는 '관리' 하나라는 2026-09-02 규칙과 서버 첫 화면 짝을 지킨다.
 */
export default function OwnerSummaryCard({ onShare, hasSns }: { onShare: () => void; hasSns: boolean }) {
  const q = useApiQuery<DashboardStats | null>(
    ['curator', 'dashboard'],
    '/api/curator/me/dashboard',
    { select: (raw) => ((raw as { success?: boolean; stats?: DashboardStats })?.success ? ((raw as { stats: DashboardStats }).stats) : null) },
  )
  const s = q.data ?? null
  const cell = (v: number | null | undefined, unit = '') => (s && v != null ? `${formatNumber(v)}${unit}` : '—')
  return (
    <div className="mx-4 mt-3 rounded-2xl bg-surface px-5 py-4" data-testid="ushop-owner-summary">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-gray-500 dark:text-gray-400">최근 30일 내 유어샵</p>
        <Link to="/u/me/earnings" className="text-[13px] text-gray-500 dark:text-gray-400 active:opacity-70">자세히 ›</Link>
      </div>
      <div className="mt-2 grid grid-cols-3">
        {([['방문', cell(s?.unique_clicks_30d ?? s?.clicks_30d)], ['구매', cell(s?.purchases_30d)], ['소개 수익', cell(s?.month_earnings, '원')]] as const).map(([label, val]) => (
          <div key={label}>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-1 text-[20px] font-bold tabular-nums text-gray-900 dark:text-white">{val}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Link to="/u/me/add?tab=voucher" className="flex-1 h-11 rounded-xl bg-brand text-white text-[15px] font-medium flex items-center justify-center active:opacity-90">이용권 담기</Link>
        <button type="button" onClick={onShare} className="flex-1 h-11 rounded-xl bg-wash text-gray-900 dark:text-white text-[15px] font-medium active:opacity-80">공유하기</button>
      </div>
      {!hasSns && (
        <Link to="/u/me/manage" className="mt-3 flex items-center justify-between rounded-xl bg-brand-tint px-4 h-11 text-[13px] font-medium text-brand-text active:opacity-80" data-testid="ushop-sns-connect">
          <span>+ SNS 연결하기</span><span aria-hidden="true">›</span>
        </Link>
      )}
    </div>
  )
}
