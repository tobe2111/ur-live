# 2026-09-02 — 숙소 이용권 상세 PC: B안 예약 패널 · 연박 · 달력↔지도 겹침

**레일**: 🎟️ 유어딜(소비자, `/stays/:id`) · **머니 경로**: 없음(예약 모달·결제 무접촉 — 담는 UI 만) · **롤백**: 아사이드를 종전 `modeTabs+selectorBox+cart` 블록으로 환원 + `pickRange` 제거

대표 신고: PC 배치가 이상적이지 않고 달력이 지도와 겹친다 + 연박이 안 된다. 시안 3안(`docs/design/stay-detail-pc-layout-2026-09.md`) 중 **B안** 선택.

**틀렸던/찾은 것**
- 연박: `pickDay` 의 "범위가 잡혔으면 새 체크인" 규칙 — 초기값이 늘 1박 범위라 **항상 참** → 체크아웃을 찍을 길이 없었다. 서버는 연박을 받는다(가용 조회 `check_in/check_out`, 결제 야간 batch).
- 겹침: `<aside lg:sticky>` 가 z 없이 스택 컨텍스트 → 카카오맵 내부 레이어(z≥1)가 루트 스택에서 위로. 아사이드 `lg:z-20` + 지도 `relative isolate z-0` 한 쌍.
- 라벨 "hotel": `DetailTitleHeader storeName={stay.property_type}` 원본 → `propertyTypeLabel`.
- 날짜 트리거: 360px 안에서 인원 버튼과 한 줄이면 "2026.09.02(수)~0…" 로 잘렸다(대표 "2줄로 되고 보기 안좋아") → 세로 두 줄.

**검증**: tsc 0 · vitest(신규 10) · theme/design-slop/file-size/modal-zindex GREEN. ⚠️ 이 환경엔 D1 이 없어 **실제 페이지 렌더는 못 했다**(시안 렌더만). 배포 후 `/stays/2712` 1440px 에서 ① 오른쪽 패널에 객실 행·총액·예약 버튼 ② 달력에서 2일→5일 클릭이 3박으로 잡히는지 ③ 달력이 지도 위에 뜨는지 ④ 라벨 "호텔".
**Notion**: 기록 완료(개발 업데이트 로그, 2026-09-02).
