import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Gift,
  Star,
  TrendingUp,
  ChevronLeft,
  Loader2,
  Sparkles,
  ShoppingBag,
  Crown,
} from 'lucide-react';
import { getUserId, logout as authLogout } from '@/utils/auth';
import { USER_RETENTION_OFFERS } from '@/features/account/types/delete-account.types';

export default function AccountDeleteFinalPage() {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
  }, [navigate]);

  // 최종 확인 카운트다운
  useEffect(() => {
    if (showFinalConfirm && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [showFinalConfirm, countdown]);

  const handleFinalDelete = async () => {
    if (countdown > 0) {
      alert(`${countdown}초 후에 탈퇴가 가능합니다. 잠시만 기다려주세요.`);
      return;
    }

    const finalConfirm = confirm(
      '정말로 탈퇴하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 영구 삭제됩니다.'
    );

    if (!finalConfirm) {
      return;
    }

    setIsDeleting(true);

    try {
      // TODO: 실제 탈퇴 API 호출
      // await api.delete('/api/users/me');

      // 임시: 3초 대기 후 처리
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 로그아웃 처리
      authLogout();

      // 탈퇴 완료 페이지로 이동
      navigate('/account/deleted', { replace: true });
    } catch (error) {
      console.error('Account deletion failed:', error);
      alert('탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStayWithBenefit = () => {
    alert('감사합니다! 🎉\n10,000원 쿠폰이 발급되었습니다.');
    navigate('/my');
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-700 hover:text-gray-900"
              disabled={isDeleting}
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="ml-1">뒤로</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">마지막 확인</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 py-8 pb-32">
        {/* 감정적 호소 */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
            <Heart className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            정말로 떠나시나요?
          </h2>
          <p className="text-gray-600 leading-relaxed">
            함께한 시간이 소중했습니다.
            <br />
            떠나시기 전, 특별한 혜택을 확인해주세요.
          </p>
        </div>

        {/* 특별 혜택 안내 */}
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-2xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200 rounded-full blur-3xl opacity-30"></div>
          <div className="relative">
            <div className="flex items-center mb-4">
              <Sparkles className="w-6 h-6 text-yellow-500 mr-2" />
              <h3 className="text-xl font-bold text-gray-900">🎁 특별 혜택</h3>
            </div>

            <div className="bg-white rounded-xl p-5 mb-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <Gift className="w-8 h-8 text-purple-500 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 text-lg mb-2">
                    즉시 사용 가능한 10,000원 쿠폰
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    지금 탈퇴를 취소하시면 바로 사용할 수 있는 할인 쿠폰을 드립니다.
                  </p>
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
                    <p className="text-purple-800 font-semibold text-center">
                      💰 10,000원 즉시 할인
                    </p>
                    <p className="text-xs text-purple-600 text-center mt-1">
                      유효기간: 30일 | 최소 주문 금액 없음
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleStayWithBenefit}
              disabled={isDeleting}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-lg hover:from-purple-600 hover:to-pink-600 active:scale-95 transition-all shadow-lg"
            >
              🎉 쿠폰 받고 계속 이용하기
            </button>
          </div>
        </div>

        {/* 잃게 될 혜택들 */}
        <div className="space-y-4 mb-8">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-red-500" />
            탈퇴 시 잃게 되는 혜택
          </h3>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start space-x-3">
              <Star className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">
                  보유 포인트: 15,000P
                </h4>
                <p className="text-sm text-gray-600">
                  현재 사용 가능한 포인트가 있습니다. 탈퇴 시 모두 소멸됩니다.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100"></div>

            <div className="flex items-start space-x-3">
              <Crown className="w-6 h-6 text-purple-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">
                  VIP 등급 혜택
                </h4>
                <p className="text-sm text-gray-600">
                  누적 구매 금액으로 획득한 VIP 등급과 추가 할인 혜택이 사라집니다.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100"></div>

            <div className="flex items-start space-x-3">
              <ShoppingBag className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">
                  사용 가능한 쿠폰 3장
                </h4>
                <p className="text-sm text-gray-600">
                  발급받은 쿠폰들이 모두 소멸되며 재가입 시에도 복구되지 않습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 통계 정보 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8">
          <h3 className="text-base font-semibold text-gray-900 mb-4 text-center">
            📊 함께한 시간
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">127</p>
              <p className="text-xs text-gray-600 mt-1">구매한 상품</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-pink-600">48</p>
              <p className="text-xs text-gray-600 mt-1">작성한 리뷰</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">365</p>
              <p className="text-xs text-gray-600 mt-1">함께한 날</p>
            </div>
          </div>
        </div>

        {/* 최종 확인 버튼 영역 */}
        {!showFinalConfirm ? (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              그래도 탈퇴를 원하신다면 아래 버튼을 눌러주세요.
            </p>
            <button
              onClick={() => setShowFinalConfirm(true)}
              disabled={isDeleting}
              className="px-6 py-3 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              그래도 탈퇴하기
            </button>
          </div>
        ) : (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
            <h4 className="font-semibold text-red-900 mb-3 text-center">
              ⚠️ 마지막 확인
            </h4>
            <p className="text-sm text-red-700 mb-4 text-center leading-relaxed">
              정말로 탈퇴하시겠습니까?
              <br />
              {countdown > 0 ? (
                <span className="font-bold text-lg">
                  {countdown}초 후에 탈퇴가 가능합니다...
                </span>
              ) : (
                <span className="font-bold text-red-900">
                  이제 탈퇴할 수 있습니다.
                </span>
              )}
            </p>
            <button
              onClick={handleFinalDelete}
              disabled={countdown > 0 || isDeleting}
              className={`w-full py-3 rounded-xl font-semibold transition-all ${
                countdown === 0 && !isDeleting
                  ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isDeleting ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  탈퇴 처리 중...
                </span>
              ) : countdown > 0 ? (
                `${countdown}초 대기 중...`
              ) : (
                '정말로 탈퇴하기'
              )}
            </button>
          </div>
        )}
      </main>

      {/* 하단 고정 버튼 (showFinalConfirm 이 false 일 때만) */}
      {!showFinalConfirm && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="mx-auto max-w-md px-4 py-4">
            <button
              onClick={() => navigate('/my')}
              disabled={isDeleting}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-lg hover:from-purple-600 hover:to-pink-600 active:scale-95 transition-all shadow-lg"
            >
              💜 역시 계속 이용할래요!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
