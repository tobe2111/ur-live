/**
 * ☎️ **매장 확인 통화 큐** — 승인은 났는데 아직 사람이 전화를 안 걸어 본 매장.
 *
 * ## 왜 승인 도장으로 충분하지 않은가
 * 서류는 위조되거나, 남의 것일 수 있다. 가장 싸고 확실한 확인은 **가게로 전화를 거는 것**이다.
 * 그런데 그 통화가 **어디에도 안 남아** 있었다 — 걸었는지, 누가 걸었는지, 뭐라 했는지.
 * 분쟁이 나면 "확인했습니다" 라는 말만 남는다. 이 화면이 그 말을 기록으로 바꾼다.
 *
 * ## 🔴 여기엔 정지·환불 버튼이 없다 (의도)
 * "본인이 아니라고 함" 을 눌러도 매장은 **꺼지지 않는다.** 오귀속 한 건에 멀쩡한 가게가
 * 마비되면 안 되고, 환불은 머니 경로(등급 C)다. 그 판단은 어드민이 기존 경로로 한다 —
 * 여기는 *그 판단에 필요한 사실*을 남길 뿐이다. (`store-verify.ts` 가 같은 경계를 잠근다.)
 *
 * ## 📵 "직접 걸어야 함" 배지
 * 번호가 **010 이 아니면**(지역번호·대표번호·없음) 알림톡으로 대신할 수 없어 사람이 걸어야 한다.
 * ⚠️ 010 이라고 안전한 게 아니다 — 사기꾼은 자기 휴대폰을 적으면 그만이다. 그 배지는
 * *연락 수단의 종류*이지 신뢰도가 아니다.
 *
 * ⚠️ 어드민 대시보드라 `dark:` 를 쓰지 않는다(CLAUDE.md 절대 규칙).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatKST } from '@/utils/date'

const RESULT_LABEL: Record<string, string> = {
  confirmed: '본인 확인됨',
  denied: '본인이 아니라고 함',
  no_answer: '받지 않음',
  wrong_number: '없는 번호',
  no_phone: '번호 없음',
}

interface QueueRow {
  seller_id: number
  business_name: string | null
  phone: string | null
  status: string | null
  created_at: string | null
  needs_manual_call: boolean
  verified_call_at: string | null
  exposure_from: string | null
  last_result: string | null
  last_called_at: string | null
}

export default function StoreVerifyQueue({ onPickStore }: { onPickStore?: (sellerId: number) => void }) {
  const [rows, setRows] = useState<QueueRow[]>([])
  const [busy, setBusy] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/store-verify/queue')
      setRows(res.data?.data || [])
    } catch { /* 목록이 안 뜨는 것으로 화면 전체를 막지 않는다 */ }
  }, [])

  useEffect(() => { void load() }, [load])

  async function record(sellerId: number, result: string) {
    const note = window.prompt(`${RESULT_LABEL[result]} — 통화 내용 (기록용, 생략 가능)`) ?? ''
    setBusy(sellerId)
    try {
      const res = await api.post(`/api/admin/stores/${sellerId}/verify-call`, { result, note })
      if (res.data?.success) { toast.success('통화 기록을 저장했습니다'); void load() }
      else toast.error(res.data?.error || '저장에 실패했습니다')
    } catch {
      toast.error('저장 중 오류가 발생했습니다')
    } finally {
      setBusy(0)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-gray-900">매장 확인 통화</h2>
        <span className="text-[12px] text-gray-500">확인 안 된 매장 {rows.length}곳</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-500 py-6 text-center">확인이 필요한 매장이 없습니다</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map(r => (
            <li key={r.seller_id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-gray-900">
                    <button type="button" onClick={() => onPickStore?.(r.seller_id)} className="underline underline-offset-2">
                      {r.business_name || `매장 #${r.seller_id}`}
                    </button>
                    {r.exposure_from && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold align-middle">
                        노출 유예 중
                      </span>
                    )}
                    {r.needs_manual_call && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] font-bold align-middle">
                        직접 걸어야 함
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-gray-600 mt-0.5">
                    {r.phone || '번호 없음'}
                    {r.last_result && ` · 지난 통화 ${RESULT_LABEL[r.last_result] || r.last_result}`}
                    {r.last_called_at && ` (${formatKST(r.last_called_at)})`}
                  </p>
                  {r.exposure_from && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      {formatKST(r.exposure_from)}부터 메인 노출 — 확인되면 즉시 노출됩니다
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0 justify-end max-w-[200px]">
                  <button
                    type="button" disabled={busy === r.seller_id} onClick={() => record(r.seller_id, 'confirmed')}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-bold disabled:opacity-40"
                  >확인됨</button>
                  <button
                    type="button" disabled={busy === r.seller_id} onClick={() => record(r.seller_id, 'denied')}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-[12px] font-bold disabled:opacity-40"
                  >본인 아님</button>
                  <button
                    type="button" disabled={busy === r.seller_id} onClick={() => record(r.seller_id, 'no_answer')}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-[12px] font-bold disabled:opacity-40"
                  >부재</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
