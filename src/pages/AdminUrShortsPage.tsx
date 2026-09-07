import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Plus, Trash2, Eye, EyeOff, Link2, AlertCircle } from 'lucide-react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { parseYouTubeUrl, URSHORTS_RAIL_LIMIT } from '@/shared/urshorts'

/**
 * 🎬 `/admin/urshorts` — 유어쇼츠 관리 (2026-09-07).
 *
 * ## 여기서 사람이 하는 일은 하나다
 * **영상마다 어떤 이용권인지 고르는 것.** 이용권을 안 고른 영상은 목록에 빨갛게 남고
 * **홈에 안 나간다**(서버가 INNER JOIN 으로 강제한다) — 할 일이 눈에 보이게 두는 것이 요점이다.
 *
 * ## 쇼츠만 받는다
 * `youtube.com/shorts/...` 주소는 그 자체로 증명이라 비용 0 이고, `watch?v=` 는 서버가
 * 길이를 확인한다(1 unit). 여기서는 **붙여 넣는 순간 모양을 먼저 알려 준다** —
 * 서버까지 갔다가 거부당하는 것보다 낫다.
 */
interface Row {
  id: number
  video_id: string
  title: string | null
  channel: string | null
  thumb_url: string | null
  product_id: number | null
  product_name: string | null
  store_name: string | null
  price: number | null
  is_active: number
  source: string
  sort_order: number
  duration_sec: number | null
}

export default function AdminUrShortsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [channel, setChannel] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/urshorts')
      const d = r.data as { success?: boolean; data?: Row[]; channel_url?: string }
      if (d?.success) { setRows(d.data ?? []); setChannel(d.channel_url ?? '') }
    } catch {
      setMsg({ kind: 'bad', text: '목록을 불러오지 못했습니다' })
    }
  }, [])
  useEffect(() => { void load() }, [load])

  /** 붙여 넣는 즉시 알려 준다 — 서버까지 갔다 거부당하는 왕복을 줄인다. */
  const hint = useMemo(() => {
    if (!url.trim()) return null
    const p = parseYouTubeUrl(url)
    if (!p) return { kind: 'bad' as const, text: '유튜브 주소가 아닙니다' }
    if (p.form === 'shorts') return { kind: 'ok' as const, text: '쇼츠 주소입니다' }
    return { kind: 'warn' as const, text: '쇼츠인지 서버에서 길이를 확인합니다 (3분 이하만)' }
  }, [url])

  const add = async () => {
    if (busy || !url.trim()) return
    setBusy(true); setMsg(null)
    try {
      await api.post('/api/admin/urshorts', { url })
      setUrl(''); await load()
      setMsg({ kind: 'ok', text: '추가했습니다. 이용권을 골라야 홈에 나갑니다' })
    } catch (e) {
      const detail = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setMsg({ kind: 'bad', text: detail || '추가하지 못했습니다' })
    } finally { setBusy(false) }
  }

  const patch = async (id: number, body: Record<string, unknown>) => {
    try { await api.patch(`/api/admin/urshorts/${id}`, body); await load() }
    catch { setMsg({ kind: 'bad', text: '수정하지 못했습니다' }) }
  }

  const remove = async (r: Row) => {
    const ok = await confirmDialog({
      title: '이 영상을 지울까요?',
      message: r.title || r.video_id,
      confirmText: '삭제', danger: true,
    })
    if (!ok) return
    try { await api.delete(`/api/admin/urshorts/${r.id}`); await load() }
    catch { setMsg({ kind: 'bad', text: '삭제하지 못했습니다' }) }
  }

  const saveChannel = async () => {
    try {
      await api.put('/api/admin/urshorts/channel', { url: channel })
      setMsg({ kind: 'ok', text: '채널 주소를 저장했습니다' })
    } catch { setMsg({ kind: 'bad', text: '저장하지 못했습니다' }) }
  }

  const live = rows.filter((r) => r.is_active && r.product_id).length
  const orphan = rows.filter((r) => !r.product_id).length

  return (
    <AdminLayout title="유어쇼츠">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="유어쇼츠"
          subtitle="영상마다 이용권을 고르면 홈에 나갑니다. 홈 레일에는 최신 12편까지."
        />

        {msg && (
          <div className={`rounded-lg px-4 py-3 text-sm ${
            msg.kind === 'ok' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
          </div>
        )}

        <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-1 text-[14px] font-bold text-gray-900">채널</div>
          <p className="mb-3 text-[12.5px] text-gray-500">
            채널을 적어 두면 나중에 새 영상을 자동으로 받아올 수 있습니다. 지금은 기록용입니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={channel} onChange={(e) => setChannel(e.target.value)}
              placeholder="https://www.youtube.com/@urdeal"
              className="min-w-[240px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-900"
            />
            <button onClick={saveChannel}
              className="rounded-lg bg-gray-100 px-4 py-2 text-[13px] font-semibold text-gray-700">
              저장
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-1 text-[14px] font-bold text-gray-900">영상 추가</div>
          <p className="mb-3 text-[12.5px] text-gray-500">
            쇼츠 주소를 붙여 넣으세요. 제목·채널·썸네일은 유튜브에서 자동으로 채워집니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
              placeholder="https://www.youtube.com/shorts/..."
              className="min-w-[240px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-900"
            />
            <button onClick={() => void add()} disabled={busy || !url.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
              <Plus size={15} /> 추가
            </button>
          </div>
          {hint && (
            <p className={`mt-2 text-[12px] ${
              hint.kind === 'ok' ? 'text-blue-600' : hint.kind === 'warn' ? 'text-amber-600' : 'text-red-600'}`}>
              {hint.text}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
            <div className="text-[14px] font-bold text-gray-900">
              영상 {rows.length}편
              <span className="ml-2 text-[12.5px] font-normal text-gray-500">
                홈에 나가는 것 {Math.min(live, URSHORTS_RAIL_LIMIT)}편
              </span>
            </div>
            {orphan > 0 && (
              <span className="flex items-center gap-1 text-[12.5px] font-semibold text-red-600">
                <AlertCircle size={14} /> 이용권을 안 고른 영상 {orphan}편
              </span>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-gray-500">아직 등록한 영상이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <img
                    src={cfImage(r.thumb_url, { width: 120 })} alt=""
                    width={40} height={71}
                    className="h-[71px] w-10 shrink-0 rounded-md bg-gray-100 object-cover"
                    onError={(e) => cfImageOnError(e.currentTarget, r.thumb_url)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-gray-900">
                      {r.title || r.video_id}
                    </div>
                    <div className="truncate text-[11.5px] text-gray-500">
                      {r.channel || '채널 미상'}
                      {r.duration_sec ? ` · ${r.duration_sec}초` : ''}
                      {r.source === 'channel' ? ' · 채널' : ' · 직접'}
                    </div>
                  </div>

                  {/* 🔴 이용권 연결이 이 화면의 전부다. 안 고른 것은 빨갛게 남아 할 일이 보인다. */}
                  <div className="w-[190px] shrink-0">
                    {r.product_id ? (
                      <span className="flex items-center gap-1.5 truncate rounded-lg bg-blue-50 px-2.5 py-1.5 text-[12px] text-gray-900">
                        <Link2 size={12} className="shrink-0 text-blue-600" />
                        <span className="truncate">{r.store_name || r.product_name}</span>
                        {r.price != null && (
                          <span className="shrink-0 text-gray-500">{formatNumber(r.price)}원</span>
                        )}
                      </span>
                    ) : (
                      <span className="block rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] font-semibold text-red-600">
                        이용권을 고르세요
                      </span>
                    )}
                  </div>

                  <input
                    type="number" defaultValue={r.product_id ?? ''} placeholder="상품 ID"
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      const next = v === '' ? null : Number(v)
                      if (next !== (r.product_id ?? null)) void patch(r.id, { product_id: next })
                    }}
                    className="w-[86px] shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-[12px] text-gray-900"
                  />

                  <button
                    onClick={() => void patch(r.id, { is_active: !r.is_active })}
                    title={r.is_active ? '끄기' : '켜기'}
                    className="shrink-0 rounded-lg bg-gray-100 p-2 text-gray-600"
                  >
                    {r.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button onClick={() => void remove(r)} className="shrink-0 rounded-lg bg-gray-100 p-2 text-gray-600">
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
