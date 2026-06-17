import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import ImageUpload from '@/components/upload/ImageUpload'
import { Image as ImageIcon, Loader2, Plus, Edit, Trash2, Eye, EyeOff, X, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import AdminMallSelect from '@/components/admin/AdminMallSelect'

// 🏭 2026-06-09 Wave 2 — 어드민 도매 메인 배너 관리.
//   /wholesale 히어로 캐러셀 CRUD (이미지/링크/제목/순서/노출). 라이트 테마.

interface WholesaleBannerRow {
  id: number
  image_url: string
  link: string | null
  title: string | null
  sort: number
  is_active: boolean
}

const EMPTY = { image_url: '', link: '', title: '', sort: 0, is_active: true }

export default function AdminWholesaleBannersPage() {
  const navigate = useNavigate()
  const [editing, setEditing] = useState<WholesaleBannerRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  // 🏬 멀티-몰: 어드민이 볼/스탬프할 몰. '' = 미지정(백엔드 기본 몰 1 — 기존 뷰와 동일).
  const [mallId, setMallId] = useState('')

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  // 🛡️ 2026-06-10: 수동 useState+useEffect+api.get → useApiQuery (RQ SSOT).
  //   인증=api 인터셉터 자동(admin_token). mallId 변경 시 queryKey 로 자동 재조회.
  const queryClient = useQueryClient()
  const queryKey = ['admin', 'wholesale-banners', mallId] as const
  const { data: banners = [], isLoading: loading, refetch } = useApiQuery<WholesaleBannerRow[]>(
    queryKey,
    '/api/admin/wholesale-banners',
    {
      params: mallId ? { mall_id: mallId } : undefined,
      select: (raw) => {
        const r = raw as { success?: boolean; banners?: WholesaleBannerRow[] }
        return r?.success ? (r.banners || []) : []
      },
    },
  )
  const load = () => { void refetch() }
  const setBanners = (updater: (prev: WholesaleBannerRow[]) => WholesaleBannerRow[]) =>
    queryClient.setQueryData<WholesaleBannerRow[]>(queryKey, (prev) => updater(prev ?? []))

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY, sort: banners.length })
    setShowForm(true)
  }
  function openEdit(b: WholesaleBannerRow) {
    setEditing(b)
    setForm({ image_url: b.image_url, link: b.link || '', title: b.title || '', sort: b.sort, is_active: b.is_active })
    setShowForm(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.image_url) { toast.error('배너 이미지를 등록해 주세요'); return }
    setSaving(true)
    try {
      const body = {
        image_url: form.image_url,
        link: form.link.trim() || null,
        title: form.title.trim() || null,
        sort: Number(form.sort) || 0,
        is_active: form.is_active,
      }
      if (editing) {
        await api.patch(`/api/admin/wholesale-banners/${editing.id}`, body)
        toast.success('배너가 수정되었습니다')
      } else {
        // 🏬 멀티-몰: 선택된 몰에 배너 생성(미선택 시 백엔드 기본 몰 1 — 기존 동작 동일).
        await api.post('/api/admin/wholesale-banners', mallId ? { ...body, mall_id: Number(mallId) } : body)
        toast.success('배너가 등록되었습니다')
      }
      setShowForm(false)
      load()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '저장에 실패했습니다')
    } finally { setSaving(false) }
  }

  async function toggleActive(b: WholesaleBannerRow) {
    try {
      await api.patch(`/api/admin/wholesale-banners/${b.id}`, { is_active: !b.is_active })
      setBanners((prev) => prev.map((x) => x.id === b.id ? { ...x, is_active: !x.is_active } : x))
    } catch {
      toast.error('상태 변경에 실패했습니다')
    }
  }

  async function move(b: WholesaleBannerRow, dir: -1 | 1) {
    const newSort = Math.max(0, b.sort + dir)
    try {
      await api.patch(`/api/admin/wholesale-banners/${b.id}`, { sort: newSort })
      load()
    } catch {
      toast.error('순서 변경에 실패했습니다')
    }
  }

  async function remove(b: WholesaleBannerRow) {
    if (!(await confirmDialog({ message: '이 배너를 삭제할까요?' }))) return
    try {
      await api.delete(`/api/admin/wholesale-banners/${b.id}`)
      setBanners((prev) => prev.filter((x) => x.id !== b.id))
      toast.success('배너가 삭제되었습니다')
    } catch {
      toast.error('삭제에 실패했습니다')
    }
  }

  return (
    <AdminLayout title="도매 배너">
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <DashboardPageHeader icon={<ImageIcon className="w-5 h-5" />} title="도매 메인 배너" subtitle="도매몰(/wholesale) 메인 히어로 캐러셀 배너를 관리합니다." />
          <div className="flex items-center gap-2 shrink-0">
            <AdminMallSelect value={mallId} onChange={setMallId} allLabel="기본 몰" />
            <button onClick={openNew} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold">
              <Plus className="w-4 h-4" /> 배너 추가
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : banners.length === 0 ? (
          <p className="text-center text-gray-400 py-20">등록된 배너가 없습니다.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {banners.map((b) => (
              <div key={b.id} className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-3">
                <div className="w-40 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                  {b.image_url && <img src={b.image_url} alt={b.title || ''} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 truncate">{b.title || '(제목 없음)'}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{b.is_active ? '노출중' : '숨김'}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{b.link || '링크 없음'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">순서 {b.sort}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => move(b, -1)} title="위로" className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ArrowUp className="w-4 h-4" /></button>
                  <button onClick={() => move(b, 1)} title="아래로" className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ArrowDown className="w-4 h-4" /></button>
                  <button onClick={() => toggleActive(b)} title={b.is_active ? '숨기기' : '노출'} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg">{b.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                  <button onClick={() => openEdit(b)} title="수정" className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => remove(b)} title="삭제" className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? '배너 수정' : '배너 추가'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="닫기"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <ImageUpload value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} tokenKey="admin_token" label="배너 이미지 (권장 1280×480 · 16:6)" aspectRatio="banner" required />
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">제목 (선택)</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={120} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400" placeholder="배너 위에 표시할 문구" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">링크 (선택)</label>
                <input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400" placeholder="/wholesale/product/123 또는 https://..." />
                <p className="text-[11px] text-gray-400 mt-1">내부 경로(/로 시작) 또는 외부 URL(https://). 비우면 클릭 불가.</p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">순서</label>
                  <input type="number" value={form.sort} onChange={(e) => setForm((f) => ({ ...f, sort: Number(e.target.value) }))} className="w-24 h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none" />
                </div>
                <label className="flex items-center gap-2 mt-6 text-sm text-gray-700">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
                  노출
                </label>
              </div>
              <button type="submit" disabled={saving} className="w-full h-11 bg-gray-900 text-white rounded-lg text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? '수정 저장' : '배너 등록'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
