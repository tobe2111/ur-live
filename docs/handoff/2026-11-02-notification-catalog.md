# 2026-11-02 — 알림 정리: TMI 걷기 + 가입·구매 어드민 알림 (알림 카탈로그 SSOT)

서비스: **유어딜(소비자)** + 어드민. 머니 경로 접촉 **없음**(결제·적립 로직 무변경 — 결제 성공 *뒤* 알림 한 줄씩만 추가). 잠금 파일: `kakao.routes.ts` 추가만(`docs/locks/loading/2026-11-02-admin-signup-notify.md`).

## 대표 지시
*"유어딜에 알림창들. 너무 TMI 가 많아 … 어드민에 지금 쌓인 알람들 확인해줘. 필요한 것들과 불필요한 것들 구별하고 명확하게 알람이 필요한 것들 넣어줘야 해. 유저 가입, 에이전시 가입 이런 중요한 것들은 알람이 하나도 안오고 있어. 교환권 교환, 이용권 구입 등. 가장 이상적이고 영구적이며 체계적으로"*

## 실측 (라이브 D1, 2026-11-02)
어드민 `dashboard_notifications` 427건: `cron_failure` 177 · `ops_daily_digest` 83 · `ledger_mismatch` 61 · `server_error` 35 · 주간 리포트 4종 각 12 · `seller_pending_reminder` 8 … **가입·구매 0건**.
유저 `user_notifications` 23건 중 TMI: `주문 상태: PREPARING`(영문) · `(대표 지시 — 본인 계정 10만딜 추가)`(어드민 메모 노출) · `새 공구 시작해보세요 — 공구 진행률이 낮아요`(없는 개념의 잔소리) · 긴 매장 승인 문구.
사장님 `tier_change` 15건: `GMV 0원, CVR 0.0%, 노출 가중치 0.7×`(내부 지표).

## 한 것
- `src/shared/notification-catalog.ts` — SSOT. 어드민 type → 업무/시스템 · 유저/사장님 숨김 목록 · `presentNotification`(이모지·영문 상태·어드민 메모·꼬리 안내 제거, 60자).
- `src/worker/utils/admin-event-notify.ts` — 어드민 업무 알림 한 함수(fail-soft, `scheduleAdminEvent` 는 응답 뒤).
- 새 어드민 알림: 유저 가입(카카오) · 에이전시 가입(이메일 인증 / 카카오) · 매장 입점 신청 · 이용권 구매(딜·카드·장바구니) · 교환권 교환(deal_only). 딜 결제 알림(`deal_payment`)에 상품 이름.
- 어드민 종: 업무/시스템 두 칸, 빨간 숫자는 업무만. 모두 읽음은 열린 칸만.
- 유저 알림 목록·미읽음 숫자, 사장님 알림함(마이)·종 모두 같은 표를 지난다(옛 알림도 깨끗해짐). 설명은 한 줄.
- 어드민 딜 선물: 손님 알림에 사유를 더 이상 안 쓴다(감사 로그에만).
- 가드 `src/tests/unit/notification-catalog-2026-11-02.test.ts` 31건 — 되돌려-검증: 등록 삭제·숨김 삭제·type 교체 주입 시 각각 빨간불 확인.

## 틀렸던 판단
- 처음엔 유저 알림 화면이 `/api/notifications` 를 읽는 줄 알았다 — 실제 화면은 `/api/social/notifications`(목록)이고 숫자만 `/api/notifications/unread-count`. 둘 다 고쳤다(한쪽만 숨기면 유령 뱃지).
- 교환권 교환이 group-buy `/join` 하나로만 오는 줄 알았다 — KT 교환권은 `points.routes /pay` 의 `deal_payment` 경로다. 그 알림 문구를 고쳤다.

## 남은 것 / 이어받는 세션의 첫 액션 (대표가 이어서 하라고 했을 때만)
- E4 판정: 배포 뒤 어드민 종 `업무` 칸이 비어 있다가 첫 가입·구매 때 뜨는지. `SELECT type, COUNT(*) FROM dashboard_notifications WHERE type IN ('user_signup','agency_signup','store_registered','voucher_purchased','gifticon_purchased') GROUP BY 1`.
- 쓰는 쪽 문구 정리(30곳+)는 화면에서 다듬어지므로 급하지 않다. 새 TMI 패턴이 보이면 `presentNotification` 에 한 줄 추가.
- 이용권 **사용(QR)** 어드민 알림은 넣지 않았다(하루 수백 건이 될 수 있어 소음). 원하면 `voucher_redeemed` 를 업무 칸에 추가.

## 2차 (2026-11-03 대표 "2번만") — 업무 칸 소음 정리
- 배포 후 실측: 업무 칸 미읽음 20 = `주간 정산 생성: 0건` 12 + 같은 `셀러 승인 대기 1건` 8. 시스템 칸 351.
- `payouts-generate.ts`: 0건이면 `payouts_heartbeat`(시스템 칸)로, 1건 이상만 `payouts_generated`(업무, "지급 승인 필요"). 0건 미읽음 옛 행은 그 회차에 읽음 처리. 정산 생성 로직 무변경.
- `seller-approval-reminder.ts`: 새 리마인드 전에 옛 미읽음 리마인드를 읽음 처리(최근 한 장만), 대기 0 이면 남은 장도 읽음.
- 가드 ⑥ 2건 추가 + 주입 2건 빨간불 확인.
- ⚠️ 이미 쌓인 12·8장은 **다음 회차**(정산: 매주 월요일 / 리마인드: 매시간 검사)에 정리된다 — 일회성 SQL 은 쓰지 않았다.
- 대표가 고르지 않은 것: ③ 휴대폰 알림(알림톡/메일)은 결재 사항이라 미착수.
