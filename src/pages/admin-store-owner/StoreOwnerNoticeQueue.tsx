/**
 * 📩 **사장님 통보 큐** — "당신 가게가 유어딜에 올라갔습니다" 를 보낼 줄.
 *
 * > 대표: *"매장 사장님의 전화번호. 010으로 말이야. 되면 보내주는걸로."*
 *
 * ## 🔴 발송은 자동이 아니다
 * 줄은 승인 순간 자동으로 서지만 **보내는 것은 사람이 누른다.** 발송은 등급 C(발행/발송)이고,
 * 무엇보다 **새 카카오 템플릿은 외부 검수**를 거쳐야 한다 — 그 전엔 이 버튼이 막혀 있다.
 * 왜 막혔는지를 화면이 말해 준다(템플릿 미등록인지, 설정이 꺼져 있는지).
 *
 * ## 010 만 여기 온다
 * 지역번호·대표번호·번호 없음은 알림톡이 안 가므로 **"매장 확인 통화" 큐**가 맡는다.
 * 두 레일이 같은 매장을 두 번 붙들지 않게 갈라 둔 것이다.
 *
 * ⚠️ 어드민 대시보드라 `dark:` 를 쓰지 않는다(CLAUDE.md 절대 규칙).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatKST } from '@/utils/date'

interface NoticeRow {
  id: number
  seller_id: number
  phone: string
  status: string
  error_msg: string | null
  created_at: string | null
}

export default function StoreOwnerNoticeQueue({ onPickStore }: { onPickStore?: (sellerId: number) => void }) {
  const [rows, setRows] = useState<NoticeRow[]>([])
  const [sendEnabled, setSendEnabled] = useState(false)
  const [templateReady, setTemplateReady] = useState(false)
  const [sample, setSample] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/store-owner-notices?status=queued')
      const d = res.data?.data
      setRows(d?.notices || [])
      setSendEnabled(!!d?.send_enabled)
      setTemplateReady(!!d?.template_ready)
      setSample(d?.sample_message || '')
    } catch { /* 목록이 안 뜨는 것으로 화면 전체를 막지 않는다 */ }
  }, [])

  useEffect(() => { void load() }, [load])

  async function send() {
    setBusy(true)
    try {
      const res = await api.post('/api/admin/store-owner-notices/send')
      if (res.data?.success) {
        const { sent = 0, failed = 0 } = res.data.data || {}
        toast.success(`${sent}건 발송${failed ? ` · ${failed}건 실패` : ''}`)
        void load()
      } else {
        toast.error(res.data?.error || '발송에 실패했습니다')
      }
    } catch {
      toast.error('발송 중 오류가 발생했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-gray-900">사장님 통보</h2>
        <span className="text-[12px] text-gray-500">보낼 곳 {rows.length}곳</span>
      </div>

      {!sendEnabled && (
        <p className="text-[12px] text-gray-600 mb-3 leading-relaxed">
          {templateReady
            ? '발송이 꺼져 있습니다. platform_settings 의 store_owner_notice_enabled 를 true 로 두면 켜집니다.'
            : '카카오 알림톡 템플릿 검수가 끝나기 전까지는 보낼 수 없습니다. 줄은 그대로 남아 있습니다.'}
        </p>
      )}

      {sample && (
        <details className="mb-3">
          <summary className="text-[12px] text-gray-500 cursor-pointer">보낼 문구 보기</summary>
          <pre className="mt-2 p-2.5 rounded-lg bg-gray-50 text-[12px] text-gray-700 whitespace-pre-wrap">{sample}</pre>
        </details>
      )}

      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-500 py-6 text-center">보낼 통보가 없습니다</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 mb-3">
            {rows.map(r => (
              <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <button type="button" onClick={() => onPickStore?.(r.seller_id)} className="text-[13px] font-bold text-gray-900 underline underline-offset-2">
                    매장 #{r.seller_id}
                  </button>
                  <p className="text-[12px] text-gray-600 mt-0.5">{r.phone}</p>
                </div>
                {r.created_at && <span className="text-[11px] text-gray-400 shrink-0">{formatKST(r.created_at)}</span>}
              </li>
            ))}
          </ul>
          <button
            type="button" disabled={!sendEnabled || busy} onClick={send}
            className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-[13px] font-bold disabled:opacity-40"
          >{busy ? '보내는 중…' : `${rows.length}곳에 보내기`}</button>
        </>
      )}
    </section>
  )
}
