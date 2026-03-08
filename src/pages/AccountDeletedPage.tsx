import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Home } from 'lucide-react';

export default function AccountDeletedPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // 탈퇴 완료 후에는 로그인 페이지 이외의 다른 페이지 접근 차단
    const timer = setTimeout(() => {
      navigate('/', { replace: true });
    }, 10000); // 10초 후 자동으로 홈으로 이동

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {/* 완료 아이콘 */}
          <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* 제목 */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            회원 탈퇴가 완료되었습니다
          </h1>

          {/* 안내 메시지 */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6 text-left">
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              그동안 서비스를 이용해 주셔서 감사합니다.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">
              • 모든 개인정보가 안전하게 삭제되었습니다.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">
              • 30일간 동일한 정보로 재가입이 제한됩니다.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              • 언제든 다시 가입하실 수 있습니다.
            </p>
          </div>

          {/* 재가입 안내 */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
            <p className="text-sm text-purple-800 font-semibold mb-2">
              💡 다시 돌아오고 싶으시다면?
            </p>
            <p className="text-sm text-purple-700 leading-relaxed">
              30일 후 언제든 재가입하실 수 있습니다.
              <br />
              더 나은 서비스로 다시 찾아뵙겠습니다.
            </p>
          </div>

          {/* 홈으로 버튼 */}
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 active:scale-95 transition-all flex items-center justify-center"
          >
            <Home className="w-5 h-5 mr-2" />
            홈으로 이동
          </button>

          <p className="text-xs text-gray-500 mt-4">
            10초 후 자동으로 홈 페이지로 이동합니다.
          </p>
        </div>

        {/* 푸터 메시지 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            서비스 개선을 위한 의견이 있으시다면
            <br />
            <a
              href="mailto:support@ur-team.com"
              className="text-purple-600 hover:text-purple-700 underline"
            >
              support@ur-team.com
            </a>
            으로 연락해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
