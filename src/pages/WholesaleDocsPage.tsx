import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, FileText, Printer } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { useWholesaleDocuments, type WholesaleDocRow } from '@/hooks/queries/useWholesale'
import { WT, won, comma } from './wholesale/wholesale-theme'

// 🏭 2026-06-04 유통스타트 도매몰 — 유통사 자료(거래명세서/세금계산서) 조회·인쇄. 라이트 고정 B2B.
//   관리자가 발행(distributor-admin)한 sales 방향 문서를 본인 것만 조회. HTML 은 서버 IDOR 가드.

const DOC_LABEL: Record<string, string> = { tax_invoice: '세금계산서', transaction_statement: '거래명세서' }
const STATUS_LABEL: Record<string, { t: string; c: string; bg: string }> = {
  issued: { t: '발행완료', c: '#11875A', bg: '#EAF6EF' },
  draft: { t: '임시', c: '#9A6B00', bg: '#FFF6E6' },
  void: { t: '취소', c: '#D63A4E', bg: '#FDECEF' },
}

export default function WholesaleDocsPage() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const { data: docs = [], isLoading: loading } = useWholesaleDocuments()
  const [tab, setTab] = useState<'all' | 'tax_invoice' | 'transaction_statement'>('all')

  if (!token) return <Navigate to="/wholesale/intro" replace />

  const list = docs.filter((d) => tab === 'all' || d.doc_type === tab)

  function openDoc(d: WholesaleDocRow) {
    // 인증 헤더로 HTML 받아 새 창 렌더(직접 링크는 토큰 미첨부).
    fetch(`/api/wholesale/documents/${d.id}/html`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('문서 로드 실패'))))
      .then((html) => { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() } else toast.error('팝업이 차단되었어요') })
      .catch(() => toast.error('문서를 열 수 없습니다'))
  }

  const TABS: [typeof tab, string][] = [['all', '전체'], ['transaction_statement', '거래명세서'], ['tax_invoice', '세금계산서']]

  return (
    <div className="min-h-screen" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="발행 자료 - 유통스타트" description="유통사 거래명세서·세금계산서" url="/wholesale/documents" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-medium flex items-center gap-3 px-5 lg:px-8 h-[52px]">
          <button onClick={() => navigate('/wholesale')} aria-label="뒤로"><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          <h1 className="text-[15px] font-bold" style={{ color: WT.ink }}>발행 자료</h1>
        </div>
      </header>

      <main className="ur-content-medium px-5 lg:px-8 py-6">
        <p className="text-[13px] mb-4" style={{ color: WT.ink3 }}>유통스타트가 발행한 회원님의 거래명세서·세금계산서예요. 공급사 정보는 표기되지 않습니다.</p>

        <div className="flex gap-1.5 mb-4">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="rounded-full px-3.5 h-9 text-[13px] font-bold whitespace-nowrap"
              style={tab === k ? { background: WT.ink, color: '#fff' } : { background: WT.fill, color: WT.ink3 }}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin" style={{ color: WT.ink4 }} /></div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <FileText className="w-12 h-12 mb-4" style={{ color: WT.ink4 }} />
            <p className="text-[15px] font-medium mb-1" style={{ color: WT.ink2 }}>발행된 자료가 없어요</p>
            <p className="text-[13px]" style={{ color: WT.ink3 }}>월 거래가 집계되면 자료가 발행됩니다</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {list.map((d) => {
              const st = STATUS_LABEL[d.status] || { t: d.status, c: WT.ink2, bg: WT.fill }
              return (
                <div key={d.id} className="rounded-2xl bg-white p-4" style={{ border: '1px solid ' + WT.line }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold" style={{ color: WT.ink }}>{DOC_LABEL[d.doc_type] || d.doc_type}</span>
                      <span className="text-[12px] tabular-nums" style={{ color: WT.ink4 }}>{d.period_month}</span>
                    </div>
                    <span className="text-[12px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ color: st.c, background: st.bg }}>{st.t}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { k: '공급가액', v: won(d.supply_amount) },
                      { k: '부가세', v: won(d.vat_amount) },
                      { k: '합계', v: won(d.total_amount) },
                    ].map((m, i) => (
                      <div key={m.k} className={i ? 'pl-3' : ''} style={i ? { borderLeft: '1px solid ' + WT.line } : {}}>
                        <div className="text-[11px]" style={{ color: WT.ink3 }}>{m.k}</div>
                        <div className="text-[14px] font-extrabold mt-0.5 tabular-nums" style={{ color: i === 2 ? WT.ink : WT.ink2 }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] tabular-nums" style={{ color: WT.ink4 }}>
                      거래 {comma(d.order_count)}건{d.nts_confirm_num ? ' · 국세청 발행✓' : ''}
                    </span>
                    <button onClick={() => openDoc(d)} className="inline-flex items-center gap-1.5 rounded-xl px-3.5 h-9 text-[13px] font-bold" style={{ background: WT.fill, color: WT.ink }}>
                      <Printer className="w-4 h-4" /> 인쇄 / PDF
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
