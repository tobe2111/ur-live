/**
 * 🏭 2026-06-10 (사용자 요청 — 도매 통합 게시판): 어드민 게시글 CRUD.
 *   공지사항(notice) + 상품 자료실(archive — 상품 ID 연결, 유통사가 이미지 다운로드).
 *   공개 페이지: /wholesale/board. 라이트 테마 (대시보드 — dark: 금지).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Megaphone, FolderDown, Plus, Edit, Trash2, Pin, X, Loader2, ExternalLink } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface BoardRow {
  id: number
  board_type: 'notice' | 'archive'
  mall_id: number
  title: string
  body: string | null
  product_id: number | null
  product_name?: string | null
  is_pinned: number
  view_count: number
  created_at: string
}

const EMPTY = { board_type: 'notice' as 'notice' | 'archive', title: '', body: '', product_id: '', is_pinned: false }

export default function AdminWholesaleBoardPage() {
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState<'' | 'notice' | 'archive'>('')
  const [editing, setEditing] = useState<BoardRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  const queryClient = useQueryClient()
  const queryKey = ['admin', 'wholesale-board', typeFilter] as const
  const { data: posts = [], isLoading: loading } = useApiQuery<BoardRow[]>(
    queryKey,
    '/api/admin/wholesale-board',
    {
      params: typeFilter ? { type: typeFilter } : undefined,
      select: (raw) => {
        const r = raw as { success?: boolean; posts?: BoardRow[] }
        return r?.success ? (r.posts || []) : []
      },
    },
  )
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'wholesale-board'] })

  function openCreate() { setEditing(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(p: BoardRow) {
    setEditing(p)
    setForm({ board_type: p.board_type, title: p.title, body: p.body || '', product_id: p.product_id ? String(p.product_id) : '', is_pinned: !!p.is_pinned })
    setShowForm(true)
  }

  async function save() {
    if (saving) return
    if (!form.title.trim()) { toast.error('제목을 입력해주세요'); return }
    if (form.board_type === 'archive' && !Number(form.product_id)) { toast.error('자료실 게시글은 연결 상품 ID가 필요해요'); return }
    setSaving(true)
    try {
      const payload = {
        board_type: form.board_type,
        title: form.title.trim(),
        body: form.body.trim(),
        product_id: Number(form.product_id) || null,
        is_pinned: form.is_pinned,
      }
      const res = editing
        ? await api.patch(`/api/admin/wholesale-board/${editing.id}`, payload)
        : await api.post('/api/admin/wholesale-board', payload)
      if (res.data?.success) {
        toast.success(editing ? '수정됐어요' : '등록됐어요')
        setShowForm(false)
        refresh()
      } else toast.error(res.data?.error || '저장 실패')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || '저장 실패')
    } finally { setSaving(false) }
  }

  async function remove(p: BoardRow) {
    if (!(await confirmDialog({ title: '게시글 삭제', message: `"${p.title}" 을(를) 삭제할까요?`, confirmText: '삭제', danger: true }))) return
    try {
      const res = await api.delete(`/api/admin/wholesale-board/${p.id}`)
      if (res.data?.success) { toast.success('삭제됐어요'); refresh() }
      else toast.error(res.data?.error || '삭제 실패')
    } catch { toast.error('삭제 실패') }
  }

  return (
    <AdminLayout title="도매 게시판">
      <DashboardPageHeader
        title="도매 게시판"
        subtitle="공지사항 + 상품 자료실(이미지 다운로드) — 공개 페이지: /wholesale/board"
        actions={(
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-gray-900 text-white text-sm font-bold">
            <Plus className="w-4 h-4" /> 새 게시글
          </button>
        )}
      />

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {([['', '전체'], ['notice', '공지사항'], ['archive', '자료실']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            className={`px-3.5 h-9 rounded-full text-[13px] font-bold ${typeFilter === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {l}
          </button>
        ))}
        <a href="/wholesale/board" target="_blank" rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[13px] font-bold text-gray-500 self-center">
          공개 페이지 <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-sm text-gray-400">게시글이 없어요 — 새 게시글로 시작하세요</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {posts.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-gray-100' : ''}`}>
              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${p.board_type === 'notice' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                {p.board_type === 'notice' ? <Megaphone className="w-3 h-3" /> : <FolderDown className="w-3 h-3" />}
                {p.board_type === 'notice' ? '공지' : '자료실'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 truncate">
                  {!!p.is_pinned && <Pin className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-red-500" />}
                  {p.title}
                </p>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  #{p.id} · 조회 {p.view_count ?? 0}{p.product_id ? ` · 상품 ${p.product_name || p.product_id}` : ''}
                </p>
              </div>
              <button onClick={() => openEdit(p)} aria-label="수정" className="p-2 text-gray-400 hover:text-gray-900"><Edit className="w-4 h-4" /></button>
              <button onClick={() => remove(p)} aria-label="삭제" className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* 작성/수정 폼 */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-extrabold text-gray-900">{editing ? '게시글 수정' : '새 게시글'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="닫기" className="p-1 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            {!editing && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {([['notice', '📢 공지사항'], ['archive', '📁 상품 자료실']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, board_type: v }))}
                    className={`h-11 rounded-xl text-[13px] font-bold ${form.board_type === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={200}
              placeholder="제목" className="w-full h-11 rounded-xl border border-gray-200 px-3.5 text-[14px] text-gray-900 mb-2" />
            {form.board_type === 'archive' && (
              <input value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value.replace(/\D/g, '') }))}
                placeholder="연결 상품 ID (필수) — 해당 상품의 대표/상세 이미지가 다운로드로 제공돼요"
                className="w-full h-11 rounded-xl border border-gray-200 px-3.5 text-[13px] text-gray-900 mb-2" />
            )}
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={6} maxLength={20000}
              placeholder="내용 (선택)" className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-[13px] text-gray-900 resize-none mb-2" />
            <label className="flex items-center gap-2 text-[13px] font-bold text-gray-700 mb-4">
              <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} className="w-4 h-4" />
              상단 고정 (📌)
            </label>
            <button onClick={save} disabled={saving}
              className="w-full h-12 rounded-xl bg-gray-900 text-white text-[14px] font-bold disabled:opacity-50">
              {saving ? '저장 중…' : (editing ? '수정하기' : '등록하기')}
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
