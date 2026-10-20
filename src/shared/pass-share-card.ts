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
import { ogCardUrl } from './og-share-image'

export const PASS_OG_VERSION = 1

/**
 * 🖼️ 2026-10-13 대표 확정(결재 2026-10-12-pass-share-card-svg **안 1-가** — *"안 1-가로 하고"*):
 *   사진이 있으면 **1200×630 을 가득 채운 사진 한 장**(유어샵과 같은 `fit=cover,gravity=auto`).
 *   종전 SVG 카드는 트위터·페이스북·슬랙이 그리지 않는다. 글자는 각 서비스가 제목·설명으로 붙인다.
 *   사진이 없을 때만 종전 카드(로고·유달이)로 떨어진다 — 그 라우트는 이미 공유된 링크를 위해 남긴다.
 *   ⚠️ `pad`(여백) 아니다 — 대표가 시안 1-가(가득)와 1-나(여백) 중 가득을 골랐다.
 */
export function passShareCardUrl(id: number | string, origin = 'https://urdeal.kr', photo?: string | null): string {
  return ogCardUrl(photo, origin, { fit: 'cover' }) || `${origin}/api/og/group-buy/${id}?v=${PASS_OG_VERSION}`
}
