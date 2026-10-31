/**
 * 🔗 에이전시 매장 초대 링크의 **카드 문구** 단일 소스 (2026-10-31 대표 *"모두 진행해줘"*)
 *
 * 같은 링크가 두 길로 카톡방에 닿는다.
 *   ① 에이전시가 [카카오톡으로 보내기] 를 누른다 → 우리가 카드를 지정한다(`AgencyInviteLinkCard`).
 *   ② 링크를 복사해 붙인다 → 카카오 스크래퍼가 **서버 메타**로 카드를 만든다(워커 `STOREINVITE` 슬롯).
 * 두 벌이면 같은 링크가 보내는 방법에 따라 다른 말을 하고, 에러는 안 난다. 그래서 문구를 여기 한 곳에 둔다.
 *
 * 🩸 왜 만들었나(실측): ②로 붙이면 **유어딜 홈 카드**("유어딜 - 돈버는 쇼핑…")가 그대로 떴다 —
 *   어느 에이전시가 보낸 링크인지 카드 어디에도 없어 사장님에게 광고 링크처럼 보였다.
 *
 * 순수 모듈 — 워커와 브라우저가 같이 읽는다(import 0).
 */

export const STORE_INVITE_PATH_RE = /^\/store\/agency\/([0-9a-f]{64})$/

/** 에이전시 이름 → 카드 제목. 이름이 비면 일반 문구(추측해서 이름을 지어내지 않는다). */
export function storeInviteCardTitle(agencyName: string | null | undefined): string {
  const n = (agencyName || '').trim().slice(0, 40)
  return n ? `${n} 에이전시가 매장 운영을 맡겠다고 해요` : '에이전시가 매장 운영을 맡겠다고 해요'
}

export const STORE_INVITE_CARD_DESCRIPTION =
  '링크를 열어 맡길 매장을 고르면 바로 시작돼요. 정산 계좌와 사업자 정보는 사장님께 남고, 언제든 끊을 수 있어요.'

export const STORE_INVITE_CARD_BUTTON = '맡길 매장 고르기'
