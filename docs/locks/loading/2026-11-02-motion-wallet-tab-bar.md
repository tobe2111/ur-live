# [UNLOCK_LOADING] 지갑 탭 밑줄이 미끄러진다 — 2026-11-02

- **바꾼 잠금 파일**: `src/pages/MyVouchersPage.tsx` (잠긴 항목: VoucherMap lazy chunk — **불변**)
- **대표 승인 문구(그대로)**: *"허락해줄게 잠금 파일 부분도."*
- **배경**: 모션 3차 "탭 밑줄"은 이 파일이 잠금표라 보류했었다(`docs/design/motion-mockups-2026-11.md`).

## 무엇을
[사용 가능 | 지난 이용권] 탭의 밑줄이 탭마다 따로 켜지던 것을 **밑줄 하나가 미끄러지는** 것으로 바꿨다.
유어샵 칩(`PinCategoryChips`)과 같은 `.ur-tab-bar`(index.css) 를 쓴다.
- 처음 그릴 때(측정 전)는 종전처럼 탭 안에 밑줄을 그린다 → 깜빡임 0.
- 측정은 그릴 때마다 하되 값이 같으면 상태를 안 바꾼다(탭 줄이 로딩 뒤에 생겨 의존성으로 못 잡는다).

## 안 바꾼 것
VoucherMap lazy · 목록·QR 열기 · 데이터 조회. 동작 줄이기면 `.ur-tab-bar` 전환이 꺼진다(index.css).
