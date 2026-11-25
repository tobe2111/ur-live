/**
 * 🧾 월 회계 마감 — 세무사용 CSV 내려받기 (2026-11-25 대표 *"최대한 자동화하자 지급대행 안쓰는 선에서"*)
 *
 * 서버 `GET /api/admin/tax/monthly-accounting?month=YYYY-MM` (집계 SSOT `worker/utils/monthly-accounting.ts`).
 * 매월 1일 04시(KST)에 같은 숫자로 요약 알림이 자동으로 온다 — 이 카드는 그 CSV 를 받는 자리다.
 */
import { useState } from 'react'
import { toast } from '@/hooks/useToast'

const lastMonth = () => {
  const k = new Date(Date.now() + 9 * 3600_000)
  k.setUTCDate(1)
  k.setUTCMonth(k.getUTCMonth() - 1)
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function MonthlyAccountingCard() {
  const [month, setMonth] = useState(lastMonth())
  const [busy, setBusy] = useState(false)
  async function download() {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { toast.error('YYYY-MM 형식으로 입력하세요'); return }
    setBusy(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tax/monthly-accounting?month=${month}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { toast.error(`다운로드 실패 (${res.status})`); return }
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `urdeal-accounting-${month}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success('CSV 다운로드 완료')
    } catch {
      toast.error('다운로드 실패')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl mb-4" data-testid="monthly-accounting-card">
      <h2 className="text-sm font-bold text-gray-900 mb-2">월 회계 마감 (세무사용)</h2>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        • 매출·수수료 수익·환불·정산 지급·원천징수를 한 파일로<br />
        • 매월 1일 04시에 지난달 요약이 알림으로 자동 도착 — 원천세 신고·납부는 다음 달 10일까지<br />
        • 그 CSV 를 세무사에게 그대로 넘기면 됩니다
      </p>
      <div className="flex gap-2">
        <input
          type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
        />
        <button type="button" disabled={busy} onClick={() => { void download() }}
          className="ur-btn ur-btn-sm ur-btn-primary rounded-lg px-4 text-xs disabled:opacity-40">
          CSV 받기
        </button>
      </div>
    </div>
  )
}
