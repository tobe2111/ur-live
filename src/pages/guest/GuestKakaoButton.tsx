/**
 * 노란 카카오 버튼 — 로그인 전 탭 화면 세 곳이 **이것 하나**를 쓴다(문구만 다르다).
 * 색은 카카오 브랜드 규정값이라 토큰이 아니라 hex 다(로그인 화면 버튼과 같은 값).
 */
import { useTranslation } from '@/lib/i18n-lite'
import { startGuestKakaoLogin, useGuestLoginPrepare } from './guest-login'

export default function GuestKakaoButton({ returnPath, label }: { returnPath: string; label?: string }) {
  const { t } = useTranslation()
  useGuestLoginPrepare(returnPath)
  return (
    <button
      type="button"
      onClick={() => startGuestKakaoLogin(returnPath)}
      className="w-full h-[52px] rounded-xl bg-[#FEE500] text-[#3C1E1E] text-[15px] font-bold flex items-center justify-center gap-2 active:opacity-80"
    >
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z" />
      </svg>
      <span>{label ?? t('guest.kakaoStart', { defaultValue: '카카오로 시작하기' })}</span>
    </button>
  )
}
