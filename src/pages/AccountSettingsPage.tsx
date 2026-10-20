/**
 * 🛡️ 2026-05-24: /account/settings 페이지 → /user/profile 로 통합.
 *   사용자 요청: "중복되어서 필요없는 게 많네. /user/profile 페이지로 합쳐줘".
 *
 *   이전 콘텐츠 (알림 설정 / 프로필 편집 모달 / 앱 버전 / 계정 탈퇴 / 약관 링크) 는
 *   UserProfilePage 와 AccountControlsSection 으로 모두 이전됨.
 *
 *   이 파일은 hash bookmark / 외부 링크 호환성 위해 redirect 만 수행.
 */
import { Navigate } from 'react-router-dom'

export default function AccountSettingsPage() {
  return <Navigate to="/user/profile" replace />
}
