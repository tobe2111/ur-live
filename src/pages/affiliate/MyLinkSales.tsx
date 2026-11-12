/**
 * 🧭 내 링크로 산 결제 — 무엇을 보고 샀나 (2026-11-12 대표 *"모두 확인해봐 계속 진행"*)
 *
 * 소개 링크로 들어온 손님이 유어쇼츠·'다녀온 사람들'을 보고 사도 **성과는 전부 이 사람**이다(2026-11-11 결재).
 * 그 사실을 본인이 볼 수 있게 한 줄씩 보여 준다 — 링크만 뿌리면 유어딜이 나머지를 해 준다는 신호다.
 * 0건이면 그리지 않는다(빈 표는 "고장" 처럼 보인다). 조회 실패도 그리지 않는다(0 으로 위장하지 않는다).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

interface MyLinkTouch { days: number; total: number; urshorts: number; content: number; direct: number }

export default function MyLinkSales() {
  const { data } = useQuery<MyLinkTouch | null>({
    queryKey: ['affiliate', 'touch'],
    queryFn: () => api.get('/api/affiliate/touch').then((r) => (r.data?.success ? r.data.data as MyLinkTouch : null)),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  if (!data || data.total <= 0) return null
  const rows: Array<[string, number]> = [
    ['유어쇼츠 영상을 보고 산 결제', data.urshorts],
    ['다녀온 사람들 영상·글을 보고 산 결제', data.content],
    ['바로 산 결제', data.direct],
  ]
  return (
    <section aria-label="내 링크로 산 결제" className="py-2" data-testid="my-link-sales">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white">내 링크로 산 결제</h2>
        <span className="text-[13px] text-gray-500 dark:text-gray-400">최근 {data.days}일 · <span className="tabular-nums font-bold text-gray-900 dark:text-white">{formatNumber(data.total)}건</span></span>
      </div>
      <ul className="mt-2 divide-y divide-rule">
        {rows.map(([label, n]) => (
          <li key={label} className="flex h-12 items-center justify-between">
            <span className="text-[15px] text-gray-900 dark:text-white">{label}</span>
            <span className={`text-[13px] tabular-nums ${n > 0 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{formatNumber(n)}건</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">내 링크로 들어온 손님이 24시간 안에 산 결제예요. 무엇을 보고 샀든 전부 내 성과예요.</p>
    </section>
  )
}
