import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function SellerStreamNewPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtubeUrl: '',
    scheduledAt: '',
    sellerInstagram: '',
    sellerYoutube: '',
    sellerFacebook: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const sessionToken = localStorage.getItem('session_token')
      
      if (!sessionToken) {
        setError('로그인이 필요합니다')
        navigate('/seller/login')
        return
      }

      const response = await axios.post('/api/seller/streams', {
        title: formData.title,
        description: formData.description,
        youtube_url: formData.youtubeUrl,
        scheduled_at: formData.scheduledAt || null,
        status: formData.scheduledAt ? 'scheduled' : 'live',
        seller_instagram: formData.sellerInstagram || null,
        seller_youtube: formData.sellerYoutube || null,
        seller_facebook: formData.sellerFacebook || null
      }, {
        headers: {
          'X-Session-Token': sessionToken
        }
      })

      if (response.data.success) {
        alert('라이브 스트림이 생성되었습니다!')
        navigate('/seller')
      } else {
        setError(response.data.error || '생성 실패')
      }
    } catch (err: any) {
      console.error('Stream creation error:', err)
      setError(err.response?.data?.error || err.response?.data?.message || '생성 실패')
    } finally {
      setLoading(false)
    }
  }

  function goBack() {
    navigate('/seller')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={goBack}
              className="text-gray-600 hover:text-gray-900"
            >
              ← 뒤로가기
            </button>
            <h1 className="text-2xl font-bold text-gray-900">새 라이브 스트림</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* 기본 정보 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">기본 정보</h3>
              
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  라이브 제목 *
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="🎮 게이밍 기어 특가 라이브"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="라이브 방송에 대한 설명을 입력하세요..."
                />
              </div>

              <div>
                <label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube 라이브 URL *
                </label>
                <input
                  id="youtubeUrl"
                  name="youtubeUrl"
                  type="url"
                  value={formData.youtubeUrl}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                />
                <p className="mt-2 text-sm text-gray-500">
                  지원 형식: youtube.com/watch?v=..., youtu.be/..., youtube.com/live/...
                </p>
              </div>

              <div>
                <label htmlFor="scheduledAt" className="block text-sm font-medium text-gray-700 mb-2">
                  예약 시간 (선택)
                </label>
                <input
                  id="scheduledAt"
                  name="scheduledAt"
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-500">
                  비워두면 즉시 라이브가 시작됩니다
                </p>
              </div>
            </div>

            {/* SNS 정보 */}
            <div className="space-y-4 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">SNS 링크 (선택)</h3>
              
              <div>
                <label htmlFor="sellerInstagram" className="block text-sm font-medium text-gray-700 mb-2">
                  Instagram
                </label>
                <input
                  id="sellerInstagram"
                  name="sellerInstagram"
                  type="text"
                  value={formData.sellerInstagram}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="your_instagram_id 또는 전체 URL"
                />
              </div>

              <div>
                <label htmlFor="sellerYoutube" className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube
                </label>
                <input
                  id="sellerYoutube"
                  name="sellerYoutube"
                  type="text"
                  value={formData.sellerYoutube}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="@your_channel 또는 전체 URL"
                />
              </div>

              <div>
                <label htmlFor="sellerFacebook" className="block text-sm font-medium text-gray-700 mb-2">
                  Facebook
                </label>
                <input
                  id="sellerFacebook"
                  name="sellerFacebook"
                  type="text"
                  value={formData.sellerFacebook}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="your_page_name 또는 전체 URL"
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={goBack}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '생성 중...' : '라이브 시작'}
              </button>
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">💡 라이브 시작 방법</h4>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>YouTube Studio에서 라이브 스트리밍을 시작하세요</li>
              <li>라이브 URL을 복사하여 위 폼에 붙여넣으세요</li>
              <li>"라이브 시작" 버튼을 클릭하세요</li>
              <li>시청자들이 라이브 페이지에서 방송을 볼 수 있습니다</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
