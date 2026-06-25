import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { useWholesaleStatement } from '@/hooks/queries/useWholesale'
import { WT, won, comma } from './wholesale/wholesale-theme'
import { useWholesaleBack } from '@/hooks/useWholesaleBack'
import { safeDate } from '@/utils/safe-date'

// 🏭 2026-06-04 유통스타트 거래내역서 — TDS 라이트 시안 정비. 라이트 고정 B2B (인쇄 가능).

const STATUS_KO: Record<string, string> = { PAID: '결제완료', SHIPPED: '배송중', REFUNDED: '환불', PARTIAL_REFUNDED: '부분환불', DONE: '구매확정' }

export default function WholesaleStatementPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate()
  const goBack = useWholesaleBack()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)
  const [q, setQ] = useState({ from: monthAgo, to: today })
  const { data, isLoading: loading } = useWholesaleStatement(q.from, q.to)
  const orders = data?.orders ?? []
  const summary = data?.summary ?? null
  const load = () => setQ({ from, to })

  useEffect(() => { if (!embedded && !token) navigate('/wholesale/login') }, [embedded, token, navigate])

  const inputCls = 'ml-2 px-2.5 h-9 rounded-lg text-[14px] outline-none'
  const inputStyle = { background: WT.fill, color: WT.ink }

  // 콘텐츠(거래내역 본문) — embedded/standalone 공유.
  const content = (
    <>
        <div className="flex flex-wrap items-end gap-3 mb-5 print:hidden">
          <label className="text-[14px]" style={{ color: WT.ink2 }}>시작<input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} style={inputStyle} /></label>
          <label className="text-[14px]" style={{ color: WT.ink2 }}>종료<input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} style={inputStyle} /></label>
          <button onClick={load} className="px-5 h-9 rounded-lg text-[14px] font-bold text-white" style={{ background: WT.ink }}>조회</button>
        </div>

        {summary && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { k: '건수', v: comma(summary.count) + '건' },
              { k: '매입 합계', v: won(summary.total_paid) },
              { k: '순매입 (환불 차감)', v: won(summary.net) },
            ].map((m) => (
              <div key={m.k} className="rounded-2xl p-4" style={{ background: WT.fill2 }}>
                <div className="text-[12px]" style={{ color: WT.ink3 }}>{m.k}</div>
                <div className="text-[18px] font-extrabold mt-1 tabular-nums tracking-[-0.01em]" style={{ color: WT.ink }}>{m.v}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin" style={{ color: WT.ink4 }} /></div>
        ) : orders.length === 0 ? (
          <p className="text-center py-16 text-[14px]" style={{ color: WT.ink4 }}>해당 기간 거래내역이 없어요.</p>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid ' + WT.line }}>
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left" style={{ color: WT.ink3, background: WT.fill2, borderBottom: '1px solid ' + WT.line }}>
                  <th className="py-2.5 px-4 font-semibold">일자</th>
                  <th className="py-2.5 px-4 font-semibold">주문</th>
                  <th className="py-2.5 px-4 font-semibold">등급</th>
                  <th className="py-2.5 px-4 font-semibold">상태</th>
                  <th className="py-2.5 px-4 font-semibold text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ borderTop: '1px solid ' + WT.line }}>
                    <td className="py-2.5 px-4 tabular-nums" style={{ color: WT.ink2 }}>{safeDate(o.paid_at || o.created_at)?.toLocaleDateString('ko-KR') ?? '-'}</td>
                    <td className="py-2.5 px-4 tabular-nums" style={{ color: WT.ink2 }}>#{o.id}</td>
                    <td className="py-2.5 px-4" style={{ color: WT.ink2 }}>{o.grade || '-'}</td>
                    <td className="py-2.5 px-4" style={{ color: WT.ink2 }}>{STATUS_KO[o.status] || o.status}</td>
                    <td className="py-2.5 px-4 text-right font-bold tabular-nums" style={o.status === 'REFUNDED' ? { color: '#D63A4E', textDecoration: 'line-through' } : { color: WT.ink }}>{won(o.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  )

  // 대시보드 탭 임베드 — 외곽 래퍼/SEO/헤더 생략, 본문만.
  if (embedded) return <div>{content}</div>

  return (
    <div className="min-h-screen" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="거래내역서 - 유통스타트" description="판매사 도매 거래내역서" url="/wholesale/statement" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur print:hidden" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-medium flex items-center gap-3 px-5 lg:px-8 h-[52px]">
          <button onClick={goBack} aria-label="뒤로"><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          <h1 className="text-[15px] font-bold" style={{ color: WT.ink }}>거래내역서</h1>
          <button onClick={() => window.print()} className="ml-auto inline-flex items-center gap-1 text-[14px] font-medium" style={{ color: WT.ink2 }}><Printer className="w-4 h-4" /> 인쇄</button>
        </div>
      </header>

      <main className="ur-content-medium px-5 lg:px-8 py-6">
        {content}
      </main>
    </div>
  )
}
