# 2026-10-14 · 어드민 유저 목록 마스킹 해제 (🎟️ 유어딜 어드민)

대표 *"어드민 대시보드에서 유저 관리 페이지에 유저들 정보는 마스킹처리 될게 아니라 다 보여야하잖아"*.

## 한 것
- `GET /api/admin/users` 목록 응답의 이메일·전화 마스킹 제거(2026-07-13 데이터 감사 3단계에서 넣은 것).
- 유일한 사용처였던 `src/worker/utils/pii-mask.ts` 삭제.
- **남긴 방어**: 열람 감사 로그(`read_user_list` — 누가·검색어·건수) + 깊은 페이지네이션(offset ≥ 2000) 알림.
  가드 `admin-users-unmasked-2026-10-14.test.ts` + 주입 3건(마스킹 복귀·감사로그 삭제·알림 삭제) 빨간불 확인.

## 범위 밖 (그대로 마스킹 중)
- 어드민 **주문 목록**(`AdminOrdersPage`)·**활동 피드**의 배송 연락처 — 화면에서 직접 가린다. 대표 요청은 유저 관리였다.

## 다음 세션
- E4: 배포 뒤 `/admin/users` 에서 이메일·전화가 원문으로 보이는지.

## 후속 — 주문 목록·활동 피드도 해제 (대표 *"응 다 보이게 해줘"*)
- `AdminOrdersPage` 목록의 `maskPhone`(010-****-5678) 제거 → `shipping_phone` 원본.
- 대시보드 `AdminActivityFeed` 의 `maskPhone` 제거 → 원본.
- 가드 `admin-orders-feed-unmasked-2026-10-14.test.ts` + 주입 `scripts/mutations/admin-orders-feed-unmasked.mjs` 2건 빨간불 확인.
- 범위 밖으로 둔 마스킹(의도된 것): 셀러 정산 계좌번호 끝 4자리(admin-payouts) · 단체메일 발송 미리보기 이메일 ·
  KT 교환권 진단 화면 · 웹훅 알림 메시지(외부 채널로 나간다) · 어드민 셀러 상세의 한 응답(admin-sellers.routes:919).
- E4: 배포 뒤 `/admin/orders` 와 어드민 대시보드 활동 피드에서 별표 없는 번호가 보이는지.
