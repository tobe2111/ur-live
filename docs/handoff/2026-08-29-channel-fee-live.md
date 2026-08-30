# 2026-08-29 — 채널 요율을 **라이브에서 켰다** + QA 매장 정리

대표 지시 3건: *"제아스컴퍼니는 삭제해도 돼. 채널 요율은 지금 켜줘. 3번은 너가 정지해."*

## 한 것 (전부 라이브 실행 · 코드 변경 아님)

| | 대상 | 결과 |
|---|---|---|
| 정지 | id 3·6·7·8·10 (QA 가짜) + **11 제아스컴퍼니** | `status='suspended', is_active=0` |
| 유지 | id 14 홍대돈까스 | `approved` · channel=`brokered` → **5%** |
| 설정 | `fee_channel_rates_enabled` | `false` → **`true`** |
| 설정 | `platform_fee_pct_direct` / `_brokered` | **10 / 5 명시 저장**(코드 기본값 의존 제거) |

정지 6곳 모두 **상품 0개 · 주문 0건**이라 잃은 것 없음(정지 전 실측).
`DELETE /api/admin/sellers/:id` 는 **소프트 정지**(행 보존)라 되돌릴 수 있다 — 하드 삭제 아님.

## ⚠️ staging 실결제 **없이** 켰다 — 다음 세션이 반드시 알아야 할 것

룰상 머니 스위치는 staging 실결제 후 켜는 건데, 대표 지시로 건너뛰었다. 당시 근거:
**판매 중 이용권 0개 · 성공 주문 0건** → 잘못 걷힐 돈 자체가 없었다(첫 실매출 전에 맞춰 두는 판단).

**⇒ 남은 검증은 "첫 실결제 1건"이다.** 그 주문이 생기면:
```sql
-- 홍대돈까스(14) 주문이면 platform_fee 가 5% 로 찍혀야 한다
SELECT reference_id, credit_account, amount, metadata FROM ledger_entries
 WHERE event_type='voucher_used' ORDER BY id DESC LIMIT 5;
```
환불 시 역전 대칭도 같이 확인. 롤백은 `/admin/platform-settings` 에서 게이트 `false`(즉시 종전 동작).

## 🩸 홍대돈까스가 왜 5% 인가 — 대표가 물었고, 근거를 남긴다

내가 정한 게 아니라 **2026-08-26 등록 시점에 박힌 값**이다. 서로 다른 두 컬럼이 같은 이야기를 한다:
```
seller_meta   store_channel = 'brokered'   2026-08-26 07:28:24
seller_operators  user_id 3(정지원) role = 'operator'   07:28:25
```
등록 코드가 `channel === 'direct' ? 'owner' : 'operator'` 로 권한을 주므로 **채널과 권한이 교차 검증**된다.
그리고 채널은 등록 시 **필수 선택**이다(`isChannel(b.channel)` 미통과면 400) — 기본값이 조용히 들어간 게 아니다.

⚠️ **다만 이게 실제 사업 관계와 맞는지는 코드가 알 수 없다.** 홍대돈까스가 사실은 직접 입점이면
한 줄로 바꾼다: `PATCH /api/admin/sellers/14/channel {"channel":"direct"}` (대표 확인 대기).

## 곁들여 마감한 것

`urshop-earn-ladder.test.ts` 가 아직 **옛 정규식 `codeOnly`** 를 들고 있었다(2026-08-27 인계에
"다음 세션이 통일할 것"으로 적어 둔 항목). 라인 주석 속 `/*` 에 파일 절반이 삼켜지는 그 지뢰다 →
공용 스캐너로 통일.

## 다음 세션의 첫 액션

1. **첫 실결제가 있었는지** 확인 → 있으면 위 SQL 로 원장 요율 검증(이게 S7 의 마지막 칸이다).
2. 홍대돈까스 채널이 맞는지 대표 답변 반영.
3. 남은 대표 판단: `max_influencer_commission_pct`(현재 **2%**) · `influencer_payout_min`(현재 **10만원**)
   — 둘 다 지금 값이 딜을 사실상 못 쓰게 막는 수준이다.

## 이번에 틀렸던 판단

- 정지 대상을 앞선 대화에서 **`id 3,6,7,8,9,10`** 이라고 말했는데 **id 9 는 존재하지 않았다**(실제는 3,6,7,8,10).
  요약을 믿고 옮겨 적은 값이었다 — 실행 직전에 라이브를 다시 조회해서 걸렀다.
  ⇒ **행동 직전 재조회**가 이 세션에서 세 번 다 값을 했다.
