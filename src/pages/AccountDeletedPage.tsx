import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Home } from 'lucide-react';
import SEO from '@/components/SEO';

export default function AccountDeletedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    // 탈퇴 완료 후에는 로그인 페이지 이외의 다른 페이지 접근 차단
    const timer = setTimeout(() => {
      navigate('/', { replace: true });
    }, 10000); // 10초 후 자동으로 홈으로 이동

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center px-4">
      <SEO title={t('accountDeleted.seoTitle', { defaultValue: '계정 삭제 완료' })} description={t('accountDeleted.seoDesc', { defaultValue: '계정이 삭제되었습니다' })} url="/account/deleted" noindex />
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-lg p-8 text-center">
          {/* 완료 아이콘 */}
          <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* 제목 */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('accountDeleted.title')}
          </h1>

          {/* 안내 메시지 */}
          <div className="bg-gray-50 dark:bg-[#1A1A1A] rounded-xl p-6 mb-6 text-left">
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed mb-3">
              {t('accountDeleted.thanks')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
              • {t('accountDeleted.bullet1')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
              • {t('accountDeleted.bullet2')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              • {t('accountDeleted.bullet3')}
            </p>
          </div>

          {/* 재가입 안내 */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
            <p className="text-sm text-purple-800 font-semibold mb-2">
              {t('accountDeleted.comebackTitle')}
            </p>
            <p className="text-sm text-purple-700 leading-relaxed whitespace-pre-line">
              {t('accountDeleted.comebackBody')}
            </p>
          </div>

          {/* 홈으로 버튼 */}
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 active:scale-95 transition-all flex items-center justify-center"
          >
            <Home className="w-5 h-5 mr-2" />
            {t('accountDeleted.goHome')}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            {t('accountDeleted.autoRedirect')}
          </p>
        </div>

        {/* 푸터 메시지 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('accountDeleted.feedbackPrefix')}
            <br />
            <a
              href="mailto:support@ur-team.com"
              className="text-purple-600 hover:text-purple-700 underline"
            >
              support@ur-team.com
            </a>
            {t('accountDeleted.feedbackSuffix')}
          </p>
        </div>
      </div>
    </div>
  );
}
