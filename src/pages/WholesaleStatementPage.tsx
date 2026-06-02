import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { formatWon } from '@/utils/format'
import { useWholesaleStatement } from '@/hooks/queries/useWholesale'

// 🏭 2026-06-01 유통스타트 — 거래내역서 (유통사 매입 내역, 인쇄 가능) Phase 4.

const STATUS_KO: Record<string, string> = { PAID: '결제완료', SHIPPED: '발송완료', REFUNDED: '환불' }

export default function WholesaleStatementPage() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)
  // 🛡️ 2026-06-01 Tier2: 수동 load → React Query. '조회' 버튼이 q 를 commit (날짜 입력 중 재요청 방지).
  const [q, setQ] = useState({ from: monthAgo, to: today })
  const { data, isLoading: loading } = useWholesaleStatement(q.from, q.to)
  const orders = data?.orders ?? []
  const summary = data?.summary ?? null
  const load = () => setQ({ from, to })

  useEffect(() => {
    if (!token) navigate('/seller/login')
  }, [token, navigate])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      <SEO title="거래내역서 - 유통스타트" description="유통사 도매 거래내역서" url="/wholesale/statement" noindex />
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#121212]/95 backdrop-blur border-b border-gray-100 dark:border-[#2A2A2A] print:hidden">
        <div className="ur-content-medium flex items-center gap-3 px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate('/wholesale')} aria-label="뒤로"><ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" /></button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">거래내역서</h1>
          <button onClick={() => window.print()} className="ml-auto inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <Printer className="w-4 h-4" /> 인쇄
          </button>
        </div>
      </header>

      <main className="ur-content-medium px-4 lg:px-8 py-6">
        <div className="flex flex-wrap items-end gap-3 mb-5 print:hidden">
          <label className="text-sm text-gray-600 dark:text-gray-300">시작
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="ml-2 px-2 py-1.5 border border-gray-200 dark:border-[#2A2A2A] rounded-lg bg-white dark:bg-[#121212] text-gray-900 dark:text-white" />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">종료
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="ml-2 px-2 py-1.5 border border-gray-200 dark:border-[#2A2A2A] rounded-lg bg-white dark:bg-[#121212] text-gray-900 dark:text-white" />
          </label>
          <button onClick={load} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-semibold">조회</button>
        </div>

        {summary && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-4">
              <div className="text-xs text-gray-400 dark:text-gray-500">건수</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{summary.count}건</div>
            </div>
            <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-4">
              <div className="text-xs text-gray-400 dark:text-gray-500">매입 합계</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatWon(summary.total_paid)}</div>
            </div>
            <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-4">
              <div className="text-xs text-gray-400 dark:text-gray-500">순매입 (환불 차감)</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatWon(summary.net)}</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 py-16">해당 기간 거래내역이 없습니다.</p>
        ) : (
          <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-[#1A1A1A] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#1A1A1A]">
                  <th className="py-2.5 px-4 font-medium">일자</th>
                  <th className="py-2.5 px-4 font-medium">주문</th>
                  <th className="py-2.5 px-4 font-medium">등급</th>
                  <th className="py-2.5 px-4 font-medium">상태</th>
                  <th className="py-2.5 px-4 font-medium text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-50 dark:border-[#161616]">
                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-300">{new Date(o.paid_at || o.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-300">#{o.id}</td>
                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-300">{o.grade || '-'}</td>
                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-300">{STATUS_KO[o.status] || o.status}</td>
                    <td className={`py-2.5 px-4 text-right font-medium ${o.status === 'REFUNDED' ? 'text-rose-500 line-through' : 'text-gray-900 dark:text-white'}`}>{formatWon(o.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
