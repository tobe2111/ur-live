import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { ArrowLeft, Loader2, Play, Edit, Trash2 } from 'lucide-react'
import { formatKST } from '@/utils/date'

interface Stream {
  id: number
  title: string
  description: string
  youtube_video_id: string
  status: string
  platform: string
  tiktok_username: string | null
  created_at: string
  seller_instagram: string | null
  seller_youtube: string | null
  seller_facebook: string | null
}

export default function SellerStreamEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const [stream, setStream] = useState<Stream | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'live'
  })

  useEffect(() => {
    const sessionToken = localStorage.getItem('seller_token')

    if (!sessionToken) {
      navigate('/seller/login')
      return
    }

    loadStream()
  }, [id])

  async function loadStream() {
    try {
      const sessionToken = localStorage.getItem('seller_token')

      const response = await api.get(`/api/seller/streams/${id}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        const foundStream = response.data.stream
        if (foundStream) {
          setStream(foundStream)
          setFormData({
            title: foundStream.title || '',
            description: foundStream.description || '',
            status: foundStream.status || 'live'
          })
        } else {
          setError(t('seller.streamNotFound'))
        }
      }
    } catch (error: unknown) {
      console.error('Failed to load stream:', error)
      setError(t('seller.streamLoadFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const sessionToken = localStorage.getItem('seller_token')

      const response = await api.put(`/api/seller/streams/${id}`, {
        title: formData.title,
        description: formData.description,
        status: formData.status
      }, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        toast.success(t('seller.streamUpdated'))
        navigate('/seller')
      } else {
        setError(response.data.error || t('seller.updateFailed'))
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      console.error('Failed to update stream:', error)
      setError(error_.response?.data?.error || t('seller.updateFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(t('seller.confirmDeleteStream'))) {
      return
    }

    try {
      const sessionToken = localStorage.getItem('seller_token')

      const response = await api.delete(`/api/seller/streams/${id}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        toast.success(t('seller.streamDeleted'))
        navigate('/seller')
      } else {
        setError(response.data.error || t('seller.streamDeleteFailed'))
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      console.error('Failed to delete stream:', error)
      setError(error_.response?.data?.error || t('seller.streamDeleteFailed'))
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  function getVideoUrl() {
    if (!stream) return ''

    if (stream.platform === 'youtube') {
      return `https://www.youtube.com/watch?v=${stream.youtube_video_id}`
    } else if (stream.platform === 'tiktok') {
      return `https://www.tiktok.com/@${stream.tiktok_username}`
    }
    return ''
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('seller.streamLoading')}</p>
        </div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{t('seller.streamNotFound')}</p>
          <button
            onClick={() => navigate('/seller')}
            className="text-blue-600 hover:underline"
          >
            {t('seller.backToDashboard')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/seller')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('seller.backToDashboard')}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Play className="w-10 h-10 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">{t('seller.streamManagement')}</h1>
            </div>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {t('common.delete')}
            </button>
          </div>
        </div>

        {/* Stream Info */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('seller.streamInfo')}</h2>
          <div className="space-y-3 text-sm">
            <div className="flex">
              <span className="w-32 text-gray-600">{t('seller.platformLabel')}:</span>
              <span className="font-medium">{stream.platform === 'youtube' ? 'YouTube' : 'TikTok'}</span>
            </div>
            <div className="flex">
              <span className="w-32 text-gray-600">{t('seller.videoId')}:</span>
              <span className="font-mono text-gray-900">{stream.youtube_video_id}</span>
            </div>
            <div className="flex">
              <span className="w-32 text-gray-600">{t('seller.videoUrl')}:</span>
              <a
                href={getVideoUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {getVideoUrl()}
              </a>
            </div>
            <div className="flex">
              <span className="w-32 text-gray-600">{t('seller.createdDate')}:</span>
              <span className="text-gray-900">{formatKST(stream.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleUpdate} className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Edit className="w-5 h-5" />
            {t('seller.editStream')}
          </h2>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.streamTitleField')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.streamDescription')}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.statusField')}
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="scheduled">{t('seller.statusScheduled')}</option>
              <option value="live">{t('seller.statusLive')}</option>
              <option value="ended">{t('seller.statusEnded')}</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/seller')}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('seller.updatingStream')}
                  </span>
                ) : (
                  t('seller.updateComplete')
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
