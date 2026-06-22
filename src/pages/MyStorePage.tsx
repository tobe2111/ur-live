/**
 * 🏪 2026-06-22 (대표 — "셀러 대시보드는 무거움, 앱에서 바로"): 사업자 유저용 경량 "내 매장" 화면.
 *   매장 공구권 원장(사용/정산 대기·완료) + "안 왔어요" 분쟁 신고. 풀 셀러 대시보드(/seller) 대신 앱 내.
 *   API: GET /api/group-buy/store-voucher-ledger · GET /api/voucher-dispute/mine · POST /api/voucher-dispute/report
 *   소비자 앱 테마(화이트/다크 토글) — dark: variant 필수.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, AlertCircle, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface Summary {
  total: number; unused: number; used: number; used_amount: number
  pending_settlement: number; pending_amount: number; settled: number; refunded: number
}
interface LedgerItem {
  id: number; status: string; applied_price: number; settlement_id: number | null
  product_name?: string; restaurant_name?: string
}

const STAT = (label: string, value: string, sub?: string) => ({ label, value, sub })

export default function MyStorePage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [recent, setRecent] = useState<LedgerItem[]>([])
  const [disputedIds, setDisputedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ledger, mine] = await Promise.all([
        api.get('/api/group-buy/store-voucher-ledger'),
        api.get('/api/voucher-dispute/mine').catch(() => ({ data: { data: [] } })),
      ])
      if (ledger.data?.success === false) { setForbidden(true); return }
      setSummary(ledger.data?.data?.summary || null)
      setRecent(ledger.data?.data?.recent || [])
      const open = new Set<number>((mine.data?.data || []).filter((d: { status: string }) => d.status === 'open').map((d: { voucher_id: number }) => d.voucher_id))
      setDisputedIds(open)
    } catch (e) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 403) setForbidden(true)
      else toast.error('내 매장 정보를 불러오지 못했어요')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function report(v: LedgerItem) {
    if (!(await confirmDialog({ message: `이 공구권을 "고객이 방문하지 않았다"고 신고할까요?\n신고 시 해당 건의 정산이 보류되고 운영자가 확인합니다.`, danger: true }))) return
    setBusy(v.id)
    try {
      await api.post('/api/voucher-dispute/report', { voucherId: v.id })
      toast.success('신고 접수 — 정산 보류 후 운영자가 확인합니다')
      setDisputedIds(prev => new Set(prev).add(v.id))
    } catch {
      toast.error('신고할 수 없는 건입니다 (정산 전 사용건만)')
    } finally { setBusy(null) }
  }

  if (forbidden) {
    return (
      <div className="bg-white dark:bg-[#020202] min-h-screen flex flex-col items-center justify-center px-8 text-center">
        <SEO title="내 매장 — 유어딜" description="사업자 유저 매장 관리" url="/my-store" noindex />
        <Store className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-900 dark:text-white font-bold">사업자 유저 전용</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">사업자 등록·판매 승인 후 이용할 수 있어요.</p>
        <button onClick={() => navigate('/seller/register/business')} className="mt-5 px-5 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold">사업자로 시작하기</button>
      </div>
    )
  }

  const stats = summary ? [
    STAT('정산 대기', `${formatNumber(summary.pending_settlement)}건`, `${formatNumber(summary.pending_amount)}원`),
    STAT('정산 완료', `${formatNumber(summary.settled)}건`),
    STAT('총 사용', `${formatNumber(summary.used)}건`, `${formatNumber(summary.used_amount)}원`),
    STAT('미사용', `${formatNumber(summary.unused)}건`),
  ] : []

  return (
    <div className="bg-white dark:bg-[#020202] min-h-screen pb-8">
      <SEO title="내 매장 — 유어딜" description="내 매장 공구권 사용·정산 현황" url="/my-store" noindex />
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020202]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#1A1A1A] px-4 h-12 flex items-center">
        <Store className="w-5 h-5 text-gray-900 dark:text-white mr-2" />
        <h1 className="text-[16px] font-extrabold text-gray-900 dark:text-white">내 매장</h1>
      </div>

      <div className="ur-content-medium px-4 lg:px-8 pt-4">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">불러오는 중…</div>
        ) : (
          <>
            {/* 요약 */}
            <div className="grid grid-cols-2 gap-2.5">
              {stats.map(s => (
                <div key={s.label} className="rounded-2xl border border-gray-100 dark:border-[#1A1A1A] bg-white dark:bg-[#121212] p-3.5">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className="text-[18px] font-extrabold text-gray-900 dark:text-white mt-0.5">{s.value}</p>
                  {s.sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 px-1">정산은 사용 후 7일 뒤 자동 진행돼요. 고객이 방문하지 않은 건은 아래에서 신고하면 정산이 보류됩니다.</p>

            {/* 최근 공구권 */}
            <p className="text-[13px] font-bold text-gray-900 dark:text-white mt-6 mb-2 px-1">최근 공구권</p>
            {recent.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">아직 발급된 공구권이 없어요</p>
            ) : (
              <div className="space-y-2">
                {recent.map(v => {
                  const disputed = disputedIds.has(v.id)
                  const canReport = v.status === 'used' && v.settlement_id == null && !disputed
                  return (
                    <div key={v.id} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-[#1A1A1A] bg-white dark:bg-[#121212] px-3.5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{v.restaurant_name || v.product_name || `공구권 #${v.id}`}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                          #{v.id} · {formatNumber(v.applied_price)}원 · {
                            v.status === 'unused' ? '미사용'
                            : v.status === 'used' ? (v.settlement_id != null ? '정산 완료' : disputed ? '신고됨(보류)' : '정산 대기')
                            : v.status === 'refunded' ? '환불' : v.status
                          }
                        </p>
                      </div>
                      {disputed ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0"><AlertCircle className="w-3.5 h-3.5" />신고됨</span>
                      ) : v.status === 'used' && v.settlement_id != null ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" />정산완료</span>
                      ) : canReport ? (
                        <button onClick={() => report(v)} disabled={busy === v.id} className="shrink-0 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-300 text-[12px] font-bold disabled:opacity-50">안 왔어요</button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
