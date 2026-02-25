import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import MobileFooter from '@/components/MobileFooter'
import { 
  User, 
  MapPin, 
  Package, 
  Settings, 
  LogOut, 
  ChevronRight,
  Mail,
  Phone
} from 'lucide-react'
import { getUserId, getUserName, getUserEmail, logout as authLogout } from '@/utils/auth'

export default function MyPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState({
    id: '',
    name: '',
    email: ''
  })

  useEffect(() => {
    const userId = getUserId()
    if (!userId) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    setUser({
      id: userId,
      name: getUserName() || '사용자',
      email: getUserEmail() || ''
    })
  }, [navigate])

  const handleLogout = () => {
    if (confirm('로그아웃하시겠습니까?')) {
      authLogout()
      alert('로그아웃되었습니다.')
      navigate('/')
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#FFFFFF]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-bold text-gray-900">
              ← 홈
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">마이페이지</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 py-8">
        {/* 프로필 카드 */}
        <div className="bg-gradient-to-br from-[#FFD700]/20 to-[#9370DB]/20 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md">
              <User className="w-10 h-10 text-[#9370DB]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              {user.email && (
                <div className="flex items-center text-sm text-gray-600 mt-1">
                  <Mail className="w-4 h-4 mr-1" />
                  {user.email}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 메뉴 리스트 */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 mb-6">
          {/* 배송지 관리 */}
          <Link 
            to="/mypage/addresses" 
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#FFD700]/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#FFA500]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">배송지 관리</h3>
                <p className="text-sm text-gray-500">배송받을 주소를 관리하세요</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>

          {/* 주문 내역 */}
          <Link 
            to="/my-orders" 
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#9370DB]/20 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-[#9370DB]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">주문 내역</h3>
                <p className="text-sm text-gray-500">구매한 상품을 확인하세요</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>

          {/* 고객센터 */}
          <a 
            href="tel:0507-0177-0432" 
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">고객센터</h3>
                <p className="text-sm text-gray-500">0507-0177-0432</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </a>
        </div>

        {/* 설정 */}
        <div className="bg-white rounded-2xl shadow-sm mb-6">
          <Link 
            to="/terms" 
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-t-2xl border-b border-gray-100"
          >
            <span className="text-gray-700">이용약관</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          <Link 
            to="/privacy" 
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <span className="text-gray-700">개인정보 처리방침</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          <Link 
            to="/shipping-policy" 
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-b-2xl"
          >
            <span className="text-gray-700">배송 정책</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </div>

        {/* 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 p-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">로그아웃</span>
        </button>

        {/* 버전 정보 - 제거하고 Footer로 대체 */}
      </main>

      {/* Mobile Footer */}
      <MobileFooter />
    </div>
  )
}
