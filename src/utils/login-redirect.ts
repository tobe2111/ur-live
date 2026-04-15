/**
 * 로그인 필요 시 returnUrl 저장 후 로그인 페이지로 이동
 */
export function redirectToLoginWithReturn(navigate: (path: string) => void) {
  localStorage.setItem('loginReturnUrl', window.location.pathname + window.location.search)
  navigate('/login')
}
