/**
 * 🧭 유어샵 첫 사용 의도 (2026-08-26 대표 — "가입 시 유어샵 들어가면 사장님인지 선택하고, 그에 맞는 UI")
 *
 * ⚠️ **신분이 아니다.** 대표 확정 모델은 "인플루언서 / 대행사 같은 신분으로 사람을 나누지 않고
 *   행위 2개(담기=소개 / 운영=대행)로 말한다" 이다. 여기 저장하는 값은 그 사람이 **무엇인지**가
 *   아니라, 처음 들어온 사람에게 **어느 첫 화면을 보여줄지**를 정하는 힌트일 뿐이다.
 *   - 권한을 주지 않는다(권한은 `seller_operators` · 셀러 승인이 판정한다)
 *   - 나중에 반대쪽을 해도 막지 않는다 — 둘 다 하는 사람이 정상이다
 *
 * 그래서 서버 스키마를 건드리지 않고 localStorage 에 둔다. 기기가 바뀌면 사라지지만,
 * 이 값이 없을 때의 화면(중립 안내)도 정상 동작이라 잃어도 사고가 아니다.
 * ⇒ 이 값을 **권한·정산·노출 판정에 쓰지 말 것.** 첫 화면 안내 전용이다.
 */

export type UrShopIntent = 'seller' | 'curator'

const key = (curatorId: number | string) => `urshop_intent_${curatorId}`

export function getUrShopIntent(curatorId: number | string): UrShopIntent | null {
  try {
    const v = localStorage.getItem(key(curatorId))
    return v === 'seller' || v === 'curator' ? v : null
  } catch {
    return null // 프리렌더·시크릿 모드 — 중립 화면으로 떨어진다(안전한 쪽)
  }
}

export function setUrShopIntent(curatorId: number | string, intent: UrShopIntent): void {
  try {
    localStorage.setItem(key(curatorId), intent)
  } catch {
    /* 저장 못 해도 진행에 지장 없음 — 중립 화면이 폴백 */
  }
}
