/**
 * 🦦 이용권 공유 카드 주소 SSOT (2026-10-09 대표 "1번 해줘").
 *
 * 카드 주소가 두 군데서 만들어진다 — 서버(상세 페이지 og:image)와 화면(카카오 공유 버튼).
 * 둘이 따로 문자열을 조립하면 판 번호(`?v=`)를 한쪽만 올리는 날이 온다. 카카오는 **주소 단위로**
 * 카드 그림을 캐시하므로, 판 번호가 빠진 쪽은 고친 카드를 배포해도 옛 카드를 계속 내보낸다
 * (에러가 없어서 공유해 본 사람만 안다 — 유어샵 카드가 실제로 그랬다).
 *
 * 카드 디자인(`worker/utils/og-pass-card.ts`)을 바꾸면 PASS_OG_VERSION 을 올릴 것.
 */
export const PASS_OG_VERSION = 1

export function passShareCardUrl(id: number | string, origin = 'https://urdeal.kr'): string {
  return `${origin}/api/og/group-buy/${id}?v=${PASS_OG_VERSION}`
}
