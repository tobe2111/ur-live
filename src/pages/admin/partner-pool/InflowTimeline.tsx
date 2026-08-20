/**
 * 🕐 **최신화 내역** — 최근 14일 신규 유입 (2026-08-03 대표 요청 *"파트너 풀 최신화 업데이트 내역 보이게끔"*).
 *   🔁 **두 수집 페이지 공용**(2026-08-19 대표 *"인플루언서 수집 페이지도 B2B 수집 페이지처럼"*) —
 *   파트너 풀(업체·매장후보)과 인플루언서 풀이 **같은 컴포넌트**를 쓴다. 두 벌로 두면 반드시 갈라진다.
 *
 * ## 왜 필요한가
 * 화면엔 총계와 레인별 상태줄만 있었다. **총계는 며칠 멈춰도 안 변한다** — 멈춤이 안 보이는 지표다.
 * *"요즘 들어오고는 있나 · 그중 연락 가능한 건 몇이나"* 는 날짜별로 봐야 보인다.
 *
 * ## ⚠️ 날짜는 서버가 KST 경계로 센다
 * `DATE(collected_at,'+9 hours')` — UTC 로 자르면 한국의 '오늘'이 **09:00 에 시작**한다.
 * 이 레포가 반복해 당한 9시간 오차이고 `check-utc-date-parse` 가 지키는 그 클래스다.
 * 여기서는 **서버가 준 문자열을 그대로 표시만** 한다(클라에서 다시 파싱하면 그 오차가 되살아난다).
 *
 * ## 📉 추세 배지 + '진행 중' 표시 (2026-08-19 대표 *"점점 줄어드는지도 봐줘"*)
 * 오늘 막대는 **아직 안 끝난 날**이라 오후에 보면 늘 전날보다 낮다. 그걸 그냥 두면 매일 오후마다
 * "폭락했다"로 읽힌다(실제로 그렇게 읽힐 뻔했다 — 마지막 막대가 절반짜리였다). 그래서
 *   · 오늘 막대는 **빗금 + '진행 중'** 으로 구분하고
 *   · 추세 판정에서는 **오늘을 아예 뺀다**(규칙은 `@/shared/ads/inflow-trend` SSOT).
 * `todayKst` 를 안 넘기면 배지도 진행중 표시도 없다(모르면 아무 말도 안 한다).
 */
import { formatNumber } from '@/utils/format'
import { summarizeInflow, type InflowDay } from '@/shared/ads/inflow-trend'

export type DayInflow = InflowDay

export default function InflowTimeline({ byDay, label = '연락 가능', todayKst }: {
  byDay: DayInflow[]
  /** 채워진 부분의 이름. 인플루언서 풀은 '이메일'(유일한 발송 채널), 파트너 풀은 '연락 가능'(이메일·전화). */
  label?: string
  /** 서버가 준 KST 오늘 날짜(`YYYY-MM-DD`). 진행 중 막대 표시 + 추세에서 제외에 쓴다. */
  todayKst?: string | null
}) {
  if (!byDay.length) return null
  const max = Math.max(1, ...byDay.map(x => x.n))
  const t = summarizeInflow(byDay, todayKst)
  const pct = Math.round(t.deltaRatio * 100)
  const tone = t.verdict === 'down' ? 'text-rose-600' : t.verdict === 'up' ? 'text-emerald-600' : 'text-gray-500'
  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="text-xs font-semibold text-gray-700">최신화 내역 <span className="font-normal text-gray-400">— 최근 14일 신규 유입(한국시간)</span></div>
        <div className="flex items-baseline gap-3">
          {t.verdict !== 'unknown' && (
            /* 완료된 날만 센다 — 오늘은 빠져 있다. 그래서 오후에 봐도 판정이 안 흔들린다. */
            <div className={`text-[11px] font-medium ${tone}`} title={`최근 ${t.recentDays}일 평균 ${Math.round(t.recentAvg)} vs 직전 ${t.prevDays}일 평균 ${Math.round(t.prevAvg)} (오늘 제외)`}>
              {t.verdict === 'down' ? '▼ 감소' : t.verdict === 'up' ? '▲ 증가' : '— 보합'} {pct > 0 ? '+' : ''}{pct}%
              <span className="ml-1 font-normal text-gray-400">7일 평균 {formatNumber(Math.round(t.recentAvg))}/일</span>
            </div>
          )}
          <div className="text-[11px] text-gray-500">숫자 = <b className="text-indigo-600">{label}</b> / 전체</div>
        </div>
      </div>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
        {[...byDay].reverse().map(x => {
          const today = !!todayKst && x.d === todayKst
          return (
            <div key={x.d} className="flex flex-col items-center min-w-[42px]">
              <div className="w-full h-14 flex items-end" title={`${x.d} · 유입 ${x.n} · ${label} ${x.reachable}${today ? ' (진행 중 — 하루가 끝나지 않았습니다)' : ''}`}>
                <div className={`w-full rounded-t relative ${today ? 'bg-gray-100 ring-1 ring-dashed ring-gray-300' : 'bg-gray-200'}`} style={{ height: `${Math.max(4, (x.n / max) * 56)}px` }}>
                  {/* 채워진 부분 = 연락 가능 비율. 이 풀의 성공 지표는 총 인원이 아니라 "제안 보낼 수 있는 리드 수"다. */}
                  <div className={`absolute bottom-0 left-0 right-0 rounded-t ${today ? 'bg-indigo-300' : 'bg-indigo-500'}`} style={{ height: `${x.n > 0 ? (x.reachable / x.n) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="mt-1 text-[10px] tabular-nums text-gray-500">{x.d.slice(5)}</div>
              <div className="text-[10px] tabular-nums"><b className="text-indigo-600">{formatNumber(x.reachable)}</b><span className="text-gray-400">/{formatNumber(x.n)}</span></div>
              {today && <div className="text-[9px] text-gray-400 leading-tight">진행 중</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
