/**
 * 📣 몰 공지(팝업/배너) 관리 패널 — 2026-08-09 과업①(상인회 SaaS) "관리자 팝업 생성 기능".
 *   MallSellersPanel 과 같은 자리(몰 행 아래 펼침). 어드민이 상인회 대신 작성 —
 *   운영자-대면 대시보드가 생기면 이 CRUD 를 그대로 위임한다(API 는 몰 스코프라 재사용 가능).
 *   렌더는 MallHomePage(팝업 = 1회 닫힘 모달 / 배너 = 상단 띠). 라이트 고정(대시보드 — dark: 없음).
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Notice {
  id: number; type: string; title: string; body: string | null; link_url: string | null
  active: number; starts_at: string | null; ends_at: string | null; created_at: string
}

const INPUT = 'w-full h-9 px-2.5 rounded-lg border border-gray-200 text-[13px] text-gray-900 outline-none focus:border-gray-400'

export default function MallNoticesPanel({ mallId }: { mallId: number }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ type: 'banner', title: '', body: '', link_url: '', starts_at: '', ends_at: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/api/admin/wholesale-malls/${mallId}/notices`)
      if (r.data?.success) setNotices(r.data.notices || [])
    } catch { toast.error('공지 목록을 불러오지 못했습니다') }
    finally { setLoading(false) }
  }, [mallId])
  useEffect(() => { void load() }, [load])

  async function create() {
    if (!f.title.trim()) { toast.error('제목을 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post(`/api/admin/wholesale-malls/${mallId}/notices`, {
        type: f.type, title: f.title.trim(), body: f.body.trim() || null, link_url: f.link_url.trim() || null,
        starts_at: f.starts_at || null, ends_at: f.ends_at || null,
      })
      if (r.data?.success) { toast.success('공지가 생성되었습니다'); setF({ type: 'banner', title: '', body: '', link_url: '', starts_at: '', ends_at: '' }); await load() }
      else toast.error(r.data?.error || '생성 실패')
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '생성 실패') }
    finally { setBusy(false) }
  }

  async function toggle(n: Notice) {
    await api.patch(`/api/admin/wholesale-malls/${mallId}/notices/${n.id}`, { active: n.active ? 0 : 1 }).catch(() => null)
    await load()
  }
  async function remove(n: Notice) {
    if (!window.confirm(`"${n.title}" 공지를 삭제할까요?`)) return
    await api.delete(`/api/admin/wholesale-malls/${mallId}/notices/${n.id}`).catch(() => null)
    await load()
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
      {/* 작성 폼 */}
      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <select value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))}
            className="h-9 px-2 rounded-lg border border-gray-200 text-[13px] text-gray-900 bg-white">
            <option value="banner">배너(상단 띠)</option>
            <option value="popup">팝업(모달)</option>
          </select>
          <input value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} maxLength={120}
            className={INPUT} placeholder="제목 — 예: 8월 둘째 주 픽업 안내" />
        </div>
        <input value={f.body} onChange={(e) => setF((p) => ({ ...p, body: e.target.value }))} maxLength={2000}
          className={INPUT} placeholder="내용(선택)" />
        <div className="grid grid-cols-3 gap-2">
          <input value={f.link_url} onChange={(e) => setF((p) => ({ ...p, link_url: e.target.value }))} maxLength={500}
            className={INPUT} placeholder="링크(선택) — https:// 또는 /" />
          <input type="date" value={f.starts_at} onChange={(e) => setF((p) => ({ ...p, starts_at: e.target.value }))}
            className={INPUT} title="게시 시작일(선택)" />
          <input type="date" value={f.ends_at} onChange={(e) => setF((p) => ({ ...p, ends_at: e.target.value }))}
            className={INPUT} title="게시 종료일(선택)" />
        </div>
        <button onClick={create} disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-50">
          {busy ? '생성 중…' : '공지 추가'}
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : notices.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">등록된 공지가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {notices.map((n) => (
            <li key={n.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <span className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded ${n.type === 'popup' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
                {n.type === 'popup' ? '팝업' : '배너'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{n.title}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {n.body || '—'}{(n.starts_at || n.ends_at) && ` · ${n.starts_at?.slice(0, 10) || ''}~${n.ends_at?.slice(0, 10) || ''}`}
                </p>
              </div>
              <button onClick={() => toggle(n)}
                className={`shrink-0 px-2 py-1 rounded text-[11px] font-semibold border ${n.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                {n.active ? '게시 중' : '숨김'}
              </button>
              <button onClick={() => remove(n)} className="shrink-0 p-1.5 text-gray-400 hover:text-red-600" title="삭제">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
