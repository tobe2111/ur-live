/**
 * 📮 고객 문의 받는 주소 SSOT (2026-10-18 대표 확정 "지메일로 바로 교체").
 *
 * 사이트·메일 하단에 적혀 있던 support@ur-team.com · contact@ur-team.com 은 **실제로 없는 주소**였다
 * (ur-team.com 메일 서버 aspmx.daum.net 이 `550 5.1.1 No such user` 로 반송 — 2026-10-18 실측).
 * 고객이 보낸 문의가 전부 반송되고 있었는데 에러가 우리 쪽에 남지 않아 아무도 몰랐다.
 *
 * 주소를 바꾸려면 이 값 하나만 고친다. 바꾸기 전에 **그 주소로 메일을 보내 반송이 안 나는지** 먼저 확인할 것.
 */
export const SUPPORT_EMAIL = 'urteam.corp@gmail.com'
