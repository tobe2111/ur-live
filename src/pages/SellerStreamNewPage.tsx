import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function SellerStreamNewPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'manual' | 'youtube-auto'>('manual')
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
  const [youtubeInfo, setYoutubeInfo] = useState<{
    streamKey: string
    streamUrl: string
    watchUrl: string
  } | null>(null)

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
      const sessionToken = localStorage.getItem('seller_token')
      
      if (!sessionToken) {
        setError('로그인이 필요합니다')
        navigate('/seller/login')
        return
      }

      if (mode === 'youtube-auto') {
        // YouTube 자동 생성
        const response = await api.post('/api/seller/youtube/create-live', {
          title: formData.title,
          description: formData.description,
          scheduled_at: formData.scheduledAt || null,
        }, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        })

        if (response.data.success) {
          setYoutubeInfo({
            streamKey: response.data.data.streamKey,
            streamUrl: response.data.data.streamUrl,
            watchUrl: response.data.data.watchUrl,
          })
          toast.success('YouTube 라이브가 생성되었습니다! 스트림 키를 복사하여 OBS에 설정하세요.')
        } else {
          setError(response.data.error || '생성 실패')
        }
      } else {
        // 수동 입력
        const response = await api.post('/api/seller/streams', {
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
            'Authorization': `Bearer ${sessionToken}`
          }
        })

        if (response.data.success) {
          toast.success('라이브 스트림이 생성되었습니다!')
          navigate('/seller')
        } else {
          setError(response.data.error || '생성 실패')
        }
      }
    } catch (err: any) {
      console.error('Stream creation error:', err)
      console.error('Error response:', err.response?.data)
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || '생성 실패'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function goBack() {
    navigate('/seller')
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label}이(가) 복사되었습니다!`)
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
          {/* YouTube Info Display */}
          {youtubeInfo && (
            <div className="mb-8 p-6 bg-green-50 rounded-lg border-2 border-green-200">
              <h3 className="text-xl font-bold text-green-900 mb-4">
                ✅ YouTube 라이브 생성 완료!
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-green-900 mb-2">
                    📺 시청 URL:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={youtubeInfo.watchUrl}
                      readOnly
                      className="flex-1 px-4 py-2 bg-white border border-green-300 rounded-lg"
                    />
                    <button
                      onClick={() => copyToClipboard(youtubeInfo.watchUrl, '시청 URL')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      복사
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-green-900 mb-2">
                    🔑 스트림 키 (OBS에 입력):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={youtubeInfo.streamKey}
                      readOnly
                      className="flex-1 px-4 py-2 bg-white border border-green-300 rounded-lg font-mono text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(youtubeInfo.streamKey, '스트림 키')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      복사
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-green-900 mb-2">
                    📡 스트림 URL (OBS 서버):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={youtubeInfo.streamUrl}
                      readOnly
                      className="flex-1 px-4 py-2 bg-white border border-green-300 rounded-lg font-mono text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(youtubeInfo.streamUrl, '스트림 URL')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      복사
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">📝 OBS 설정 방법:</h4>
                <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
                  <li>OBS Studio 실행</li>
                  <li>설정 {'>'} 방송 {'>'} 서비스: YouTube - RTMPS</li>
                  <li>서버: 위의 "스트림 URL" 복사 붙여넣기</li>
                  <li>스트림 키: 위의 "스트림 키" 복사 붙여넣기</li>
                  <li>"방송 시작" 클릭!</li>
                </ol>
              </div>

              <button
                onClick={goBack}
                className="mt-4 w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                완료
              </button>
            </div>
          )}

          {/* Mode Selection */}
          {!youtubeInfo && (
            <>
              <div className="mb-6 flex gap-4">
                <button
                  onClick={() => setMode('manual')}
                  className={`flex-1 px-6 py-4 rounded-lg border-2 font-semibold transition-all ${
                    mode === 'manual'
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-purple-400'
                  }`}
                >
                  <div className="text-lg mb-1">📹 수동 입력</div>
                  <div className="text-sm font-normal">기존 YouTube/TikTok URL 입력</div>
                </button>
                <button
                  onClick={() => setMode('youtube-auto')}
                  className={`flex-1 px-6 py-4 rounded-lg border-2 font-semibold transition-all ${
                    mode === 'youtube-auto'
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-red-400'
                  }`}
                >
                  <div className="text-lg mb-1">🚀 YouTube 자동 생성</div>
                  <div className="text-sm font-normal">자동으로 YouTube Live 생성</div>
                </button>
              </div>

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

                  {mode === 'manual' && (
                    <div>
                      <label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-700 mb-2">
                        YouTube & TikTok 라이브 URL *
                      </label>
                      <input
                        id="youtubeUrl"
                        name="youtubeUrl"
                        type="url"
                        value={formData.youtubeUrl}
                        onChange={handleChange}
                        required={mode === 'manual'}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="https://www.youtube.com/watch?v=... 또는 https://www.tiktok.com/@username/video/..."
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        지원 형식: YouTube (일반/라이브/쇼츠), TikTok (일반 영상/라이브)
                      </p>
                    </div>
                  )}

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

                {mode === 'manual' && (
                  <>
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
                  </>
                )}

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
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      mode === 'youtube-auto'
                        ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-700 hover:to-pink-700'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                    }`}
                  >
                    {loading 
                      ? '생성 중...' 
                      : mode === 'youtube-auto'
                        ? '🚀 YouTube Live 생성'
                        : '📹 라이브 시작'}
                  </button>
                </div>
              </form>

              {/* Info Box */}
              {mode === 'manual' && (
                <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">💡 지원되는 영상 형식</h4>
                  <div className="text-sm text-blue-700 space-y-3">
                    <div>
                      <p className="font-semibold mb-1">YouTube:</p>
                      <ul className="space-y-1 list-disc list-inside ml-2">
                        <li>일반 영상: youtube.com/watch?v=VIDEO_ID</li>
                        <li>라이브: youtube.com/live/VIDEO_ID</li>
                        <li>쇼츠: youtube.com/shorts/VIDEO_ID</li>
                        <li>단축 URL: youtu.be/VIDEO_ID</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">TikTok:</p>
                      <ul className="space-y-1 list-disc list-inside ml-2">
                        <li>일반 영상: tiktok.com/@username/video/12345</li>
                        <li>라이브: tiktok.com/@username/live</li>
                        <li>단축 URL: vm.tiktok.com/..., vt.tiktok.com/...</li>
                      </ul>
                    </div>
                    <p className="pt-2 border-t border-blue-200">
                      URL을 복사하여 붙여넣기만 하면 자동으로 인식됩니다
                    </p>
                  </div>
                </div>
              )}

              {mode === 'youtube-auto' && (
                <div className="mt-8 p-4 bg-red-50 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">🚀 YouTube 자동 생성 안내</h4>
                  <div className="text-sm text-red-700 space-y-2">
                    <p>
                      <strong>주의:</strong> YouTube 자동 생성 기능을 사용하려면 관리자가 YouTube API OAuth Token을 설정해야 합니다.
                    </p>
                    <p>
                      설정이 완료되면 자동으로 YouTube Live 방송이 생성되고, OBS 스트리밍에 필요한 스트림 키가 발급됩니다.
                    </p>
                    <p className="pt-2 border-t border-red-200">
                      <strong>설정 방법:</strong> wrangler secret put YOUTUBE_ACCESS_TOKEN
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
