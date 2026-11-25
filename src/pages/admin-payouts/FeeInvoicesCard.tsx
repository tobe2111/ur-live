/**
 * 🧾 매장 수수료 세금계산서(정발행) · 분기 판매대행 명세 (2026-11-25)
 *
 * 서버 `GET/POST /api/admin/tax/fee-invoices*` · `GET /api/admin/tax/sales-agency-report` (집계 SSOT
 * `worker/utils/fee-tax-invoice.ts` · `sales-agency-report.ts`). 매월 1일 초안이 자동으로 만들어진다 —
 * 발행 사업자 연동 전에는 CSV 를 받아 홈택스에서 발행하고 여기서 "발행 완료" 를 누른다.
 * 어드민 대시보드 = 라이트 고정(dark: 금지).
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { promptDialog } from '@/components/ui/confirm-dialog'
import { formatNumber } from '@/utils/format'

interface Row { id: number; seller_id: number; buyer_name: string | null; buyer_biz_no: string | null; supply_amount: number; vat_amount: number; status: string; nts_confirm_num: string | null }
interface Data { period: string; dueDate: string; invoices: Row[]; totals: { count: number; issued: number; supply: number; vat: number } }

const lastMonth = () => {
  const k = new Date(Date.now() + 9 * 3600_000)
  k.setUTCDate(1)
  k.setUTCMonth(k.getUTCMonth() - 1)
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`
}
const lastQuarter = () => {
  const k = new Date(Date.now() + 9 * 3600_000)
  let y = k.getUTCFullYear(), q = Math.floor(k.getUTCMonth() / 3)
  if (q === 0) { y -= 1; q = 4 }
  return `${y}-Q${q}`
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = { success?: boolean; error?: string; data?: any }
const readJson = async (res: Response | null): Promise<Api | null> => (res ? ((await res.json().catch(() => null)) as Api | null) : null)
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` })

async function download(url: string, name: string) {
  const res = await fetch(url, { headers: auth() })
  if (!res.ok) { toast.error(`다운로드 실패 (${res.status})`); return }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(await res.blob())
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function FeeInvoicesCard() {
  const [period, setPeriod] = useState(lastMonth())
  const [quarter, setQuarter] = useState(lastQuarter())
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return
    const res = await fetch(`/api/admin/tax/fee-invoices?period=${period}`, { headers: auth() }).catch(() => null)
    const j = await readJson(res)
    setData(j?.success ? j.data : null)
  }, [period])
  useEffect(() => { void load() }, [load])

  async function build() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/tax/fee-invoices/build', { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ period }) })
      const j = await readJson(res)
      if (!j?.success) { toast.error(j?.error || '초안을 만들지 못했어요'); return }
      toast.success(`초안 ${j.data.drafts}장${j.data.missingBizNo ? ` · 사업자번호 없는 매장 ${j.data.missingBizNo}곳` : ''}`)
      await load()
    } finally { setBusy(false) }
  }

  async function markIssued(r: Row) {
    const num = await promptDialog({
      title: '발행 완료 기록',
      message: `${r.buyer_name || `매장 #${r.seller_id}`} — 홈택스에서 발행했으면 국세청 승인번호를 적어 주세요(비워도 됩니다)`,
      confirmText: '발행 완료',
      prompt: { placeholder: '국세청 승인번호(선택)' },
    })
    if (num === null) return
    const res = await fetch(`/api/admin/tax/fee-invoices/${r.id}/issued`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ nts_confirm_num: num }) })
    const j = await readJson(res)
    if (!j?.success) { toast.error(j?.error || '처리하지 못했어요'); return }
    toast.success('발행 완료로 기록했어요')
    await load()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl mb-4" data-testid="fee-invoices-card">
      <h2 className="text-sm font-bold text-gray-900 mb-2">매장 수수료 세금계산서 (정발행)</h2>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        • 매월 1일 지난달 이용권 사용분 수수료로 매장별 초안이 자동으로 만들어집니다(작성일 = 말일)<br />
        • 발행 기한은 다음 달 10일 — 지금은 CSV 를 받아 홈택스에서 발행한 뒤 [발행 완료]를 누릅니다<br />
        • 매장 승인은 필요 없습니다(정발행)
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
        <button type="button" disabled={busy} onClick={() => { void build() }} className="ur-btn ur-btn-sm rounded-lg px-4 text-xs border border-gray-200 text-gray-700 disabled:opacity-40">초안 다시 만들기</button>
        <button type="button" onClick={() => { void download(`/api/admin/tax/fee-invoices/csv?period=${period}`, `urdeal-fee-invoices-${period}.csv`) }} className="ur-btn ur-btn-sm ur-btn-primary rounded-lg px-4 text-xs">홈택스용 CSV</button>
      </div>
      {data && (
        <>
          <p className="text-xs text-gray-600 mb-2">
            {data.totals.count}장 · 발행 완료 {data.totals.issued}장 · 공급가액 {formatNumber(data.totals.supply)}원 · 세액 {formatNumber(data.totals.vat)}원 · 기한 {data.dueDate}
          </p>
          {data.invoices.length === 0 ? (
            <p className="text-xs text-gray-400">이 달에는 발행할 수수료가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-xs">
              {data.invoices.map(r => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-gray-900">{r.buyer_name || `매장 #${r.seller_id}`} <span className="text-gray-400">{r.buyer_biz_no || '사업자번호 없음'}</span></span>
                  <span className="tabular-nums text-gray-700">{formatNumber(r.supply_amount)} + {formatNumber(r.vat_amount)}원</span>
                  {r.status === 'issued'
                    ? <span className="text-gray-400">발행 완료{r.nts_confirm_num ? ` · ${r.nts_confirm_num}` : ''}</span>
                    : <button type="button" onClick={() => { void markIssued(r) }} className="ur-btn ur-btn-sm rounded-lg px-3 text-xs border border-gray-200 text-gray-700">발행 완료</button>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="mt-5 border-t border-gray-100 pt-4">
        <h3 className="text-xs font-bold text-gray-900 mb-1">분기 판매·결제대행 명세 (국세청 제출)</h3>
        <p className="text-xs text-gray-500 mb-2">매장별·월별 결제금액 집계. 분기 다음 달 15일까지 제출 — 제출 형식은 세무사와 확인</p>
        <div className="flex gap-2">
          <input value={quarter} onChange={e => setQuarter(e.target.value)} placeholder="2026-Q4" className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
          <button type="button" onClick={() => { if (!/^\d{4}-Q[1-4]$/.test(quarter)) { toast.error('YYYY-Qn 형식으로 입력하세요'); return } void download(`/api/admin/tax/sales-agency-report?quarter=${quarter}`, `urdeal-sales-agency-${quarter}.csv`) }} className="ur-btn ur-btn-sm ur-btn-primary rounded-lg px-4 text-xs">CSV 받기</button>
        </div>
      </div>
    </div>
  )
}
