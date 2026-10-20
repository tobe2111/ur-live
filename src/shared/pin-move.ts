/**
 * 📍 지도 핀을 끌어 옮겼을 때 매장 정보의 **무엇을 바꾸고 무엇을 지키는지** 정하는 한 곳.
 *
 * 2026-09-21 시안 ②(당근비즈니스 참고안) — 주소 검색만으로는 정확한 자리를 못 잡는 매장이 있다
 * (상가 안쪽, 신축, 지번만 있는 곳). 그래서 핀을 손으로 끌 수 있게 했다.
 *
 * ## 왜 "장소 선택"과 갈라 놓았나
 * 장소 선택(`selectPlace`)은 **다른 매장을 골랐다**는 뜻이라 이름·전화·place id 까지 갈아엎는다.
 * 핀 이동은 **같은 매장의 위치를 더 정확히**라는 뜻이다. 한 경로로 합치면 핀을 조금 끌었다고
 * 방금 채운 전화번호가 지워진다 — 에러가 안 나서 아무도 신고하지 않는 종류의 손실이다.
 *
 * ## 주소를 못 되찾았을 때
 * 역지오코딩은 바다·신규 필지·좌표 오차에서 빈손으로 돌아온다. 그때 **빈 문자열로 덮지 않는다** —
 * 이미 맞게 들어가 있던 주소가 사라지고, 화면은 아무 말도 안 한다. 좌표만 반영한다.
 * (거꾸로 **좌표는 실패해도 반드시 반영한다** — 핀은 옮겨졌는데 저장값이 그대로면 사용자는
 *  고쳤다고 믿고 넘어가고 실제론 안 고쳐진, 조용한 어긋남이 생긴다.)
 */

/** 역지오코딩 결과 + 새 좌표. 주소는 못 찾으면 빈 문자열로 온다. */
export interface PinLocation {
  address: string
  lat: string
  lng: string
}

/** 핀 이동이 건드리는 필드만 추린 모양(폼 전체를 알 필요가 없다). */
export interface PinMoveTarget {
  restaurant_address?: string
  restaurant_lat?: string
  restaurant_lng?: string
}

/**
 * 핀 이동으로 덮어쓸 값을 계산한다. **여기 없는 필드는 호출부가 그대로 둬야 한다**
 * (이름·전화·place id 는 핀 이동의 소관이 아니다).
 */
export function applyPinMove<T extends PinMoveTarget>(current: T, loc: PinLocation): PinMoveTarget {
  return {
    // 주소는 되찾았을 때만. 빈손이면 기존 주소를 지키다.
    restaurant_address: loc.address || current.restaurant_address || '',
    // 좌표는 언제나. 핀이 간 곳이 곧 진실이다.
    restaurant_lat: loc.lat,
    restaurant_lng: loc.lng,
  }
}
