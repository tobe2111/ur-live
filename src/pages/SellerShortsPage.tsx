import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Eye, Heart, Video, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'

interface Short {
  id: number
  title: string
  video_url: string
  youtube_video_id?: string
  thumbnail_url?: string
  view_count: number
  like_count: number
  status: string
  created_at: string
}

interface Product {
  id: number
  name: string
}

export default function SellerShortsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [shorts, setShorts] = useState<Short[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 폼 상태
  const [title, setTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [productId, setProductId] = useState<number | null>(null)

  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    loadData()
  }, [navigate])

  async function loadData() {
    setLoading(true)
    try {
      const [shortsRes, productsRes] = await Promise.all([
        api.get('/api/shorts/seller/list', { headers }),
        api.get('/api/seller/products', { headers }),
      ])
      setShorts(shortsRes.data.data ?? [])
      setProducts(productsRes.data.data ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  // YouTube URL에서 video ID 추출
  function extractYoutubeId(url: string): string | null {
    const patterns = [
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
      /youtu\.be\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error(t('seller.enterTitle')); return }
    if (!videoUrl.trim()) { toast.error(t('seller.enterVideoUrl')); return }

    setSubmitting(true)
    try {
      const youtubeId = extractYoutubeId(videoUrl)

      const res = await api.post('/api/shorts', {
        title: title.trim(),
        video_url: videoUrl.trim(),
        youtube_video_id: youtubeId,
        thumbnail_url: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null,
        product_id: productId,
      }, { headers })

      if (res.data.success) {
        toast.success(t('seller.shortsRegistered'))
        setShowForm(false)
        setTitle('')
        setVideoUrl('')
        setProductId(null)
        loadData()
      } else {
        toast.error(res.data.error || t('seller.registerFailed'))
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('seller.registerError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('seller.confirmDeleteShorts'))) return
    try {
      await api.delete(`/api/shorts/${id}`, { headers })
      toast.success(t('seller.deleted'))
      setShorts(prev => prev.filter(s => s.id !== id))
    } catch {
      toast.error(t('seller.deleteFailed'))
    }
  }

  if (loading) {
    return (
      <SellerLayout title={t('seller.shortsManage')}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title={t('seller.shortsManage')}>
      <div className="max-w-2xl mx-auto">
        {/* 버튼 그룹 */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            {t('seller.newShorts')}
          </button>
          <button
            onClick={async () => {
              try {
                toast.success('YouTube 쇼츠 동기화 중...')
                const res = await api.get('/api/seller/youtube/shorts/sync', { headers })
                if (res.data.success) {
                  toast.success(res.data.message || '동기화 완료')
                  loadData()
                } else {
                  toast.error(res.data.error || '동기화 실패')
                }
              } catch { toast.error('YouTube 연동이 필요합니다') }
            }}
            className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm flex items-center gap-1.5 active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            동기화
          </button>
        </div>

        {/* 등록 폼 */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">{t('seller.shortsRegister')}</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">{t('common.name')} *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('seller.shortsTitle')}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block">{t('seller.videoUrl')} *</label>
                <input
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/shorts/... or https://youtu.be/..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:outline-none"
                />
                {videoUrl && extractYoutubeId(videoUrl) && (
                  <div className="mt-2 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={`https://img.youtube.com/vi/${extractYoutubeId(videoUrl)}/hqdefault.jpg`}
                      alt={t('seller.preview')}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block">{t('seller.linkedProductOptional')}</label>
                <select
                  value={productId || ''}
                  onChange={e => setProductId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-purple-400 focus:outline-none"
                >
                  <option value="">{t('seller.noProduct')}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-sm rounded-lg font-medium">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-[2] py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm rounded-lg font-bold disabled:opacity-50"
              >
                {submitting ? t('seller.registering') : t('seller.registerSubmit')}
              </button>
            </div>
          </div>
        )}

        {/* 쇼츠 목록 */}
        {shorts.length === 0 ? (
          <div className="text-center py-16">
            <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{t('seller.noShorts')}</p>
            <p className="text-gray-400 text-xs mt-1">{t('seller.shortsRegisterEasy')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {shorts.map(s => (
              <div key={s.id} className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                {/* 썸네일 */}
                <div className="relative aspect-[9/16] bg-gray-100">
                  {s.youtube_video_id ? (
                    <img
                      src={`https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : s.thumbnail_url ? (
                    <img src={s.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-200 to-pink-200" />
                  )}
                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>

                {/* 정보 */}
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-900 line-clamp-1">{s.title}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
                    <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{s.view_count}</span>
                    <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{s.like_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
