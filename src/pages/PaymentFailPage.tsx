import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { XCircle, Home, RotateCcw } from 'lucide-react'
import SEO from '@/components/SEO'

export default function PaymentFailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // URL 파라미터에서 실패 정보 추출
  const code = searchParams.get('code')
  const message = searchParams.get('message')
  const orderId = searchParams.get('orderId')

  useEffect(() => {
    document.title = t('paymentFail.docTitle')
    // 결제 실패 시 주문은 아직 DB에 생성되지 않은 상태이므로
    // 별도 롤백이 필요하지 않습니다. (주문 생성은 PaymentSuccessPage에서 처리)
  }, [code, message, orderId])

  // 에러 코드에 따른 사용자 친화적 메시지
  // (errorMessages 객체는 한국어 토스 결제 실패 코드 매핑이라 한국어 그대로 유지)
  const getErrorMessage = () => {
    if (!code) return message || t('paymentFail.unknownError')

    const errorMessages: Record<string, string> = {
      'PAY_PROCESS_CANCELED': '사용자가 결제를 취소했습니다.',
      'PAY_PROCESS_ABORTED': '결제 진행 중 오류가 발생했습니다.',
      'REJECT_CARD_COMPANY': '카드사에서 승인을 거부했습니다. 다른 카드로 시도해주세요.',
      'INVALID_CARD_EXPIRATION': '카드 유효기간이 올바르지 않습니다.',
      'INVALID_CARD_INSTALLMENT_PLAN': '할부 개월 수가 올바르지 않습니다.',
      'NOT_ENOUGH_BALANCE': '잔액이 부족합니다.',
      'EXCEED_MAX_CARD_MONTHLY_LIMIT': '월 한도를 초과했습니다.',
      'INVALID_CARD_INSTALLMENT': '할부가 불가능한 카드입니다.',
      'INVALID_STOPPED_CARD': '정지된 카드입니다.',
      'EXCEED_MAX_DAILY_PAYMENT_COUNT': '일일 결제 한도를 초과했습니다.',
      'NOT_SUPPORTED_INSTALLMENT_PLAN_MERCHANT': '해당 가맹점은 할부를 지원하지 않습니다.',
      'UNAPPROVED_ORDER_ID': '승인되지 않은 주문번호입니다.',
      'UNKNOWN_PAYMENT_ERROR': '결제 처리 중 알 수 없는 오류가 발생했습니다.',
      'PROVIDER_ERROR': '결제 서비스 제공자 오류가 발생했습니다.',
      'INVALID_CARD_NUMBER': '카드 번호가 올바르지 않습니다.',
      'INVALID_CARD_LOST_OR_STOLEN': '분실 또는 도난 신고된 카드입니다.',
      'EXCEED_MAX_AMOUNT': '결제 한도를 초과했습니다.',
      'NOT_AVAILABLE_BANK': '은행 점검 시간입니다. 잠시 후 다시 시도해주세요.',
      'INVALID_PASSWORD': '카드 비밀번호가 올바르지 않습니다.',
      'NOT_FOUND_PAYMENT': '결제 정보를 찾을 수 없습니다.',
      'ALREADY_APPROVED_PAYMENT': '이미 승인된 결제입니다.',
      'DUPLICATED_ORDER_ID': '이미 처리된 주문번호입니다. 다시 주문해주세요.',
      'FORBIDDEN_REQUEST': '허용되지 않은 요청입니다.',
      'REJECT_TOSSPAY_INVALID_ACCOUNT': '토스머니 충전에 실패했습니다.',
      'EXCEED_MAX_AUTH_COUNT': '인증 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
      'NOT_AVAILABLE_PAYMENT': '결제가 불가능한 시간대입니다.',
      'INVALID_REJECT_CARD': '카드 승인이 거절되었습니다. 카드사에 문의해주세요.',
      'BELOW_MINIMUM_AMOUNT': '최소 결제 금액 미만입니다.',
      'INVALID_CARD_COMPANY': '유효하지 않은 카드사입니다.',
    }

    return errorMessages[code] || message || t('paymentFail.genericError')
  }

  // 에러 해결 방법 제안
  const getSolution = () => {
    if (!code) return t('paymentFail.genericSolution')

    const solutions: Record<string, string> = {
      'PAY_PROCESS_CANCELED': '다시 결제를 진행하시려면 아래 버튼을 눌러주세요.',
      'REJECT_CARD_COMPANY': '다른 카드를 사용하거나, 카드사에 문의해주세요.',
      'NOT_ENOUGH_BALANCE': '잔액을 확인하신 후 다시 시도해주세요.',
      'EXCEED_MAX_CARD_MONTHLY_LIMIT': '다른 카드를 사용하거나, 다음 달에 다시 시도해주세요.',
      'INVALID_STOPPED_CARD': '다른 카드를 사용해주세요.',
      'INVALID_CARD_LOST_OR_STOLEN': '카드사에 문의하거나 다른 카드를 사용해주세요.',
      'INVALID_PASSWORD': '비밀번호를 확인하신 후 다시 시도해주세요.',
      'NOT_AVAILABLE_BANK': '은행 점검이 끝난 후 다시 시도해주세요.',
      'DUPLICATED_ORDER_ID': '장바구니에서 다시 결제를 시도해주세요.',
      'ALREADY_APPROVED_PAYMENT': '마이페이지에서 주문 내역을 확인해주세요.',
    }

    return solutions[code] || t('paymentFail.fallbackSolution')
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0A0A0A] flex items-center justify-center p-4">
      <SEO title={t('paymentFail.title')} description={t('paymentFail.subtitle')} url="/payment/fail" noindex />
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-8 shadow-lg border border-[#e5e5e7] dark:border-[#2A2A2A]">
          {/* 실패 아이콘 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-3xl font-bold text-[#1d1d1f] dark:text-white mb-2">{t('paymentFail.title')}</h1>
            <p className="text-[#6e6e73] dark:text-gray-400">{t('paymentFail.subtitle')}</p>
          </div>

          {/* 오류 정보 */}
          <div className="space-y-4 mb-8">
            {/* 에러 메시지 */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">{t('paymentFail.errorLabel')}</h3>
              <p className="text-sm text-red-800 dark:text-red-400">{getErrorMessage()}</p>
            </div>

            {/* 해결 방법 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">{t('paymentFail.solutionLabel')}</h3>
              <p className="text-sm text-blue-800 dark:text-blue-400">{getSolution()}</p>
            </div>

            {/* 주문번호 (있는 경우) */}
            {orderId && (
              <div className="bg-[#f5f5f7] dark:bg-[#1A1A1A] rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#6e6e73] dark:text-gray-400">{t('paymentFail.orderNumberLabel')}</span>
                  <span className="text-sm font-semibold text-[#1d1d1f] dark:text-white font-mono">
                    {orderId}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3 mb-6">
            <Button
              onClick={() => navigate('/')}
              className="flex-1 bg-[#f5f5f7] dark:bg-[#2A2A2A] hover:bg-[#e8e8ed] dark:hover:bg-[#3A3A3A] text-[#1d1d1f] dark:text-white h-12 flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4" />
              {t('paymentFail.toHome')}
            </Button>
            <Button
              onClick={() => navigate('/checkout')}
              className="flex-1 bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-12 flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t('paymentFail.retry')}
            </Button>
          </div>

          {/* 고객센터 정보 */}
          <div className="text-center pt-6 border-t border-[#d2d2d7] dark:border-[#2A2A2A]">
            <p className="text-xs text-[#86868b] dark:text-gray-500 mb-2">
              {t('paymentFail.helpHeader')}
            </p>
            <p className="text-sm font-semibold text-[#1d1d1f] dark:text-white mb-1">
              {t('paymentFail.csTitle')}: 0507-0177-0432
            </p>
            <p className="text-xs text-[#86868b] dark:text-gray-500">
              {t('paymentFail.csHours')}
            </p>
          </div>

          {/* 디버그 정보 (개발 환경에서만 표시) */}
          {import.meta.env.DEV && code && (
            <div className="mt-6 p-4 bg-gray-100 dark:bg-[#1A1A1A] rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">디버그 정보 (개발 환경)</p>
              <p className="text-xs font-mono text-gray-800 dark:text-gray-300">
                Code: {code}
              </p>
              {message && (
                <p className="text-xs font-mono text-gray-800 dark:text-gray-300">
                  Message: {message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
