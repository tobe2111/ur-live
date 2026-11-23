# 2026-11-23 매장 수수료 채널 점검 + 어드민 에이전시 이름 변경

대표 *"1,2 해주고"* (11-16 수수료 채널 정리의 후속 — `docs/handoff/2026-11-16-operator-direct-fee.md`).

## 한 것
- `worker/utils/store-channel-audit.ts`: 채널이 '누가 데려왔나' 와 어긋난 매장 판정(외부 에이전시인데 10% · 중개인데 데려온 곳 없음 · 판매 중 미지정). 유어팀이 고른 5% 는 정상.
- 아침 다이제스트(`ops-daily-digest.ts`)에 경고 줄 · 어드민 매장 카드(`StoreChannelCard`)에 "데려온 곳" + 확인 필요 문구. **값은 자동으로 안 바꾼다.**
- `PATCH /api/admin/agency-accounts/:id/name`(super·ops, 감사 로그) + 어드민 에이전시 화면 "이름 바꾸기".
- 시험 `store-channel-audit-2026-11-23.test.ts` 10건 · 주입 5건 빨간불 확인.

## 남은 것
- 에이전시 1 이름을 실제로 '유어팀' 으로 바꾸는 것은 대표가 어드민에서(정식 표기 확인 필요).
- 예약형 이용권(전화로 일정 확정 → 현장 QR) 설계는 대표에게 안을 보고함 — 결정 대기. 기존 확정 시안 `docs/design/voucher-booking-request-2026-11.md`(미구현).
