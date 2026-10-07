
# S-EVR1 판정 — 만료 이용권 자동환불이 처음으로 돌았다 (2026-10-02 03:20 KST)

> 같은 세션의 앞 작업(마이 손수 시트 철거)은 `docs/handoff/2026-10-01-my-sheet-teardown.md`
> (PR #1613, 머지 대기)에 있다. 이 파일은 **그 PR 과 섞이지 않게** 따로 뒀다 —
> 같은 경로에 두 브랜치가 쓰면 머지마다 충돌한다(`CLAUDE.md` 인계 분할 룰).

예약했던 자가 점검이 발화해 **만료 이용권 자동환불의 E4 판정**을 했다. 브랜치
`claude/expired-refund-booking` (PR 별건 — `src/` 무접촉, 문서만).

### ✅ 통과 — 환불이 처음으로 실제로 돌았다

| 무엇 | 값 |
|---|---|
| `cron_hb:expired-voucher-refund` | `2026-10-01T18:00:34Z`(= 10-02 03:00:34 KST) · `ok:true` · `ms 6235` · `rr 144` · **`rw 10`** |
| `vouchers` id=1 `UR-UR66-YDAZ` | `status='expired'` · `refund_status='refunded'` |
| `point_transactions` id=33 | user 3 · **+1,800** · `type='refund'` · `18:00:30Z` |
| `notifications` id=1 | user 3 · `type='refund'` · `18:00:31Z` |
| `user_points` user 3 | `balance 12,100` · `updated_at 18:00:30` — 거래와 **같은 초**(잔액이 실제로 움직였다) |
| 이중환불 | `description LIKE '바우처 만료 환불%'` 전수 **1건** |
| 남은 대상 | `status='active' AND expires_at IS NOT NULL` **0건** |

**0 이 정답인 것 둘**: 커미션 회수 0(그 이용권은 `introduced_by_influencer_id IS NULL`) ·
`unclaimed_forfeit` 원장 0(미수령 정책 OFF + 픽업 아님 → 전액 환불이 맞다).

### 🔴 판정하다 나온 새 결함 — 장부에 안 적혀서 또 환불할 수 있다

`orders.refunded_amount` 가 **0 그대로**다(주문 85, 총액 1,800). 만료 환불 cron 은 그 칸을
한 번도 안 쓴다(`grep refunded_amount src/worker/cron/auto-settlement.ts` = **0건** — 딜 환불이
`adjustUserPoints` 를 직접 부른다). 그런데 그 칸이 **전액환불 경로의 상한**이다
(`order-refund.ts:189` → `amount = total_amount − refunded_amount`) ⇒ 지금 그 주문에 환불을
누르면 1,800 이 **또** 나간다. 누를 수 있는 자리 셋: `admin-orders.routes.ts:334` ·
`seller-orders.routes.ts:341` · `order.routes.ts:1033`. 셋 다 `vouchers.refund_status` 를 안 본다.

**다른 환불 네 경로는 전부 그 칸을 올린다**(`refund.ts:189` · `order-refund.ts:335` ·
`voucher-partial-refund.ts:90` · `order.routes.ts:838`) — 규칙이 없는 게 아니라 **한 자리가 규칙 밖**이다.

⇒ 등급 C 라 **코드 미변경**. 결재 `docs/decisions/2026-10-02-expired-refund-not-booked.md`.
⚠️ **가드는 수리와 같은 커밋에 박는다** — 지금 박으면 빨간불이거나 *"만료 환불은 이 칸을 안 쓴다"* 를
단언해 **결함을 정답으로 동결**한다(2026-09-30 에 겪은 클래스). 가드 설계는 그 결재문 §기본안에 적어 뒀다.

### 💰 번들 — 예산 상향 없이 **내려갔다**

새 결재문 4.6 KB 가 `AdminDecisionsPage` 번들에 그대로 실려 main 헤드룸(4.5 KB)을 넘겼다
(`7.57014 > 7.57` — **147 바이트** 초과). 올리지 않고 **끝난 결재 셋을 archive 로 옮겼다**
(`ushop-star-rating` · `ushop-bottom-buy-bar` · `store-scan-counter`, 합 7.9 KB).
⇒ 측정 **7.56562 → 7.56224 MB**, 헤드룸 **7.9 KB**(예산 7.57 불변).
🕳️ 그 셋 중 둘은 `반영 커밋` 이 비어 있었는데 `fullyApplied` 가 **해시를 요구**해서
*"안 만든다"* 결정은 영원히 `구현 중` 으로 남는다 — `반영 커밋` 에 "코드 변경 0 + 이유" 를 적고 옮겼고,
그 함정을 `docs/decisions/archive/README.md` 에 적어 뒀다.

### 🔀 같은 판정을 **다른 세션이 동시에** 했다 (중복 — 셋째 번)

`#1616`(머지됨)이 같은 새벽에 **같은 S-EVR1 E4 판정**을 했고 숫자가 전부 일치한다
(`refund_status='refunded'` · 거래 id=33 +1,800 · `rw 10` · 잔액 12,100). 서로 다른 파일에 적어
충돌은 없었지만 **같은 조회를 두 번 한 것**이다. 기록 자리는 다르다 —
#1616 은 `docs/handoff/2026-09-30-refund-stolen-and-switch-labels.md`,
이 PR 은 **결재문 자신의 `### E4 판정` 절 + STAGING_CHECKLIST S-EVR1**(그 결재문이 요구한 자리).

**이 PR 에만 있는 것**: ① 장부 미기록(`orders.refunded_amount`) 결함과 그 결재
② 번들 −3.3 KB(끝난 결재 셋 archive) ③ `fullyApplied` 가 해시를 요구하는 함정 기록.
**#1616 에만 있는 것**: 이중적립이 그날 밤 실제로 발화한 기록(이용권 2번 사용).

🧭 하루에 중복이 셋이다(#1591↔#1593 · #1616↔이 PR · #1608 이 기록한 것).
**새벽 작업 전에 `git log origin/main --oneline -10` 과 열린 PR 목록을 먼저 볼 것.**

### 🩸 이번에 틀렸던 판단

- **예약 프롬프트가 PR 번호를 잘못 적고 있었다** — *"#1589(이용권 단일 레일, draft)"* 라고 적혀 있는데
  실측 #1589 는 **셀러 정산 화면 수리 + 폰 하네스**이고 **이미 머지됐다**(10-01 14:13 KST, `merged=True`).
  이용권 단일 레일은 **#1593** 이고 **머지 없이 닫혔다**(`merged=False`). 예약 프롬프트의 사실을
  그대로 믿지 말 것 — 저장 시점의 추정이다.
- **`vouchers.final_price`·`users.points`·`users.deal_points` 는 없는 컬럼이다.** 실제 이름은
  `vouchers.applied_price` 이고 잔액은 `user_points.balance`(별 테이블). 쿼리 세 번 헛쳤다.

### 🟡 다음 세션이 이어받을 것

- **PR #1613**(철거) 머지 지시 대기 — 초록·충돌 0.
- **새 PR**(이 추가분) 머지 지시 대기 — 문서만.
- **결재 `2026-10-02-expired-refund-not-booked.md`** 대표 답 대기(등급 C).
- ~~**#1593 이 닫혀 있다** — 이중적립 수리가 main 에 **없다.**~~ **🩸 이 문장은 틀렸다(같은 날 정정).**
  수리는 **이미 main 에 있다** — `aed1694ca`(PR #1591, 2026-10-01 15:22 KST)
  *"이용권 적립 이중레일 제거(185% 과다지급)"* 이고 `canonicalPayeeSql` ·
  `voucher-credit-single-rail-2026-10-01.test.ts` 가 main 에 실재한다(직접 확인).
  #1593 은 **같은 일을 하던 중복 PR 이라 닫힌 것**이고(#1608 이 "중복 개발 기록" 으로 남겼다),
  닫힘이 곧 수리 부재가 아니다. ⇒ 되살릴 것 없음. **PR 의 열림/닫힘만 보고 코드 유무를 판정하지 말 것.**
