import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  Trash2,
  Gift,
  ChevronLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { getUserId, logout as authLogout } from '@/utils/auth';
import { DELETE_ACCOUNT_WARNINGS } from '@/features/account/types/delete-account.types';
import api from '@/lib/api';
import { toast } from '@/hooks/useToast';

export default function AccountDeleteWarningPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToDataDeletion, setAgreedToDataDeletion] = useState(false);
  const [agreedToLoseBenefits, setAgreedToLoseBenefits] = useState(false);
  const [agreedToNoRefund, setAgreedToNoRefund] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const userId = await getUserId();
      if (!userId) {
        toast.info('로그인이 필요합니다.');
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    // 스크롤 감지
    const handleScroll = () => {
      const scrollPercentage =
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercentage > 30) {
        setShowScrollHint(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const canProceed =
    agreedToDataDeletion &&
    agreedToLoseBenefits &&
    agreedToNoRefund &&
    confirmText === '회원탈퇴';

  const handleProceedToDelete = async () => {
    if (!canProceed) {
      toast.error('모든 동의 항목을 체크하고 "회원탈퇴"를 정확히 입력해주세요.');
      return;
    }

    const finalConfirm = confirm(
      '정말로 탈퇴하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 영구 삭제됩니다.'
    );

    if (!finalConfirm) {
      return;
    }

    setIsLoading(true);

    try {
      const userId = await getUserId();
      if (!userId) {
        throw new Error('사용자 ID를 찾을 수 없습니다.');
      }

      // ✅ API 인스턴스 사용 (자동으로 Authorization 헤더 추가됨)
      // Note: userId는 서버에서 requireAuth 미들웨어를 통해 자동으로 추출되므로
      // body에 포함하지 않아도 되지만, 호환성을 위해 유지
      const response = await api.delete('/api/account/delete');

      if (!response.data.success) {
        throw new Error(response.data.error || response.data.message || '탈퇴 처리에 실패했습니다.');
      }

      // 로그아웃 처리
      await authLogout();

      // 탈퇴 완료 페이지로 이동
      navigate('/account/deleted', { replace: true });
    } catch (error: any) {
      console.error('[Account Delete] 탈퇴 실패:', error);

      // Axios 에러 처리
      let errorMessage = '탈퇴 처리 중 오류가 발생했습니다.';
      
      if (error.response?.status === 401) {
        errorMessage = '인증이 만료되었습니다. 다시 로그인한 후 시도해주세요.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      
      // 401 에러인 경우 로그인 페이지로 리다이렉트
      if (error.response?.status === 401) {
        setTimeout(() => {
          navigate('/login');
        }, 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getWarningIcon = (icon: string) => {
    switch (icon) {
      case 'trash':
        return <Trash2 className="w-6 h-6 text-red-500" />;
      case 'gift':
        return <Gift className="w-6 h-6 text-orange-500" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
    }
  };

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
            <h1 className="text-lg font-semibold text-gray-900">회원 탈퇴</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Scroll Hint */}
      {showScrollHint && (
        <div className="sticky top-16 z-30 bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <p className="text-sm text-yellow-800 text-center">
            ⬇️ 아래로 스크롤하여 주의사항을 모두 확인해주세요
          </p>
        </div>
      )}

      <main className="w-full px-4 sm:px-6 py-8 pb-32">
        {/* 경고 배너 */}
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-8">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-red-900 mb-2">
                정말 탈퇴하시겠습니까?
              </h2>
              <p className="text-red-700 leading-relaxed">
                회원 탈퇴 시 아래 내용을 반드시 확인해주세요. 
                탈퇴 후에는 되돌릴 수 없습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 주의사항 상세 */}
        <div className="space-y-6 mb-8">
          <h3 className="text-lg font-bold text-gray-900">⚠️ 탈퇴 시 유의사항</h3>

          {DELETE_ACCOUNT_WARNINGS.map((warning, index) => (
            <div
              key={warning.id}
              className="bg-gray-50 border border-gray-200 rounded-xl p-5"
            >
              <div className="flex items-start space-x-3 mb-3">
                {getWarningIcon(warning.icon)}
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {index + 1}. {warning.title}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {warning.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 추가 경고 - 더 상세한 내용 */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-8">
          <h4 className="font-semibold text-orange-900 mb-3">
            📋 삭제되는 정보 상세
          </h4>
          <ul className="space-y-2 text-sm text-orange-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>모든 주문 내역 및 배송 정보</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>찜한 상품, 장바구니, 최근 본 상품</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>적립 포인트 및 사용 가능한 쿠폰</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>멤버십 등급 및 누적 구매 혜택</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>작성한 리뷰, 문의, 1:1 상담 내역</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>등록한 배송지 및 결제 수단 정보</span>
            </li>
          </ul>
        </div>

        {/* 재가입 제한 안내 */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-8">
          <h4 className="font-semibold text-purple-900 mb-3">
            🚫 재가입 제한 안내
          </h4>
          <p className="text-sm text-purple-800 leading-relaxed mb-2">
            탈퇴 후 <strong>30일간</strong> 동일한 이메일 및 전화번호로 재가입할 수 없습니다.
          </p>
          <p className="text-sm text-purple-800 leading-relaxed">
            재가입 시에도 기존의 <strong>포인트, 쿠폰, 등급, 주문내역</strong>은 복구되지 않습니다.
          </p>
        </div>

        {/* 환불 불가 안내 */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-8">
          <h4 className="font-semibold text-red-900 mb-3">
            💰 환불 및 취소 불가 안내
          </h4>
          <p className="text-sm text-red-800 leading-relaxed mb-2">
            탈퇴 후에는 <strong>진행 중인 주문의 취소 및 환불이 불가능</strong>합니다.
          </p>
          <p className="text-sm text-red-800 leading-relaxed">
            배송 중이거나 배송 완료된 상품은 탈퇴 후 반품/교환 처리가 어려울 수 있습니다.
          </p>
        </div>

        {/* 동의 체크박스 */}
        <div className="bg-white border-2 border-gray-300 rounded-xl p-6 mb-6">
          <h4 className="font-semibold text-gray-900 mb-4">
            ✅ 다음 사항을 모두 확인하였으며 동의합니다
          </h4>

          <div className="space-y-4">
            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToDataDeletion}
                onChange={(e) => setAgreedToDataDeletion(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900">
                회원 탈퇴 시 모든 데이터가 영구 삭제되며 복구할 수 없음을 이해했습니다.
              </span>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToLoseBenefits}
                onChange={(e) => setAgreedToLoseBenefits(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900">
                포인트, 쿠폰, 등급 등 모든 혜택을 잃게 되며 재가입 시에도 복구되지 않음을 이해했습니다.
              </span>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToNoRefund}
                onChange={(e) => setAgreedToNoRefund(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900">
                탈퇴 후 진행 중인 주문의 취소/환불이 어려울 수 있으며, 30일간 재가입이 제한됨을 이해했습니다.
              </span>
            </label>
          </div>
        </div>

        {/* 최종 확인 입력 */}
        <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 mb-8">
          <h4 className="font-semibold text-gray-900 mb-3">
            🔐 최종 확인
          </h4>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            정말로 탈퇴하시려면 아래 입력란에{' '}
            <strong className="text-red-600">"회원탈퇴"</strong>를 정확히 입력해주세요.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="회원탈퇴 (정확히 입력)"
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 ${
              confirmText === '회원탈퇴'
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-purple-500 focus:ring-purple-200'
            }`}
          />
          {confirmText && confirmText !== '회원탈퇴' && (
            <p className="text-sm text-red-500 mt-2 font-medium">
              ⚠️ 정확히 "회원탈퇴"를 입력해주세요. (현재: "{confirmText}")
            </p>
          )}
          {confirmText === '회원탈퇴' && (
            <p className="text-sm text-green-600 mt-2 flex items-center font-medium">
              <CheckCircle2 className="w-4 h-4 mr-1" />
              확인되었습니다.
            </p>
          )}
        </div>

        {/* 안내 메시지 */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500 leading-relaxed">
            탈퇴를 원하지 않으신다면 언제든지 뒤로가기를 눌러주세요.
            <br />
            저희 서비스를 계속 이용해주시면 감사하겠습니다. ❤️
          </p>
        </div>
      </main>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="mx-auto max-w-md px-4 py-4 space-y-3">
          <button
            onClick={handleProceedToDelete}
            disabled={!canProceed || isLoading}
            className={`w-full py-4 rounded-xl font-semibold transition-all ${
              canProceed && !isLoading
                ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                탈퇴 처리 중...
              </span>
            ) : (
              '정말 탈퇴하기'
            )}
          </button>

          <button
            onClick={() => navigate('/account/settings')}
            disabled={isLoading}
            className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 active:scale-95 transition-all"
          >
            취소하고 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
