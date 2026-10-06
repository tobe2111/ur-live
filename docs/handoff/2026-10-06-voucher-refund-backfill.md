# 소급 기록 — 이미 환불한 이용권이 장부에 안 적혀 있던 1건 (2026-10-06)

**[E2]** 작성·검증됨(tsc 0 · 유닛 16건 · 주입 7건 되돌려-검증 빨간불 · 라이브 dry-run 실측).
E3(머지·배포) 뒤 `d1-migrate.yml` 로그가 **실제 1건 기록**을 판정한다.

## 무엇을 했나

`#1625` 는 **앞으로의** 만료 환불을 `orders.refunded_amount` 에 적게 했다. 그런데 **이미 나간 돈은
소급해 적지 않는다** — 라이브에 그 행이 그대로 남아 있었다(머지 직후 읽기 전용 실측):

```
voucher 1   refund_status='refunded'   applied_price=1,800   order_id=85
order  85   total_amount=1,800         refunded_amount=0            ← 상한이 열려 있다
→ order-refund.ts: amount = 1800 − 0 = 1800  ⇒ 어드민·셀러·주문 세 자리 중 하나에서 또 나간다
```

⇒ **앞을 막는 것과 뒤를 메우는 것은 다른 일**이다. 뒤를 메웠다.

## 어떻게 (일회성 SQL 이 아니라 코드 경로)

- 신규 SSOT `src/worker/routes/repair-schema/backfill-voucher-refund-booking.ts`
  — SQL 을 모듈로 뺀 이유는 `expired-voucher-refund-sql.ts` 와 같다: **가드가 실제 sqlite 에
  돌려 판정**해야 한다(문자열 비교는 SQL 의미를 못 본다).
- `runSchemaRepair` 에 배선 → `d1-migrate.yml` 이 main 푸시마다 자동 호출하므로 **사람이 누를 것이 없다.**
- 멱등: `refunded_amount = 0` 인 행만 대상 ⇒ 두 번째 실행부터 `changes = 0`.

### 설계상 **일부러 안 한 것** (되돌려-검증으로 고정)

| 안 한 것 | 왜 |
|---|---|
| `refunded_amount > 0` 인 주문 덮어쓰기 | 그 숫자가 이 이용권 몫인지 **남의 부분환불 몫인지 SQL 로 구분 못 한다**. 덮으면 기록이 사라진다 ⇒ 보고만(`voucherRefundAmbiguousSql`) |
| `applied_price` 가 빈 장의 금액 추정 | 금액을 지어내 장부에 적는 것은 이 파일이 막으려는 사고와 **같은 종류** |
| 총액 초과 기록 | `MIN(total_amount, 합)` clamp — 상한이 음수가 되는 일은 없다(안전한 방향으로 실패) |

## 실측 (라이브 read-only dry-run)

```
백필 대상        → 1행: {order_id: 85, total 1800, now 0, would_set 1800}
수동확인 필요 행 → 0행
```

## 🩸 이번에 값을 치르고 배운 것

1. **주입 러너가 내 헛도는 단언을 잡았다.** `voucherRefundAmbiguousSql` 의 `> 0` → `>= 0` 주입이
   초록이었다 — 내 픽스처가 그 차이를 만들지 않았다. 지키려던 **진짜 불변식**은 *"백필이 자동으로
   고치는 행(장부 0)은 수동확인 목록에 뜨지 않는다"* 였고, 그걸 단언으로 추가하니 빨간불이 됐다.
   ⇒ 손으로 7건을 다 심어 보지 않으면 몰랐다.
2. **YAML 을 `readCode` 로 읽으면 안 된다.** JS/TS 용 주석 제거기가 `https://…` 의 `//` 를
   줄주석으로 읽어 URL 을 **잘라 버린다**(배선 단언이 그래서 한 번 빨간불). `readRaw` 를 쓸 것.
   CLAUDE.md `check-comment-stripper` 가 경고하는 그 클래스가 YAML 에서도 성립한다.

## 다음 세션 첫 액션

머지 후 `d1-migrate.yml` 실행 로그에서 한 줄을 확인한다:

```
backfill:voucher-refund-booking (1건)        ← 1 이면 소급 기록 성공
⚠️ … 수동확인 order N                        ← 떠 있으면 사람이 봐야 한다(현재 0)
```

라이브 재확인(읽기 전용):
```sql
SELECT id, total_amount, refunded_amount FROM orders WHERE id = 85;   -- refunded 1800 이어야 한다
```

## 남은 대표 판단 (이번 범위 밖 — 코드로 손대지 않았다)

1. **S-EXBOOK1 판정** — 만료 대기 이용권이 **0건**이라 지금은 판정 불가. 다음 실물 만료가 생길
   때 `cron_hb:auto-settlement` 와 함께 보면 된다(강제로 만들려면 staging 데이터 생성이 필요).
2. **모바일 네이티브 재빌드** — `@capacitor` critical(GHSA-rvm3-566m-v7fv)은 네이티브 코드라
   레포 수정으로 끝나지 않는다. 스토어 앱 재빌드·배포가 필요하다.
3. **36px·35px 칩 / 작은 아이콘 버튼** — 정본 스케일 밖. 키울지는 디자인 판단.
4. **`docs/CURRENT_WORK.md` 관례** — 이번 하루에 머지마다 **3번** 충돌했다. `#1628` 은 *푸시 전에
   알게* 해 주는 것이고 근본 해소(커밋에서 빼기 / 재생성 전략)는 레포 관례 변경이다.
