# 🧨 결제가 통째로 멎어 있었다 — 죽은 테이블의 깨진 외래키 (2026-09-19)

**[E2 검증됨]** — 코드·가드·되돌려-검증 완료. **E3(배포)·E4(라이브 판정)는 아직.**

## 대표 신고
> *"결제가 안됐대. 확인해봐. 영구적인 문제 해결이 필요해"*
> *"정작 토스페이먼츠에서는 결제가 찍혀있어. 그리고 결제 시, 로딩이 너무 긴데…?"*
> *"교환권이나 이용권을 딜로 결제하면 PG사 거치지 않아도 바로 되어야 하는데 … 공동구매 참여 중 오류"*

## 원인 (추측 아님 — 라이브 D1 실측 + 실제 핸들러 재현)

`payments` 와 `tax_invoices` 가 이렇게 선언돼 있었다:

```sql
FOREIGN KEY (order_id) REFERENCES orders(order_no)   -- migrations/0034
FOREIGN KEY (order_no) REFERENCES orders(order_no)   -- migrations/0012
```

**`orders.order_no` 라는 컬럼은 없다.** 진짜 이름은 `order_number` 다(라이브 실측 `has_order_no = 0`).

SQLite 는 부모 컬럼이 없는 외래키를 *malformed* 로 보고 **부모든 자식이든 DML 이 닿으면**
`foreign key mismatch` 를 던진다. D1 은 외래키를 켜 둔다 — 라이브 실측 `PRAGMA foreign_keys = 1`.

### 🔑 왜 하필 지금, 왜 아무도 못 봤나 — 문장 형태가 갈랐다

실측(라이브 스키마를 그대로 node:sqlite 에 넣고 측정):

| 문장 | 결과 |
|---|---|
| `INSERT INTO orders (...)` | ✅ 통과 |
| `INSERT INTO orders (...) RETURNING id` | ❌ foreign key mismatch |
| `DELETE FROM orders` | ❌ foreign key mismatch |
| `INSERT INTO payments` (자식) | ❌ foreign key mismatch |

두 결제 경로(`/join` 딜 · `/confirm-toss` 카드)는 **둘 다** `INSERT … RETURNING id` 를 쓴다 —
2026-05-24 의 *"RETURNING 으로 1 await 절약"* 최적화다. 그 최적화가 들어간 뒤부터 조용히 멎었다.

그리고 **두 경로 다 실패를 삼키고 자동 환불**한다 → 사용자에겐 "일시적인 오류", 로그는
`console.error` 뿐(이 환경은 `wrangler tail` 의 wss 가 막혀 읽을 수 없다). 그래서 **신호가 0** 이었다.

### 라이브 피해 실측
```
orders   마지막 행 2026-06-26 (id 88)      ← 그 뒤 주문이 하나도 안 만들어졌다
vouchers 전체 1행 (2026-05-24)             ← 이용권이 한 장도 발급된 적이 없다
point_transactions: 딜 차감 → "자동 환불(주문 실패)" 왕복만 누적 (06-16, 09-17 ×3)
```
대표 화면에 결제가 찍힌 이유: **토스 승인은 성공**했고, 그 뒤 우리 INSERT 가 실패해 자동 취소로 갔다.

## 고친 것

1. **`src/worker/utils/ensure-orders-fk-sane.ts` (신규)** — 깨진 참조를 가진 테이블을
   `sqlite_master.sql` **원문 그대로** 다시 만들되 부모 컬럼만 `order_number` 로 고친다.
   컬럼을 손으로 재구성하지 않는다(재구성하면 기본값·제약이 조용히 달라진다). 행·인덱스 보존,
   원자 batch, 멱등, fail-soft.
2. **배선 3곳** — `/join` · `/confirm-toss`(**토스 승인 이전**에) · `repair-schema`(정비 레인).
   ⚠️ 승인 *뒤*에 고치면 이미 청구된 돈을 되돌리는 경로로 떨어진다 — 그게 이번 사고였다.
3. **마이그레이션 0012·0034 수정** — 새 환경이 같은 고장을 다시 만들지 않게.
4. **영구 가드 `scripts/check-foreign-key-sanity.mjs`** (verify.yml strict + audit-gate, 불변식 115).
   정규식이 아니라 **진짜 SQLite 에 CREATE 해서 PRAGMA 로** 묻는다. 측정량이 비정상적으로 적으면
   통과가 아니라 실패. 되돌려-검증: 마이그레이션을 되돌리니 빨간불 + 올바른 컬럼명까지 제시.

## 검증
- 라이브 스키마(327테이블)로 **실제 `/join` 핸들러** 재현: 수리 전 500 → 수리 후 **200, 주문+이용권 발급**
- `orders-fk-mismatch-2026-09-19.test.ts` 8건 · 주입 4건 **전부 빨간불 확인**
- tsc 0 · 관련 유닛 34건 pass · audit-registry 115 동기

## ⚠️ 다음 세션의 첫 액션 (배포 후 E4 판정)

배포되면 **자동 수리**가 첫 결제 요청에서 돈다. 판정:

```bash
# 1) 깨진 참조가 사라졌는지 (0 이어야 정상)
#    D1 콘솔 또는 CF API: DB_MAIN=d9530ba6-7a26-4c02-9295-3ce5aef112a3
SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%orders(order_no)%';

# 2) 실결제 1건(이용권 딜 or 카드) 후
SELECT id, order_number, status, created_at FROM orders ORDER BY id DESC LIMIT 3;
SELECT COUNT(*) FROM vouchers;   -- 1 → 2 이상으로 늘어야 한다
```
**판정 기준**: ① 1번 쿼리 0행 ② 주문 행이 새로 생김 ③ 이용권이 발급됨.

## 이번에 틀렸던 판단 (다음 세션이 같은 길로 안 가게)
- ❌ *"vouchers 에 `introduced_by_influencer_id` 컬럼이 없어서일 것"* → 라이브 확인 결과 **있었다**.
- ❌ *"서브리퀘스트 한도(50) 초과일 것"* → 딜 차감~환불 간격이 **1초**라 기각.
- ❌ *"`node_modules` 가 있다"* → `ls ... && echo EXISTS` 가 **빈 출력에도 성공**해서 오판.
  실제로는 없었고 `npm ci` 가 필요했다. **존재 확인은 `-d` 로 할 것.**
- ✅ 결국 답을 준 건 추론이 아니라 **라이브 스키마를 그대로 넣고 진짜 핸들러를 돌린 것**이다.

## 남은 것 (대표 신고 중 미처리)
- **결제 로딩이 길다** — 위 사고와 별개. `/confirm-toss` 가 응답 전에 도는 동기 작업이 많다.
- **체크아웃에서 딜 사용량 조절** — 지금은 이용권 상세에만 있다. 시안 필요.
