# 2026-10-14 — 결재함 정리 + 오늘 머지분 E4

## 1. 오늘 머지분 라이브 판정 (E4, 배포 `d0802968f` 19:32 KST)
- #1800 카페 스위치: `PATCH /api/admin/ads/influencer-pool/collect-gates {cafe:false}` → 200 · `setting:'off'` (전에는 "잘못된 ID" 400).
- #1800 스위트스팟: `GET /api/admin/ads/influencer-pool?tier=sweet` total **75,335** / 전체 336,498.
- #1805 주문 목록: 배포 청크 `AdminOrdersPage-*.js` 에 `shipping_phone||"-"` 그대로, `****` 0건.
- #1805 활동 피드: 배포 청크 `AdminPage-*.js` 가 `(e.shipping_phone||"").trim()` — 마스킹 없음.
- ⚠️ 화면 자체는 브라우저로 안 봤다(배포 코드 판정). 대표가 주문 한 건 열어 보면 끝.

## 2. 결재함 정리 (`docs/decisions/`)
- 보관함으로 22건 이동: 반영 커밋에 **origin/main 에 있는 해시**(`git merge-base --is-ancestor` 로 전부 확인)를 적고 `git mv`.
  "코드 변경 0" 셋(single-rail · broker-share-switch-off · pass-title-groupbuy)은 이유 한 줄 + 기록 커밋. 반려 1건(confirm-toss-latency).
- 다른 파일의 경로 참조(주석·문서)도 `docs/decisions/archive/…` 로 같이 옮겼다(코드 동작 변경 0).
- 남긴 8건:
  - 🟡 부분: `voucher-code-format`(한 장 코드 교체 기능 없음) · `agency-ideal-open-questions`·`agency-model-email-only`(3단계 머니 남음).
    → **해시를 일부러 PR 번호로만** 적었다 — 해시를 적으면 `parse-decision.ts` `fullyApplied` 가 "반영 끝" 으로 접는다.
  - ⚪ 미착수: `seller-auto-approval` — 그 뒤 "당근 플로우(항상 대기)" 가 반대 방향으로 들어와 **대표 재확인 필요**.
  - 대표 행동: `ocr-auto-verify-gate`(실제 등록증 사진 5장 S-OCR-1) · `toss-settlement-readiness`(토스 콘솔 3가지) ·
    `withholding-base-fee-deduction`(세무사 답) · `settlement-structure-payouts`(반려지만 Q1 **10-31 재상정** — 옮기지 말 것).

## 틀렸던 판단
- `my-stage2-sheet-teardown` 을 내 파이썬 판정이 "미반영" 으로 셌다 — 제목이 `## 반영 커밋 (철거)` 인데 정확 일치로 찾았다.
  SSOT(`parse-decision.ts` `section`)는 제목 뒤 꼬리를 허용한다. **판정은 SSOT 정규식 그대로 쓸 것.**
- `udal-master-for-goods` 에 적혀 있던 `36423a1` 은 main 에 없는 브랜치 커밋이었다 — 실제는 `f61eca25b`(#1692).

## 3. 이 PR 에서 밀림 검사(`shift`)가 빨갛던 것 — 측정기 오탐 (수리)
- 실패: `/vouchers` 에서 `교환권 820→8 (-812)`. 실제로는 아무것도 안 움직였다 — 머리줄 제목과 하단 탭 라벨이
  **둘 다 '교환권'** 이고, 측정기가 글자로 요소를 짝짓다 첫 프레임엔 하단 탭(y=820)·완성 프레임엔 머리줄(y=8)을 잡았다.
- 왜 오늘 드러났나: #1802 가 하단 탭 활성 라벨의 브랜드 점(자식 span)을 걷어 그 라벨이 처음으로 '잎' 요소가 됐다.
  main 기준 다른 브랜치(`33b8ee553`)도 같은 실패였다 — 이 PR 의 변경과 무관.
- 수리: `visual-preview.mjs --shift` 가 두 프레임 중 어디서든 **같은 글자가 둘 이상**이면 그 글자를 재지 않는다.
  로컬 `check-layout-shift.mjs --only=교환권` → 🟢 보이는 곳 밀림 0.
