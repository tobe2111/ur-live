/**
 * 🏭 2026-06-01 유통스타트 도메인 인식 (Phase 5).
 * live.ur-team.com = 소비자몰 / utongstart.com = 도매몰. 같은 코드·DB, 진입 화면만 분기.
 */

/** 도매몰 도메인 호스트 목록 (서브도메인 포함). */
const WHOLESALE_HOSTS = ['utongstart.com', 'www.utongstart.com']

/** 현재 접속이 유통스타트(도매몰) 도메인인지. SSR/비브라우저 환경에선 false. */
export function isUtongstart(): boolean {
  if (typeof window === 'undefined' || !window.location) return false
  const host = window.location.hostname.toLowerCase()
  if (WHOLESALE_HOSTS.includes(host)) return true
  // 로컬/프리뷰 테스트용 — ?wholesale=1 또는 utongstart 포함 호스트
  if (host.includes('utongstart')) return true
  try {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('wholesale') === '1') return true
  } catch { /* noop */ }
  return false
}
