/**
 * 🚫 **핫링크를 막는 사진 호스트** — 우리 도메인 referer 로는 403 이라 Cloudflare 리사이저가 못 받는 곳 (2026-07-21 실측).
 *
 * `cf-image.ts` 는 이 호스트들을 워커 프록시(`/api/image/resize`)로 돌려 **표시는 되지만 리사이즈가 안 된다**(원본 77KB+ 그대로).
 * 근본 해결은 사진을 R2 로 옮겨 담는 것(`cron/demo-image-rehost`) — 2026-09-02 부터 데모뿐 아니라 **실상품**도 이 호스트에
 * 한해 이관한다(대표 "모두 다 진행" — 로딩 후속 ③). 실측상 오늘 실상품 중 해당 사진은 0건(전부 KT 교환권 CDN)이라 미래 대비다.
 *
 * ⚠️ `cf-image.ts` 안의 인라인 목록과 **같아야 한다** — 잠금 파일이라 거기서 import 하지 않고, 테스트가 두 목록의 동일성을 지킨다.
 */
export const HOTLINK_BLOCKED_HOSTS = [
  'postfiles.pstatic.net', 'mblogthumb-phinf.pstatic.net', 'dthumb-phinf.pstatic.net', 'blogfiles.pstatic.net',
  'blogpfthumb-phinf.pstatic.net', 'shop-phinf.pstatic.net', 'naverbooking-phinf.pstatic.net',
] as const

export function isHotlinkBlockedUrl(u: string | null | undefined): boolean {
  if (!u) return false
  try { const h = new URL(u).hostname; return HOTLINK_BLOCKED_HOSTS.some((x) => h === x) } catch { return false }
}

/** `(col LIKE '%host1%' OR col LIKE '%host2%' …)` — 후보 조회용. 호스트 문자열에 따옴표가 없음을 목록이 보장한다. */
export function hotlinkBlockedSql(col: string): string {
  return '(' + HOTLINK_BLOCKED_HOSTS.map((h) => `${col} LIKE '%${h}%'`).join(' OR ') + ')'
}
