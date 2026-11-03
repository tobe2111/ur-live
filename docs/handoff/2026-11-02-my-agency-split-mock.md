# 2026-11-02 — 마이 손님/에이전시 분리 시안

## 이어받는 세션의 첫 액션
대표가 안(1 탭 · 2 묶기 · 3 입구 · 4 계정 바꾸기)을 고르면 `docs/design/my-agency-split-2026-11-02.md` 구현 todo 진행.
손댈 곳: `src/pages/UserProfilePage.tsx`(폰 순서 · PC 분기) · `user-profile/agency-doors.tsx` · `MyAgencyZone.tsx`.

## 완료
- 시안 캔버스 7장(지금 1 · 안1 2 · 안2 1 · 안3 2 · 안4 1). 코드 변경 없음.

## 틀렸던 판단
- 없음(시안만).

## 남은 결정
- 안 선택 · 직접 운영하는 내 가게를 어느 탭/화면에 둘지.

## v2 — 대표 확정 *"안 1로 하고 에이전시 화면을 기본으로 하자"* → 구현
- `MyRoleTabs.tsx` 신설 · `UserProfilePage.tsx` 에 `tabbed`/`showMe`/`showAgency` 게이트.
- 기존 시험 2파일 재조준(`my-pc-plan5` 3건 · `agency-invite-link` 1건) — 허용 조건을 `showMe`/`showAgency` 로, 그 값이 PC·비에이전시에서 늘 참임을 고정.
- 직접 운영하는 가게는 에이전시 탭(대표 미답 — 판이 한 덩어리).
- ⚠️ 못 본 것: 실기기 렌더(로컬에 에이전시 로그인 화면을 띄울 수단 없음). 배포 후 대표 폰에서 확인 필요.

## v3 (2026-11-03) — 안 1 다듬기
- PR #2128 머지(E3). 대표가 머리 위치를 바로잡음 → 탭 맨 위 · 머리 탭 따라 교체(`AgencyHead`) · '매장 정산'/'에이전시 정산' 이름.
- 🩸 틀렸던 것: 11-02 PR 에서 `SegmentedTabs` 를 정적 import → 손님 마이 첫 화면 +50KB(CI surface-budgets 가 잡음). 값/부품 분리 + lazy 로 해결.
- 🩸 '정산' 라벨을 표현식으로 바꾸자 줄 세는 시험 둘(`my-seller-all-in-my`·`my-shortcut-four`)이 그 줄을 **못 세면서도 초록**이었다 — 주입이 잡았다. 정규식이 표현식도 센다.
- 남은 것: 에이전시 화면 전체 UI 손보기(시안 먼저) · 홈 shift 빨간불은 main 쪽(이 작업 밖).
