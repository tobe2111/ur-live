/**
 * 🚪 로그인 전 탭 화면의 "카카오로 시작하기" — **로그인 화면을 한 번 더 거치지 않는다**.
 *
 * 2026-10-12 대표: *"로그인이 안된 상태에서는 이용권 페이지, 유어샵 페이지, 마이 페이지 모두 들어가면
 * 로그인 페이지만 뜨거든? 그거는 이상적이진 않은 것 같아"* → 게스트 화면(시안 확정).
 * 버튼이 `/login` 으로 보내면 "카카오 버튼을 누르니 또 카카오 버튼" 이 된다. 그래서 여기서 바로 카카오로 간다.
 *
 * 로그인 화면(`LoginPage.handleKakaoLogin`)과 같은 두 갈래를 쓴다:
 *   ① 폰 일반 브라우저 + 미리 준비됨 → 카톡 앱 간편로그인(`startTalkLogin`, 2026-10-11)
 *   ② 그 밖 → 로딩 오버레이 + 서버 OAuth 이동(`/auth/kakao/start?redirect=`)
 * 복귀 주소는 **지금 탭 주소**다 — 로그인하면 그 탭으로 돌아와 진짜 화면이 뜬다.
 *
 * ⚠️ React 상태를 건드리지 않고 동기로 이동한다(2026-05-04 아이폰 사파리 멈춤 사고 — 로그인 화면과 같은 제약).
 */
import { useEffect } from 'react'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { showKakaoLoadingOverlay } from '@/utils/kakao-login-overlay'
import { canUseTalkLogin, scheduleTalkLoginPrepare, startTalkLogin } from '@/lib/kakao-talk-login'

let navigating = false

/** 화면이 뜰 때 카톡 간편로그인을 미리 준비한다(클릭 안에서만 앱을 열 수 있어서). */
export function useGuestLoginPrepare(returnPath: string): void {
  useEffect(() => {
    if (!canUseTalkLogin()) return
    return scheduleTalkLoginPrepare(safeInternalPath(returnPath, '/'))
  }, [returnPath])
}

/** 클릭 핸들러 안에서 부른다. */
export function startGuestKakaoLogin(returnPath: string): void {
  if (navigating) return // 반복 클릭 무시
  navigating = true
  window.setTimeout(() => { navigating = false }, 4000) // 카톡에서 돌아오면(취소 포함) 다시 누를 수 있게
  if (startTalkLogin()) return
  const redirect = safeInternalPath(returnPath, '/')
  showKakaoLoadingOverlay()
  window.location.href = `/auth/kakao/start?${new URLSearchParams({ redirect }).toString()}`
}
