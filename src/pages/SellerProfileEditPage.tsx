import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft,
  Save,
  User,
  Image as ImageIcon,
  MessageSquare,
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react'

interface SellerProfile {
  id: number
  username: string
  name: string
  email: string
  phone?: string
  business_name?: string
  business_number?: string
  profile_image?: string
  bio?: string
  sns_instagram?: string
  sns_youtube?: string
  sns_facebook?: string
  sns_twitter?: string
  website_url?: string
  kakao_chat_link?: string
  status: string
  created_at: string
}

export default function SellerProfileEditPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    profile_image: '',
    bio: '',
    sns_instagram: '',
    sns_youtube: '',
    sns_facebook: '',
    sns_twitter: '',
    website_url: '',
    kakao_chat_link: ''
  })

  useEffect(() => {
    // Check authentication
    const sessionToken = localStorage.getItem('session_token')
    const userType = localStorage.getItem('user_type')
    
    if (!sessionToken || userType !== 'seller') {
      navigate('/seller/login')
      return
    }
    
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const sessionToken = localStorage.getItem('session_token')
      const response = await axios.get('/api/seller/profile', {
        headers: { 'X-Session-Token': sessionToken }
      })

      if (response.data.success) {
        const seller = response.data.data
        setProfile(seller)
        
        // Initialize form with current values
        setFormData({
          profile_image: seller.profile_image || '',
          bio: seller.bio || '',
          sns_instagram: seller.sns_instagram || '',
          sns_youtube: seller.sns_youtube || '',
          sns_facebook: seller.sns_facebook || '',
          sns_twitter: seller.sns_twitter || '',
          website_url: seller.website_url || '',
          kakao_chat_link: seller.kakao_chat_link || ''
        })
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
      setErrorMessage('프로필을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const sessionToken = localStorage.getItem('session_token')
      const response = await axios.patch(
        '/api/seller/profile',
        formData,
        { headers: { 'X-Session-Token': sessionToken } }
      )

      if (response.data.success) {
        setProfile(response.data.data)
        setSuccessMessage('✅ 프로필이 성공적으로 업데이트되었습니다!')
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      setErrorMessage(error.response?.data?.error || '프로필 업데이트에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto mb-4"></div>
          <p className="text-[17px] text-[#6e6e73]">프로필 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <Link 
              to="/seller"
              className="flex items-center space-x-2 text-[#1d1d1f] hover:opacity-60 transition-opacity"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-normal hidden sm:inline">대시보드</span>
            </Link>
            <h1 className="text-[17px] font-semibold text-[#1d1d1f]">
              프로필 편집
            </h1>
            <div className="w-10" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[980px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-[#34c759]/10 border border-[#34c759]/30 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#34c759] flex-shrink-0" />
            <p className="text-[15px] text-[#34c759] font-medium">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[#ff3b30] flex-shrink-0" />
            <p className="text-[15px] text-[#ff3b30] font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Public Page Preview */}
        {profile && (
          <div className="mb-8 apple-card p-6 bg-gradient-to-r from-[#007aff]/5 to-[#5856d6]/5 border-2 border-[#007aff]/20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <ExternalLink className="h-5 w-5 text-[#007aff]" />
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
                    공개 페이지 미리보기
                  </h3>
                </div>
                <p className="text-[13px] text-[#6e6e73] mb-3">
                  변경사항을 저장하면 공개 페이지에 즉시 반영됩니다
                </p>
                <a
                  href={`/s/${profile.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#007aff] text-white rounded-lg hover:bg-[#0051d5] transition-colors text-[13px] font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  공개 페이지 보기
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Image Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#007aff]/10 rounded-full flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-[#007aff]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">프로필 이미지</h2>
                <p className="text-[13px] text-[#6e6e73]">이미지 URL을 입력하세요</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Image Preview */}
              {formData.profile_image && (
                <div className="flex justify-center">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#e5e5ea]">
                    <img 
                      src={formData.profile_image}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = ''
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
                  이미지 URL
                </label>
                <input
                  type="text"
                  value={formData.profile_image}
                  onChange={(e) => setFormData({ ...formData, profile_image: e.target.value })}
                  placeholder="https://example.com/profile.jpg"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
                <p className="mt-2 text-[11px] text-[#6e6e73]">
                  추천: 정사각형 이미지 (500x500px 이상)
                </p>
              </div>
            </div>
          </div>

          {/* Bio Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#34c759]/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-[#34c759]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">소개</h2>
                <p className="text-[13px] text-[#6e6e73]">자기소개를 입력하세요</p>
              </div>
            </div>

            <div>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="안녕하세요! 저는..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent resize-none"
              />
              <p className="mt-2 text-[11px] text-[#6e6e73] text-right">
                {formData.bio.length}/500
              </p>
            </div>
          </div>

          {/* SNS Links Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#ff3b30]/10 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-[#ff3b30]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">SNS 링크</h2>
                <p className="text-[13px] text-[#6e6e73]">소셜 미디어 계정을 연결하세요</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Instagram */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] mb-2">
                  <Instagram className="h-4 w-4 text-[#e4405f]" />
                  Instagram
                </label>
                <input
                  type="text"
                  value={formData.sns_instagram}
                  onChange={(e) => setFormData({ ...formData, sns_instagram: e.target.value })}
                  placeholder="username 또는 https://instagram.com/username"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
              </div>

              {/* YouTube */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] mb-2">
                  <Youtube className="h-4 w-4 text-[#ff0000]" />
                  YouTube
                </label>
                <input
                  type="text"
                  value={formData.sns_youtube}
                  onChange={(e) => setFormData({ ...formData, sns_youtube: e.target.value })}
                  placeholder="@username 또는 https://youtube.com/@username"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
              </div>

              {/* Facebook */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] mb-2">
                  <Facebook className="h-4 w-4 text-[#1877f2]" />
                  Facebook
                </label>
                <input
                  type="text"
                  value={formData.sns_facebook}
                  onChange={(e) => setFormData({ ...formData, sns_facebook: e.target.value })}
                  placeholder="username 또는 https://facebook.com/username"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
              </div>

              {/* Twitter */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] mb-2">
                  <Twitter className="h-4 w-4 text-[#1da1f2]" />
                  Twitter (X)
                </label>
                <input
                  type="text"
                  value={formData.sns_twitter}
                  onChange={(e) => setFormData({ ...formData, sns_twitter: e.target.value })}
                  placeholder="@username 또는 https://twitter.com/username"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* KakaoTalk Chat Link Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#fee500]/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-[#fee500]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">카카오톡 문의</h2>
                <p className="text-[13px] text-[#6e6e73]">고객 문의를 위한 카카오톡 오픈채팅 링크</p>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={formData.kakao_chat_link}
                onChange={(e) => setFormData({ ...formData, kakao_chat_link: e.target.value })}
                placeholder="https://open.kakao.com/o/..."
                className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
              />
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex gap-2 text-[11px] text-orange-800">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">⚠️ 외부 거래 주의 사항</p>
                    <p>플랫폼 외부에서의 거래는 금지되며, 사기 피해 시 플랫폼은 책임지지 않습니다. 의심스러운 거래는 고객센터(0507-0177-0432)로 즉시 신고해주세요.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Website Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#5856d6]/10 rounded-full flex items-center justify-center">
                <Globe className="h-5 w-5 text-[#5856d6]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">웹사이트</h2>
                <p className="text-[13px] text-[#6e6e73]">개인 웹사이트 URL</p>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={formData.website_url}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                placeholder="https://yourwebsite.com"
                className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/seller')}
              className="flex-1 py-4 px-6 bg-white border border-[#e5e5ea] text-[#1d1d1f] rounded-xl hover:bg-[#f5f5f7] transition-colors text-[15px] font-medium"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-4 px-6 bg-[#007aff] text-white rounded-xl hover:bg-[#0051d5] transition-colors text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  변경사항 저장
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
