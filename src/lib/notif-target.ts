/**
 * 🔔 판매 알림의 링크를 어떻게 열까 (2026-10-12) — 마이(`StoreNotifications`)와 에이전시 콘솔이 같이 쓴다.
 *   셀러 화면이면 시트, 그 밖의 앱 주소면 이동, 없거나 외부 주소면 아무것도 하지 않는다(열린 리다이렉트 차단).
 */
export function notifTarget(link: string | null): { kind: 'sheet' | 'go'; path: string } | null {
  if (!link || !link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return null
  return link.startsWith('/seller/') || link === '/seller' ? { kind: 'sheet', path: link } : { kind: 'go', path: link }
}
