import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  Package,
  Loader2,
  Image as ImageIcon,
  DollarSign,
  Box,
  FileText,
  Play,
  Upload,
  X
} from 'lucide-react'

interface LiveStream {
  id: number
  title: string
  status: string
}

export default function SellerProductNewPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    image_url: '',
    live_stream_id: ''
  })

  useEffect(() => {
    // Check authentication
    const sessionToken = localStorage.getItem('session_token')
    const userType = localStorage.getItem('user_type')
    
    if (!sessionToken || userType !== 'seller') {
      navigate('/seller/login')
      return
    }
    
    loadLiveStreams()
  }, [])

  async function loadLiveStreams() {
    try {
      const sessionToken = localStorage.getItem('session_token')

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      // Note: You may need to create this API endpoint
      const response = await axios.get('/api/seller/streams', {
        headers: { 'X-Session-Token': sessionToken }
      })

      if (response.data.success) {
        setLiveStreams(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load live streams:', error)
      // Continue without live streams
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const sessionToken = localStorage.getItem('session_token')

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        stock: Number(formData.stock),
        image_url: formData.image_url,
        live_stream_id: formData.live_stream_id ? Number(formData.live_stream_id) : null
      }

      const response = await axios.post('/api/seller/products', payload, {
        headers: { 'X-Session-Token': sessionToken }
      })

      if (response.data.success) {
        alert('상품이 등록되었습니다.')
        navigate('/seller/products')
      }
    } catch (error: any) {
      console.error('Failed to create product:', error)
      setError(error.response?.data?.error || '상품 등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('JPEG, PNG, WebP, GIF 파일만 업로드 가능합니다')
      return
    }

    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB 이하여야 합니다')
      return
    }

    setUploading(true)
    setError('')
    setUploadProgress(0)

    try {
      const formDataObj = new FormData()
      formDataObj.append('file', file)

      const response = await axios.post('/api/upload', formDataObj, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(percent)
          }
        }
      })

      if (response.data.success) {
        // 업로드 성공 - URL 설정
        const uploadedUrl = `${window.location.origin}${response.data.data.url}`
        setFormData({
          ...formData,
          image_url: uploadedUrl
        })
      }
    } catch (error: any) {
      console.error('Failed to upload file:', error)
      setError(error.response?.data?.error || '파일 업로드에 실패했습니다')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  function clearImage() {
    setFormData({
      ...formData,
      image_url: ''
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/seller/products')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>상품 목록으로 돌아가기</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">상품 등록</h1>
          </div>
          <p className="text-gray-600 mt-2">
            새로운 상품을 등록하고 라이브 스트림에 연결할 수 있습니다.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <Package className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="예: 프리미엄 무선 이어폰"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 설명
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="상품에 대한 자세한 설명을 입력해주세요"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Price & Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                판매가격 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="30000"
                  required
                  min="0"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">원 단위로 입력해주세요</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                재고 수량 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  placeholder="100"
                  required
                  min="0"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">개 단위로 입력해주세요</p>
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 이미지
            </label>
            
            {/* File Upload Section */}
            <div className="mb-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  {uploading ? (
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin mb-3" />
                      <p className="text-sm text-gray-600">업로드 중... {uploadProgress}%</p>
                      <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="text-blue-600 font-medium">클릭하여 파일 선택</span> 또는 드래그 앤 드롭
                      </p>
                      <p className="text-xs text-gray-500">
                        JPEG, PNG, WebP, GIF (최대 10MB)
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* OR Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-sm text-gray-500">또는</span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            {/* URL Input */}
            <div className="relative">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={uploading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">이미지 URL을 직접 입력할 수도 있습니다</p>
          </div>

          {/* Image Preview */}
          {formData.image_url && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">이미지 미리보기</p>
                <button
                  type="button"
                  onClick={clearImage}
                  className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  제거
                </button>
              </div>
              <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden border">
                <img
                  src={formData.image_url}
                  alt="상품 미리보기"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/128'
                  }}
                />
              </div>
            </div>
          )}

          {/* Live Stream Selection */}
          {liveStreams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                라이브 스트림 연결 (선택)
              </label>
              <div className="relative">
                <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  name="live_stream_id"
                  value={formData.live_stream_id}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                >
                  <option value="">라이브 스트림을 선택하세요 (선택사항)</option>
                  {liveStreams.map((stream) => (
                    <option key={stream.id} value={stream.id}>
                      {stream.title} ({stream.status === 'live' ? 'LIVE' : stream.status === 'scheduled' ? '예정' : '종료'})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">특정 라이브 스트림에서 판매할 상품인 경우 선택하세요</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 border-t">
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => navigate('/seller/products')}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    등록 중...
                  </span>
                ) : (
                  '상품 등록'
                )}
              </Button>
            </div>
          </div>

          {/* Help Text */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">안내사항</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>상품명과 가격, 재고는 필수 입력 항목입니다.</li>
                  <li>상품 등록 후 언제든지 수정할 수 있습니다.</li>
                  <li>라이브 스트림은 나중에도 연결할 수 있습니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
