import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft,
  User,
  Mail,
  Phone,
  Lock,
  Bell,
  Shield,
  CreditCard,
  MapPin,
  Globe,
  HelpCircle,
  ChevronRight,
  Edit,
} from 'lucide-react';
import { getUserId, getUserIdSync, getUserName, getUserNameSync, getUserEmail } from '@/utils/auth';
import api from '@/lib/api';
import { toast } from '@/hooks/useToast';

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    const loadUserData = async () => {
      const userId = getUserIdSync();
      if (!userId) {
        toast.info('로그인이 필요합니다.');
        navigate('/login');
        return;
      }

      let phone = ''
      try {
        const res = await api.get('/api/auth/me')
        if (res.data.success && res.data.data) {
          phone = res.data.data.phone || ''
        }
      } catch {}
      setUser({
        id: userId,
        name: getUserNameSync() || '사용자',
        email: getUserEmail() || '',
        phone,
      });
    };
    
    loadUserData();
  }, [navigate]);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-700 hover:text-gray-900"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="ml-1">뒤로</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">계정 설정</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 py-6 pb-32">
        {/* 프로필 정보 */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">내 프로필</h2>
            <button className="p-2 hover:bg-white rounded-lg transition-colors">
              <Edit className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 bg-white rounded-xl p-3">
              <User className="w-5 h-5 text-purple-500" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">이름</p>
                <p className="font-medium text-gray-900">{user.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 bg-white rounded-xl p-3">
              <Mail className="w-5 h-5 text-purple-500" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">이메일</p>
                <p className="font-medium text-gray-900">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 bg-white rounded-xl p-3">
              <Phone className="w-5 h-5 text-purple-500" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">전화번호</p>
                <p className="font-medium text-gray-900">{user.phone}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 보안 설정 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">보안</h3>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Lock className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">비밀번호 변경</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">2단계 인증</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">알림</h3>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">푸시 알림 설정</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">이메일 알림 설정</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 결제 및 배송 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">결제 및 배송</h3>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            <Link
              to="/my/addresses"
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">배송지 관리</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">결제 수단 관리</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 기타 설정 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">기타</h3>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">언어 설정</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">한국어</span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
            <Link
              to="/faq"
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <HelpCircle className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">고객센터</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* 약관 및 정책 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">약관 및 정책</h3>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            <Link
              to="/privacy"
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-900">개인정보 처리방침</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link
              to="/terms"
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-900">이용약관</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* 앱 정보 */}
        <div className="mb-12">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">앱 정보</h3>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">버전</span>
              <span className="text-sm font-medium text-gray-900">1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">최신 버전</span>
              <span className="text-sm text-green-600 font-medium">사용 중</span>
            </div>
          </div>
        </div>

        {/* 
          회원 탈퇴 버튼 - 의도적으로 작고 눈에 안 띄게 배치 
          많이 스크롤해야 보임
        */}
        <div className="mb-20 mt-20 pt-8 border-t border-gray-200">
          <div className="text-center">
            <Link
              to="/account/delete-warning"
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              회원 탈퇴
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
