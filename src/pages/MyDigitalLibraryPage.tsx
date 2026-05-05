/**
 * 마이페이지 → 디지털 보관함 (2026-05-05 Phase 1)
 *
 * 사용자가 구매한 디지털 상품 (전자책/PDF/영상강의/가이드) 목록 및 다운로드/시청.
 * - access_token 기반 다운로드 (IDOR 방어)
 * - 만료일/다운로드 횟수 표시
 * - 외부 콘텐츠 (YouTube/Vimeo) 는 새 창 열기, 파일은 직접 다운로드
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, Play, FileText, BookOpen, Music, Image as ImageIcon, Clock, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'

interface DigitalAccess {
  access_id: number
  access_token: string
  expires_at: string | null
  download_count: number
  download_limit: number
  last_accessed: string | null
  status: 'active' | 'revoked' | 'expired'
  created_at: string
  product_id: number
  product_name: string
  image_url: string | null
  product_kind: 'digital' | 'video_course' | 'pdf_guide' | 'live_class'
  content_format: string | null
  file_size_mb: number | null
  preview_url: string | null
  seller_name: string | null
  seller_image: string | null
}

const KIND_LABEL: Record<string, string> = {
  digital: '📄 디지털 파일',
  video_course: '🎬 영상 강의',
  pdf_guide: '📚 가이드',
  live_class: '🎓 실시간 강의',
}

const FORMAT_ICON: Record<string, typeof Download> = {
  pdf: FileText,
  video: Play,
  audio: Music,
  image: ImageIcon,
  zip: Download,
  epub: BookOpen,
  html: FileText,
}

export default function MyDigitalLibraryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<DigitalAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    try {
      const res = await api.get('/api/digital/my')
      if (res.data?.success) setItems(res.data.data || [])
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } }
      if (e.response?.status === 401) navigate('/login?returnUrl=/my/digital')
    } finally { setLoading(false) }
  }

  async function openItem(token: string) {
    if (opening) return
    setOpening(token)
    try {
      const res = await api.get(`/api/digital/access/${encodeURIComponent(token)}`)
      if (!res.data?.success) {
        toast.error(res.data?.error || t('digitalLibrary.accessFailed', { defaultValue: '접근 실패' }))
        return
      }
      const url = res.data.data.url as string
      const kind = res.data.data.kind as string
      // 영상 강의 / 외부 URL — 새 탭
      if (kind === 'video_course' || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/i.test(url)) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        // 직접 다운로드 (파일 stream)
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.download = ''
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      // 카운트 갱신
      setItems(prev => prev.map(it => it.access_token === token
        ? { ...it, download_count: res.data.data.download_count, last_accessed: new Date().toISOString() }
        : it
      ))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('digitalLibrary.accessFailed', { defaultValue: '접근 실패' }))
    } finally { setOpening(null) }
  }

  function formatExpiry(expires: string | null) {
    if (!expires) return t('digitalLibrary.expiryPermanent', { defaultValue: '영구 접근' })
    const d = new Date(expires)
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000)
    if (days < 0) return t('digitalLibrary.expiryExpired', { defaultValue: '만료됨' })
    if (days < 7) return t('digitalLibrary.expirySoon', { days, defaultValue: '{{days}}일 후 만료' })
    return t('digitalLibrary.expiryDate', { date: d.toLocaleDateString('ko-KR'), defaultValue: '{{date}} 까지' })
  }

  return (
    <>
      <SEO title={t('digitalLibrary.seoTitle', { defaultValue: '디지털 보관함 - 유어딜' })} description={t('digitalLibrary.seoDesc', { defaultValue: '구매한 전자책, 강의, 가이드 보관함' })} url="/my/digital" />
      <div className="ur-content-narrow px-4 py-6 lg:py-10 mx-auto" style={{ width: '100%' }}>
        <header className="mb-6">
          <h1 className="text-xl lg:text-3xl font-bold text-gray-900 dark:text-white">{t('digitalLibrary.title', { defaultValue: '디지털 보관함' })}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('digitalLibrary.subtitle', { defaultValue: '전자책 · 강의 · 가이드 · 영상 — 구매한 콘텐츠 모음' })}</p>
        </header>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-100 dark:bg-[#1A1A1A] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('digitalLibrary.empty', { defaultValue: '아직 구매한 디지털 상품이 없습니다' })}</p>
            <button onClick={() => navigate('/browse')} className="mt-4 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
              {t('digitalLibrary.browseCta', { defaultValue: '상품 둘러보기' })}
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map(it => {
              const Icon = FORMAT_ICON[it.content_format || ''] || Download
              const isExpiringSoon = it.expires_at && new Date(it.expires_at).getTime() - Date.now() < 7 * 86400000
              const isExpired = it.status === 'expired' || (it.expires_at && new Date(it.expires_at).getTime() < Date.now())
              const remainingDownloads = Math.max(0, it.download_limit - it.download_count)

              return (
                <li key={it.access_id} className={`bg-white dark:bg-[#0A0A0A] border ${isExpired ? 'border-red-200 dark:border-red-900 opacity-70' : 'border-gray-200 dark:border-[#2A2A2A]'} rounded-2xl p-4`}>
                  <div className="flex gap-3">
                    {it.image_url ? (
                      <img src={it.image_url} alt="" loading="lazy" className="w-16 h-16 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-[#1A1A1A]" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shrink-0">
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400">{KIND_LABEL[it.product_kind] || t('digitalLibrary.kindDefault', { defaultValue: '디지털' })}</p>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{it.product_name}</h3>
                          {it.seller_name && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{it.seller_name}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatExpiry(it.expires_at)}
                        </span>
                        <span>{t('digitalLibrary.downloadCount', { count: it.download_count, limit: it.download_limit, defaultValue: '다운로드 {{count}}/{{limit}}' })}</span>
                        {it.file_size_mb && <span>{it.file_size_mb}MB</span>}
                      </div>

                      {isExpired ? (
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-red-600">
                          <AlertTriangle className="w-3 h-3" /> {t('digitalLibrary.accessError', { status: it.status, defaultValue: '접근 불가 ({{status}})' })}
                        </div>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => openItem(it.access_token)}
                            disabled={opening === it.access_token || remainingDownloads === 0}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                          >
                            {it.product_kind === 'video_course' ? <Play className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                            {opening === it.access_token ? t('digitalLibrary.openingLabel', { defaultValue: '여는 중...' }) : it.product_kind === 'video_course' ? t('digitalLibrary.watchLabel', { defaultValue: '시청하기' }) : t('digitalLibrary.downloadLabel', { defaultValue: '다운로드' })}
                          </button>
                          {it.preview_url && (
                            <button
                              onClick={() => window.open(it.preview_url!, '_blank', 'noopener,noreferrer')}
                              className="px-3 py-2 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-[#2A2A2A]"
                            >
                              {t('digitalLibrary.previewLabel', { defaultValue: '미리보기' })}
                            </button>
                          )}
                        </div>
                      )}

                      {isExpiringSoon && !isExpired && (
                        <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">{t('digitalLibrary.expiringSoon', { defaultValue: '⏰ 곧 만료됩니다' })}</p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
