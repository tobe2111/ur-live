import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Plus, Trash2, Play, ExternalLink, Search, Edit2, X, Check, Youtube } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'

interface Stream {
  id: number; title: string; description?: string; youtube_video_id?: string
  status: string; seller_id: number; seller_name?: string
  created_at: string; ended_at?: string
}

interface Seller { id: number; name: string }
interface Product { id: number; name: string; price: number; image_url?: string }

export default function AdminReplayPage() {
  const navigate = useNavigate()
  const [streams, setStreams] = useState<Stream[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    seller_id: 0, title: '', description: '', youtube_url: '', product_ids: [] as number[]
  })
  const [productSearch, setProductSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const headers = { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])
  useEffect(() => {
    Promise.all([
      api.get('/api/admin/streams?status=ended', { headers }),
      api.get('/api/admin/sellers', { headers }),
      api.get('/api/admin/products', { headers }),
    ]).then(([streamsRes, sellersRes, productsRes]) => {
      setStreams(streamsRes.data.data || [])
      setSellers(sellersRes.data.data || [])
      setProducts(productsRes.data.data || [])
    }).catch(() => toast.error('데이터 로딩 실패'))
      .finally(() => setLoading(false))
  }, [])

  function resetForm() {
    setForm({ seller_id: 0, title: '', description: '', youtube_url: '', product_ids: [] })
    setEditingId(null)
    setShowForm(false)
    setProductSearch('')
  }

  // Returns extracted 11-char YouTube video ID or null if URL is invalid.
  // Never fall back to the raw URL — that would pollute DB with bad values.
  function extractVideoId(url: string): string | null {
    if (!url) return null
    // Accept bare 11-char video IDs (used when editing existing records)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim()
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return match ? match[1] : null
  }

  async function handleSubmit() {
    if (!form.seller_id || !form.title || !form.youtube_url) {
      toast.error('셀러, 제목, YouTube URL을 입력해주세요')
      return
    }
    const videoId = extractVideoId(form.youtube_url)
    if (!videoId) {
      toast.error('유효한 YouTube URL을 입력해주세요')
      return
    }
    setSubmitting(true)
    try {
      if (editingId) {
        await api.put(`/api/admin/streams/${editingId}`, {
          title: form.title,
          description: form.description,
          youtube_video_id: videoId,
          product_ids: form.product_ids,
        }, { headers })
        toast.success('수정되었습니다')
      } else {
        await api.post('/api/admin/streams/replay', {
          seller_id: form.seller_id,
          title: form.title,
          description: form.description,
          youtube_url: form.youtube_url,
          product_ids: form.product_ids,
        }, { headers })
        toast.success('다시보기가 생성되었습니다')
      }
      resetForm()
      // 새로고침
      const r = await api.get('/api/admin/streams?status=ended', { headers })
      setStreams(r.data.data || [])
    } catch (err: unknown) { toast.error((err as { response?: { data?: { error?: string; message?: string }; status?: number } }).response?.data?.error || '저장 실패') }
    finally { setSubmitting(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 다시보기를 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/admin/streams/${id}`, { headers })
      setStreams(prev => prev.filter(s => s.id !== id))
      toast.success('삭제되었습니다')
    } catch { toast.error('삭제 실패') }
  }

  function startEdit(stream: Stream) {
    setForm({
      seller_id: stream.seller_id,
      title: stream.title,
      description: stream.description || '',
      youtube_url: stream.youtube_video_id || '',
      product_ids: [],
    })
    setEditingId(stream.id)
    setShowForm(true)
  }

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  const videoPreviewId = form.youtube_url ? (extractVideoId(form.youtube_url) || '') : ''

  return (
    <AdminLayout title="다시보기 관리">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="다시보기 관리"
          subtitle="YouTube 영상 + 상품을 연결하여 다시보기 콘텐츠 생성"
          icon={<Youtube className="h-5 w-5" />}
          actions={
            <button
              onClick={() => { setShowForm(!showForm); if (editingId) resetForm() }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              <Plus className="h-3.5 w-3.5" />
              다시보기 생성
            </button>
          }
        />

        {/* 생성/수정 폼 */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingId ? '다시보기 수정' : '새 다시보기 생성'}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 왼쪽: 기본 정보 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">셀러 선택</label>
                  <select
                    value={form.seller_id}
                    onChange={e => setForm(f => ({ ...f, seller_id: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                    disabled={!!editingId}
                  >
                    <option value={0}>셀러를 선택하세요</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>{s.name} (ID: {s.id})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="다시보기 제목"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="방송 설명"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube URL</label>
                  <div className="flex gap-2">
                    <input
                      value={form.youtube_url}
                      onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
                      placeholder="https://youtube.com/watch?v=... 또는 https://youtube.com/live/..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                    />
                    {videoPreviewId && (
                      <a href={`https://youtube.com/watch?v=${videoPreviewId}`} target="_blank" rel="noopener"
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-1 shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" /> 확인
                      </a>
                    )}
                  </div>
                  {videoPreviewId && (
                    <div className="mt-2 aspect-video rounded-lg overflow-hidden bg-black max-w-sm">
                      <img
                        src={`https://img.youtube.com/vi/${videoPreviewId}/mqdefault.jpg`}
                        alt="미리보기"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽: 상품 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연결 상품</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="상품 검색..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>

                {/* 선택된 상품 */}
                {form.product_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.product_ids.map(pid => {
                      const p = products.find(pp => pp.id === pid)
                      return (
                        <span key={pid} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                          {p?.name || `#${pid}`}
                          <button onClick={() => setForm(f => ({ ...f, product_ids: f.product_ids.filter(id => id !== pid) }))}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* 상품 목록 */}
                <div className="border border-gray-200 rounded-lg max-h-[300px] overflow-y-auto">
                  {filteredProducts.slice(0, 30).map(p => {
                    const selected = form.product_ids.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => setForm(f => ({
                          ...f,
                          product_ids: selected
                            ? f.product_ids.filter(id => id !== p.id)
                            : [...f.product_ids, p.id]
                        }))}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b border-gray-50 last:border-0 ${
                          selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{p.price?.toLocaleString()}원</span>
                        {selected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={handleSubmit} disabled={submitting}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50">
                {submitting ? '처리 중...' : editingId ? '수정' : '생성'}
              </button>
              <button onClick={resetForm} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                취소
              </button>
            </div>
          </div>
        )}

        {/* 다시보기 목록 */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : streams.length === 0 ? (
          <div className="text-center py-20">
            <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">다시보기 영상이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {streams.map(s => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                {/* 썸네일 */}
                <div className="relative aspect-video bg-gray-100">
                  {s.youtube_video_id ? (
                    <img
                      src={`https://img.youtube.com/vi/${s.youtube_video_id}/mqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Youtube className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-[10px] rounded-md font-medium">
                    다시보기
                  </span>
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 text-white text-[10px] rounded-md font-mono">
                    #{s.id}
                  </span>
                </div>

                <div className="p-3">
                  <p className="text-sm font-bold text-gray-900 line-clamp-1">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.seller_name || `셀러 #${s.seller_id}`}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(s.created_at).toLocaleDateString('ko-KR')}
                  </p>

                  <div className="flex gap-1.5 mt-3">
                    <a
                      href={`/live/${s.id}`}
                      target="_blank"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
                    >
                      <ExternalLink className="w-3 h-3" /> 보기
                    </a>
                    <button
                      onClick={() => startEdit(s)}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100"
                    >
                      <Edit2 className="w-3 h-3" /> 수정
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="flex items-center justify-center px-2 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
