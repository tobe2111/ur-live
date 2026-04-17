import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function SellerStreamNewPage() {
  const { t } = useTranslation()
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
  const [createdStreamId, setCreatedStreamId] = useState<number | null>(null)
  const [myProducts, setMyProducts] = useState<{ id: number; name: string; price: number }[]>([])
  const [linkedProductIds, setLinkedProductIds] = useState<Set<number>>(new Set())
  const [linkingProducts, setLinkingProducts] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('seller_token')
    if (!token) return
    api.get('/api/seller/products?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.data.success) setMyProducts(r.data.data || []) })
      .catch(() => {})
  }, [])

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
        setError(t('common.loginRequired'))
        navigate('/seller/login')
        return
      }

      if (mode === 'youtube-auto') {
        const response = await api.post('/api/seller/youtube/live/create', {
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
          toast.success(t('seller.youtubeAutoCreated'))
        } else {
          setError(response.data.error || t('seller.creationFailed'))
        }
      } else {
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
          toast.success(t('seller.streamCreated'))
          const streamId = response.data.data?.id
          if (streamId) {
            setCreatedStreamId(streamId)
          } else {
            navigate('/seller')
          }
        } else {
          setError(response.data.error || t('seller.creationFailed'))
        }
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string };
      console.error('Stream creation error:', err)
      console.error('Error response:', err_.response?.data)
      const errorMessage = err_.response?.data?.error || err_.response?.data?.message || err_.message || t('seller.creationFailed')
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function goBack() {
    navigate('/seller')
  }

  function toggleProduct(id: number) {
    setLinkedProductIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function linkProductsAndFinish() {
    if (!createdStreamId) { navigate('/seller'); return }
    if (linkedProductIds.size === 0) { navigate('/seller'); return }
    setLinkingProducts(true)
    const token = localStorage.getItem('seller_token')
    try {
      await Promise.all(
        Array.from(linkedProductIds).map(pid =>
          api.post(`/api/seller/products/${pid}/link-to-stream`,
            { stream_id: createdStreamId },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      )
      toast.success(t('seller.productsLinkedSuccess', { count: linkedProductIds.size }))
    } catch {
      toast.error(t('seller.productsLinkFailed'))
    } finally {
      setLinkingProducts(false)
      navigate('/seller')
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(t('seller.labelCopied', { label }))
  }

  // Product linking step (after stream creation)
  if (createdStreamId !== null) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-lg">
          <h2 className="text-lg font-bold text-gray-900 mb-1">{t('seller.linkProductsToStream')}</h2>
          <p className="text-sm text-gray-500 mb-5">{t('seller.selectProductsForStream')}</p>
          {myProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('seller.noRegisteredProductsMsg')}</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto mb-5">
              {myProducts.map(p => (
                <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${linkedProductIds.has(p.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={linkedProductIds.has(p.id)}
                    onChange={() => toggleProduct(p.id)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.price.toLocaleString()}{t('common.won')}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/seller')}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              {t('seller.skip')}
            </button>
            <button
              onClick={linkProductsAndFinish}
              disabled={linkingProducts || linkedProductIds.size === 0}
              className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {linkingProducts ? t('seller.linkingProducts') : t('seller.linkProductsBtn', { count: linkedProductIds.size })}
            </button>
          </div>
        </div>
      </div>
    )
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
              &larr; {t('seller.goBack')}
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{t('seller.createStream')}</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          {/* YouTube Info Display */}
          {youtubeInfo && (
            <div className="mb-8 p-6 bg-green-50 rounded-lg border-2 border-green-200">
              <h3 className="text-xl font-bold text-green-900 mb-4">
                {t('seller.youtubeCreatedTitle')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-green-900 mb-2">
                    {t('seller.watchUrlLabel')}:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={youtubeInfo.watchUrl}
                      readOnly
                      className="flex-1 px-4 py-2 bg-white border border-green-300 rounded-lg"
                    />
                    <button
                      onClick={() => copyToClipboard(youtubeInfo.watchUrl, t('seller.watchUrlLabel'))}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      {t('seller.copyBtn')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-green-900 mb-2">
                    {t('seller.streamKeyObs')}:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={youtubeInfo.streamKey}
                      readOnly
                      className="flex-1 px-4 py-2 bg-white border border-green-300 rounded-lg font-mono text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(youtubeInfo.streamKey, t('seller.streamKeyObs'))}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      {t('seller.copyBtn')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-green-900 mb-2">
                    {t('seller.streamUrlObs')}:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={youtubeInfo.streamUrl}
                      readOnly
                      className="flex-1 px-4 py-2 bg-white border border-green-300 rounded-lg font-mono text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(youtubeInfo.streamUrl, t('seller.streamUrlObs'))}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      {t('seller.copyBtn')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">{t('seller.obsSetupGuide')}:</h4>
                <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
                  <li>{t('seller.obsStep1')}</li>
                  <li>{t('seller.obsStep2')}</li>
                  <li>{t('seller.obsStep3')}</li>
                  <li>{t('seller.obsStep4')}</li>
                  <li>{t('seller.obsStep5')}</li>
                </ol>
              </div>

              <div className="mt-3 p-4 bg-white rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-900 mb-2">{t('seller.prismGuide')}:</h4>
                <ol className="text-sm text-purple-800 space-y-1 list-decimal list-inside">
                  <li>{t('seller.prismStep1')}</li>
                  <li>{t('seller.prismStep2')}</li>
                  <li>{t('seller.prismStep3')}</li>
                  <li>{t('seller.prismStep4')}</li>
                  <li>{t('seller.prismStep5')}</li>
                </ol>
                <div className="mt-2 p-2 bg-purple-50 rounded text-xs text-purple-700">
                  {t('seller.prismBenefits')}
                </div>
              </div>

              <button
                onClick={goBack}
                className="mt-4 w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                {t('seller.doneBtn')}
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
                  <div className="text-lg mb-1">{t('seller.manualInput')}</div>
                  <div className="text-sm font-normal">{t('seller.manualInputDesc')}</div>
                </button>
                <button
                  onClick={() => setMode('youtube-auto')}
                  className={`flex-1 px-6 py-4 rounded-lg border-2 font-semibold transition-all ${
                    mode === 'youtube-auto'
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-red-400'
                  }`}
                >
                  <div className="text-lg mb-1">{t('seller.youtubeAutoCreate')}</div>
                  <div className="text-sm font-normal">{t('seller.youtubeAutoCreateDesc')}</div>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">{t('seller.basicInfo')}</h3>

                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('seller.streamTitle')} *
                    </label>
                    <input
                      id="title"
                      name="title"
                      type="text"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={t('seller.streamTitlePlaceholder')}
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('seller.streamDescription')}
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={t('seller.descPlaceholder')}
                    />
                  </div>

                  {mode === 'manual' && (
                    <div>
                      <label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('seller.youtubeUrlLabel')} *
                      </label>
                      <input
                        id="youtubeUrl"
                        name="youtubeUrl"
                        type="url"
                        value={formData.youtubeUrl}
                        onChange={handleChange}
                        required={mode === 'manual'}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder={t('seller.youtubeTiktokUrlPlaceholder')}
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        {t('seller.supportedFormats')}
                      </p>
                    </div>
                  )}

                  <div>
                    <label htmlFor="scheduledAt" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('seller.scheduledTimeLabel')}
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
                      {t('seller.scheduledTimeHint')}
                    </p>
                  </div>
                </div>

                {mode === 'manual' && (
                  <>
                    <div className="space-y-4 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">{t('seller.snsLinksOptional')}</h3>

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
                          placeholder={t('seller.instagramPlaceholder')}
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
                          placeholder={t('seller.youtubePlaceholder')}
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
                          placeholder={t('seller.facebookPlaceholder')}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {t('common.cancel')}
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
                      ? t('seller.creatingStream')
                      : mode === 'youtube-auto'
                        ? t('seller.createYoutubeLive')
                        : t('seller.startLiveStream')}
                  </button>
                </div>
              </form>

              {/* Info Box */}
              {mode === 'manual' && (
                <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">{t('seller.supportedVideoFormats')}</h4>
                  <div className="text-sm text-blue-700 space-y-3">
                    <div>
                      <p className="font-semibold mb-1">YouTube:</p>
                      <ul className="space-y-1 list-disc list-inside ml-2">
                        <li>youtube.com/watch?v=VIDEO_ID</li>
                        <li>youtube.com/live/VIDEO_ID</li>
                        <li>youtube.com/shorts/VIDEO_ID</li>
                        <li>youtu.be/VIDEO_ID</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">TikTok:</p>
                      <ul className="space-y-1 list-disc list-inside ml-2">
                        <li>tiktok.com/@username/video/12345</li>
                        <li>tiktok.com/@username/live</li>
                        <li>vm.tiktok.com/..., vt.tiktok.com/...</li>
                      </ul>
                    </div>
                    <p className="pt-2 border-t border-blue-200">
                      {t('seller.autoDetectHint')}
                    </p>
                  </div>
                </div>
              )}

              {mode === 'youtube-auto' && (
                <div className="mt-8 p-4 bg-red-50 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">{t('seller.youtubeAutoGuide')}</h4>
                  <div className="text-sm text-red-700 space-y-2">
                    <p>
                      {t('seller.youtubeAutoNote')}
                    </p>
                    <p>
                      {t('seller.youtubeAutoDesc')}
                    </p>
                    <p className="pt-2 border-t border-red-200">
                      <strong>{t('seller.youtubeAutoSetup')}</strong>
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
