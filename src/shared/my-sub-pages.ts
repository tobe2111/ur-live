/**
 * 👤 마이 하위 화면(주문내역·쿠폰함·내 리뷰·내 숙소 예약·딜 사용 내역·내 단골 가게)의 **경로 → 제목 SSOT** (2026-11-10).
 *
 * 여섯 화면은 같은 머리줄(`SubPageHeader`) 아래에 목록 로더를 두는 같은 모양이다. 라이브 폰 실측으로 첫 글자가 1.7~1.9초(앱 부팅 뒤)였다 →
 * 서버가 **세션 쿠키가 있을 때만** 머리줄 + 로더를 그린다(`worker/utils/notifications-first-screen.ts` `buildMySubFirstScreen` — 알림과 같은 방식).
 * 제목은 화면이 쓰는 한국어 문구와 같아야 한다(다르면 마운트 때 제목 글자가 바뀐다) — 시험이 화면 소스·번역 파일과 대조한다.
 * ⚠️ `/wishlist`·`/my-gifticons` 는 뿌리(`WalletPageWrapper`)가 달라 넣지 않았다.
 */
export const MY_SUB_PAGES = {
  '/my-orders': '주문내역',
  '/orders': '주문내역',
  '/my-coupons': '쿠폰함',
  '/my-reviews': '내 리뷰',
  '/my-stays': '내 숙소 예약',
  '/my-deal-history': '딜 사용 내역',
  '/my/follows': '내 단골 가게',
} as const

/** 마이 하위 화면이면 그 제목, 아니면 null. 끝 슬래시 하나는 같은 화면이다. */
export function mySubPageOf(pathname: string): string | null {
  const p = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  return (MY_SUB_PAGES as Record<string, string>)[p] ?? null
}
