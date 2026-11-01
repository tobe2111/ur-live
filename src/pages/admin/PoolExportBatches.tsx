import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatKST } from '@/utils/date'

/**
 * 🔓 **내보낸 묶음 되돌리기** — 세 풀 공용 패널(2026-10-25).
 *
 * "받은 건 다시 안 준다" 의 짝이다. 다운로드가 끊기거나 파일을 잃으면 그 500건이 목록에서
 * 사라지는데(서버는 전송 완료를 알 수 없다), 여기가 **유일한 복구 경로**다.
 *
 * 배치 id = 도장 시각 그 자체 — 별도 표가 없는 이유는 `pool-export-batch.ts` 머리말에 있다.
 * ⚠️ 어떤 필터로 받았는지는 기록되지 않는다(행수와 시각만).
 */
export default function PoolExportBatches({ pool }: { pool: 'influencer' | 'company' | 'store' }) {
  const [batches, setBatches] = useState<{ stamp: string; rows: number }[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')

  async function load() {
    try {
      const r = await api.get(`/api/admin/pool-export-batches?pool=${pool}`)
      setBatches(r.data?.batches || [])
    } catch { setBatches([]); toast.error('내보낸 묶음 조회 실패 — 재로그인 후 시도') }
  }
  useEffect(() => { if (open && batches === null) void load() }, [open])

  async function cancel(stamp: string, rows: number) {
    if (!confirm(`${rows}건의 "내보냄" 표시를 지웁니다.\n이 묶음은 다시 다운로드 대상이 됩니다.`)) return
    setBusy(stamp)
    try {
      const r = await api.post('/api/admin/pool-export-batches/cancel', { pool, stamp })
      const n = Number(r.data?.restored) || 0
      // 0 이면 조용히 성공으로 보이지 않게 — 그 도장이 이미 없었다는 뜻이다.
      if (n > 0) toast.success(`${n}건을 목록으로 되돌렸습니다`)
      else toast.error('되돌릴 행이 없습니다 — 이미 취소된 묶음입니다')
      await load()
    } catch { toast.error('취소 실패 — 재로그인 후 시도') } finally { setBusy('') }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg border border-rule bg-white text-gray-600 text-sm"
        title="내보낸 묶음 목록 — 다운로드가 끊겼거나 파일을 잃었으면 여기서 되돌립니다">
        내보낸 묶음
      </button>
    )
  }

  return (
    <div className="w-full mt-3 rounded-xl bg-white shadow-lift p-4">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-gray-900">내보낸 묶음</p>
        <button onClick={() => setOpen(false)} className="text-[13px] text-gray-500">닫기</button>
      </div>
      <p className="mt-1 text-[13px] text-gray-500">
        받은 묶음은 다음 다운로드에서 빠집니다. 다운로드가 끊겼거나 파일을 잃었으면 되돌리세요.
      </p>
      {batches === null ? <p className="mt-4 text-[13px] text-gray-500">불러오는 중…</p>
        : batches.length === 0 ? <p className="mt-4 text-[13px] text-gray-500">아직 내보낸 묶음이 없습니다.</p>
        : (
          <ul className="mt-3 divide-y divide-rule">
            {batches.map(b => (
              <li key={b.stamp} className="flex items-center justify-between py-3">
                <span className="text-[13px] text-gray-900">
                  {formatKST(b.stamp)} · <span className="font-medium">{b.rows.toLocaleString()}건</span>
                </span>
                <button onClick={() => cancel(b.stamp, b.rows)} disabled={busy === b.stamp}
                  className="px-3 py-1.5 rounded-lg border border-rule bg-white text-[13px] text-gray-600 disabled:opacity-40">
                  {busy === b.stamp ? '되돌리는 중…' : '되돌리기'}
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
