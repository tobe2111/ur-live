/**
 * 🕐 **최신화 내역** — 최근 14일 신규 유입 (2026-08-03 대표 요청 *"파트너 풀 최신화 업데이트 내역 보이게끔"*).
 *
 * ## 왜 필요한가
 * 화면엔 총계와 레인별 상태줄만 있었다. **총계는 며칠 멈춰도 안 변한다** — 멈춤이 안 보이는 지표다.
 * *"요즘 들어오고는 있나 · 그중 연락 가능한 건 몇이나"* 는 날짜별로 봐야 보인다.
 *
 * ## ⚠️ 날짜는 서버가 KST 경계로 센다
 * `DATE(collected_at,'+9 hours')` — UTC 로 자르면 한국의 '오늘'이 **09:00 에 시작**한다.
 * 이 레포가 반복해 당한 9시간 오차이고 `check-utc-date-parse` 가 지키는 그 클래스다.
 * 여기서는 **서버가 준 문자열을 그대로 표시만** 한다(클라에서 다시 파싱하면 그 오차가 되살아난다).
 */
import { formatNumber } from '@/utils/format'

export interface DayInflow { d: string; n: number; reachable: number }

export default function InflowTimeline({ byDay }: { byDay: DayInflow[] }) {
  if (!byDay.length) return null
  const max = Math.max(1, ...byDay.map(x => x.n))
  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs font-semibold text-gray-700">최신화 내역 <span className="font-normal text-gray-400">— 최근 14일 신규 유입(한국시간)</span></div>
        <div className="text-[11px] text-gray-500">숫자 = <b className="text-indigo-600">연락 가능</b> / 전체</div>
      </div>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
        {[...byDay].reverse().map(x => (
          <div key={x.d} className="flex flex-col items-center min-w-[42px]">
            <div className="w-full h-14 flex items-end" title={`${x.d} · 유입 ${x.n} · 연락 가능 ${x.reachable}`}>
              <div className="w-full rounded-t bg-gray-200 relative" style={{ height: `${Math.max(4, (x.n / max) * 56)}px` }}>
                {/* 채워진 부분 = 연락 가능 비율. 이 풀의 성공 지표는 총 인원이 아니라 "제안 보낼 수 있는 리드 수"다. */}
                <div className="absolute bottom-0 left-0 right-0 rounded-t bg-indigo-500" style={{ height: `${x.n > 0 ? (x.reachable / x.n) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="mt-1 text-[10px] tabular-nums text-gray-500">{x.d.slice(5)}</div>
            <div className="text-[10px] tabular-nums"><b className="text-indigo-600">{formatNumber(x.reachable)}</b><span className="text-gray-400">/{formatNumber(x.n)}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}
