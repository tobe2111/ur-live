# [UNLOCK_LOADING] 내 이용권 — '쓸 수 있는 이용권 합계' 판 제거 — 2026-11-04

- **바꾼 잠금 파일**: `src/pages/MyVouchersPage.tsx` — 목록 아래 합계 판 렌더 한 줄 + 그 계산(`heroTotal`)·import 제거.
  잠긴 항목(VoucherMap lazy chunk)은 **불변**.
- **대표 지시(그대로)**: *"내 이용권 페이지에서 쓸 수 있는 이용권 합계 없애줘."*
- 부품 `my-vouchers/WalletSummaryCard.tsx` 는 쓰는 곳이 0 이 되어 삭제. 시험 `wallet-and-slop` 이 되살아나지 않게 고정.

- 같은 파일 · 지도에서 보기: 이용권이 **한 장이면** 아래 카드가 80% 폭으로 왼쪽에 붙던 것 → 한 장이면 꽉(대표 *"중앙정렬도 안 되어 있어"*).

- 같은 파일 · 지도 카드 선택 테두리 `ring-2` → `ring-2 ring-inset`(대표 *"윗칸에 파란색 테두리가 잘리는 경우가 많아"* — 가로 넘김 영역에서 위·아래가 잘렸다).

## 롤백
revert.
