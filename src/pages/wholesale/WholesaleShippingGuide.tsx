/**
 * 🏭 2026-06-10 (사용자 시안 — docs/design/wholesale-board.md): 도매몰 배송 안내.
 *   4단계 플로우 + 마감시간 안내 + 당일배송 체크포인트.
 *   시안에서 제외(사용자 지시): 택배사명/택배사코드/출고지/반품지, 베이식스 문장.
 *   라이트 고정(WT) — dark: 없음.
 */
import { ClipboardCheck, PackageCheck, Truck, ScanSearch, ChevronRight, CheckCircle2 } from 'lucide-react'
import { WT } from './wholesale-theme'

const STEPS = [
  { icon: ClipboardCheck, label: '주문 및 결제확인' },
  { icon: PackageCheck, label: '배송준비' },
  { icon: Truck, label: '배송출발' },
  { icon: ScanSearch, label: '송장번호 안내' },
]

export default function WholesaleShippingGuide() {
  return (
    <div className="rounded-2xl p-5 lg:p-7" style={{ background: '#fff', border: '1px solid ' + WT.line, boxShadow: WT.shCard }}>
      <h3 className="text-[17px] font-extrabold mb-5" style={{ color: WT.ink }}>배송 안내</h3>

      {/* 4단계 플로우 */}
      <div className="flex items-center justify-between gap-1 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1 shrink-0">
            <div className="flex flex-col items-center gap-2 px-1.5">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center" style={{ background: WT.fill }}>
                <s.icon className="w-6 h-6 lg:w-7 lg:h-7" style={{ color: WT.ink }} />
              </div>
              <span className="text-[12px] lg:text-[13px] font-bold whitespace-nowrap" style={{ color: WT.ink }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 shrink-0 mb-6" style={{ color: WT.ink4 }} />}
          </div>
        ))}
      </div>

      {/* 마감/송장 안내 */}
      <ol className="space-y-3 mb-5">
        <li>
          <p className="text-[14px] font-bold" style={{ color: WT.ink }}>1. 주문 후 결제확인까지 오후 3시에 마감합니다.</p>
          <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: WT.ink3 }}>
            예치금은 자동 결제확인이 되지만, 계좌입금의 경우 수동 확인이 필요하므로
            오후 3시에 근접하게 주문을 넣어주시면 다음날 배송으로 넘어갑니다.
            이 점 참고하시어, 계좌입금 주문은 오후 2시 30분까지 여유롭게 넣어주시길 바랍니다.
          </p>
        </li>
        <li>
          <p className="text-[14px] font-bold" style={{ color: WT.ink }}>
            2. 물류센터에서 오후 3시부터 배송준비를 시작하며,<br className="hidden lg:block" /> 송장번호는 5시에 일괄적으로 파트너님들에게 발송됩니다.
          </p>
        </li>
      </ol>

      {/* 당일배송 체크포인트 */}
      <div className="rounded-xl p-4 flex items-start gap-2.5" style={{ background: WT.fill2, border: '1px solid ' + WT.line }}>
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
        <p className="text-[13px] leading-relaxed" style={{ color: WT.ink2 }}>
          당일배송은 오후 2시 59분 주문건을 기준으로 마감합니다.<br />
          3시 이후의 주문건은 다음날 배송으로 넘어갑니다.
        </p>
      </div>
    </div>
  )
}
