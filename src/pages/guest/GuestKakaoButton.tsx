/**
 * 노란 카카오 버튼 — 로그인 전 탭 화면 세 곳이 **이것 하나**를 쓴다(문구만 다르다).
 * 색은 카카오 브랜드 규정값이라 토큰이 아니라 hex 다(로그인 화면 버튼과 같은 값).
 */
import { useTranslation } from '@/lib/i18n-lite'
import { startGuestKakaoLogin, useGuestLoginPrepare } from './guest-login'
import { GUEST_CLS, GUEST_COPY, KAKAO_BUBBLE_PATH } from '@/shared/guest-page'

export default function GuestKakaoButton({ returnPath, label }: { returnPath: string; label?: string }) {
  const { t } = useTranslation()
  useGuestLoginPrepare(returnPath)
  return (
    <button
      type="button"
      onClick={() => startGuestKakaoLogin(returnPath)}
      className={GUEST_CLS.kakao}
    >
      <svg className={GUEST_CLS.kakaoIcon} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d={KAKAO_BUBBLE_PATH} />
      </svg>
      <span>{label ?? t('guest.kakaoStart', { defaultValue: GUEST_COPY.kakaoStart })}</span>
    </button>
  )
}
