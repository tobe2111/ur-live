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
          setError('스트림을 찾을 수 없습니다')
        }
      }
    } catch (error: any) {
      console.error('Failed to load stream:', error)
      setError('스트림 로드 실패')
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
        toast.success('스트림이 수정되었습니다')
        navigate('/seller')
      } else {
        setError(response.data.error || '수정 실패')
      }
    } catch (error: any) {
      console.error('Failed to update stream:', error)
      setError(error.response?.data?.error || '수정 실패')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('정말 이 스트림을 삭제하시겠습니까?')) {
      return
    }

    try {
      const sessionToken = localStorage.getItem('seller_token')

      const response = await api.delete(`/api/seller/streams/${id}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        toast.success('스트림이 삭제되었습니다')
        navigate('/seller')
      } else {
        setError(response.data.error || '삭제 실패')
      }
    } catch (error: any) {
      console.error('Failed to delete stream:', error)
      setError(error.response?.data?.error || '삭제 실패')
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
          <p className="text-gray-600">스트림 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">스트림을 찾을 수 없습니다</p>
          <button
            onClick={() => navigate('/seller')}
            className="text-blue-600 hover:underline"
          >
            대시보드로 돌아가기
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
            <span>대시보드로 돌아가기</span>
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
              <h1 className="text-3xl font-bold text-gray-900">스트림 관리</h1>
            </div>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
        </div>

        {/* Stream Info */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">스트림 정보</h2>
          <div className="space-y-3 text-sm">
            <div className="flex">
              <span className="w-32 text-gray-600">플랫폼:</span>
              <span className="font-medium">{stream.platform === 'youtube' ? 'YouTube' : 'TikTok'}</span>
            </div>
            <div className="flex">
              <span className="w-32 text-gray-600">영상 ID:</span>
              <span className="font-mono text-gray-900">{stream.youtube_video_id}</span>
            </div>
            <div className="flex">
              <span className="w-32 text-gray-600">영상 URL:</span>
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
              <span className="w-32 text-gray-600">생성일:</span>
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
            스트림 수정
          </h2>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              스트림 제목 <span className="text-red-500">*</span>
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
              설명
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
              상태
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="scheduled">예정</option>
              <option value="live">라이브</option>
              <option value="ended">종료</option>
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
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    수정 중...
                  </span>
                ) : (
                  '수정 완료'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
