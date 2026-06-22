import { ChevronRight } from 'lucide-react'
import { WT, won, comma, GRADE_NAME } from '../wholesale/wholesale-theme'

// ── 사입 현황 대시보드 ──
export default function Dashboard({ grade, marginPct, company, monthSpend, orderCount, depositBalance, onGrade, onCharge }: {
  grade: string; marginPct: number; company: string; monthSpend: number; orderCount: number; depositBalance: number; onGrade: () => void; onCharge: () => void
}) {
  const metrics = [
    { k: '이번달 사입액', v: won(monthSpend) },
    { k: '누적 주문', v: comma(orderCount) + '건' },
    { k: '내 등급 마진', v: '+' + marginPct + '%' },
  ]
  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: WT.shCard }}>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center rounded-full px-3.5 h-9 text-[14px] font-extrabold text-white shrink-0 whitespace-nowrap" style={{ background: WT.brand }}>{GRADE_NAME[grade] || grade}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold truncate" style={{ color: WT.ink }}>{company} · <span style={{ color: WT.brand }}>{GRADE_NAME[grade] || grade} 회원</span> 단가 적용중</div>
          <div className="text-[12px] mt-0.5 truncate" style={{ color: WT.ink3 }}>모든 단가는 회원님 등급 기준 공급가예요</div>
        </div>
        <button onClick={onGrade} className="text-[13px] font-semibold shrink-0 flex items-center gap-0.5" style={{ color: WT.ink2 }}>등급 <ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {metrics.map((m, i) => (
          <div key={m.k} className={'px-1 ' + (i ? 'pl-3' : '')} style={i ? { borderLeft: '1px solid ' + WT.line } : {}}>
            <div className="text-[12px] whitespace-nowrap" style={{ color: WT.ink3 }}>{m.k}</div>
            <div className="text-[15px] font-extrabold mt-1 tabular-nums tracking-[-0.01em]" style={{ color: WT.ink }}>{m.v}</div>
          </div>
        ))}
      </div>
      {/* 🏦 예치금 잔액 — 도매 결제는 예치금 차감. 로그인 판매사에게 카탈로그에서 바로 노출. */}
      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid ' + WT.line }}>
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[12px] shrink-0" style={{ color: WT.ink3 }}>예치금 잔액</span>
          <span className="text-[17px] font-extrabold tabular-nums truncate" style={{ color: WT.ink }}>{won(depositBalance)}</span>
        </div>
        <button onClick={onCharge} className="shrink-0 rounded-lg px-3.5 py-1.5 text-[12px] font-bold text-white" style={{ background: 'var(--ud-brand, #FC5424)' }}>충전하기</button>
      </div>
    </div>
  )
}
