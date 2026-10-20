/**
 * 🚨 **매장 제보 큐** — 어드민이 "이 매장 이상합니다" 를 받아 보는 자리.
 *
 * 되찾기 신청(`store-claims`)과 **다른 물건**이다. 저쪽은 "이 매장을 나에게 넘겨 달라"(주인 이전),
 * 이쪽은 "이 매장 이상합니다"(조치 요청)다. 제보자는 로그인조차 안 했을 수 있다.
 *
 * ## 여기서 환불·판매중지 버튼을 만들지 않는다
 * 환불은 **머니 경로(등급 C)** 라 신고 한 건으로 돈이 나가면 안 되고, 자동 판매중지는 악의적 제보
 * 한 건에 멀쩡한 매장을 마비시킨다. 이 화면은 **판단을 시작하게** 만들 뿐이고, 실제 조치는
 * 어드민이 기존 경로(상품 관리 · 환불)로 한다. [해결됨] 은 "조치했다" 는 **기록**이다.
 *
 * ⚠️ 어드민 대시보드라 `dark:` 를 쓰지 않는다(CLAUDE.md 절대 규칙).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatKST } from '@/utils/date'

const REASON_LABEL: Record<string, string> = {
  not_my_listing: '내 가게인데 내가 안 올림',
  wrong_info: '매장 정보가 사실과 다름',
  closed: '폐업·미영업',
  other: '그 밖의 문제',
}

interface ReportRow {
  id: number
  seller_id: number
  product_id: number | null
  store_name: string | null
  reporter_user_id: number | null
  reporter_contact: string
  reason: string
  detail: string | null
  created_at: string | null
}

export default function StoreReportQueue({ onPickStore }: { onPickStore?: (sellerId: number) => void }) {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [busy, setBusy] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/store-reports?status=open')
      setRows(res.data?.data?.reports || [])
    } catch { /* 목록이 안 뜨는 것으로 화면 전체를 막지 않는다 */ }
  }, [])

  useEffect(() => { void load() }, [load])

  async function decide(id: number, status: 'resolved' | 'dismissed') {
    const note = window.prompt(status === 'resolved' ? '어떻게 조치했나요? (기록용)' : '기각 사유 (기록용)') ?? ''
    setBusy(id)
    try {
      const res = await api.post(`/api/admin/store-reports/${id}/decide`, { status, note })
      if (res.data?.success) { toast.success('처리했습니다'); void load() }
      else toast.error(res.data?.error || '처리에 실패했습니다')
    } catch {
      toast.error('처리 중 오류가 발생했습니다')
    } finally {
      setBusy(0)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-gray-900">매장 제보</h2>
        <span className="text-[12px] text-gray-500">열린 제보 {rows.length}건</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-500 py-6 text-center">처리할 제보가 없습니다</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map(r => (
            <li key={r.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-gray-900">
                    {REASON_LABEL[r.reason] || r.reason}
                  </p>
                  <p className="text-[12px] text-gray-600 mt-0.5">
                    <button type="button" onClick={() => onPickStore?.(r.seller_id)} className="underline underline-offset-2">
                      {r.store_name || `매장 #${r.seller_id}`}
                    </button>
                    {' · '}연락처 {r.reporter_contact}
                    {!r.reporter_user_id && ' (비로그인)'}
                  </p>
                  {r.detail && <p className="text-[12px] text-gray-500 mt-1 whitespace-pre-wrap">{r.detail}</p>}
                  {r.created_at && <p className="text-[11px] text-gray-400 mt-1">{formatKST(r.created_at)}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button" disabled={busy === r.id} onClick={() => decide(r.id, 'resolved')}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-bold disabled:opacity-40"
                  >해결됨</button>
                  <button
                    type="button" disabled={busy === r.id} onClick={() => decide(r.id, 'dismissed')}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-[12px] font-bold disabled:opacity-40"
                  >기각</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
