# 🧪 STAGING 검증 체크리스트 (SSOT)

> **2026-07-05 신설 (대표 승인 "모두 이상적으로 진행" — 1인 운영 유지보수 개선)**
>
> CLAUDE.md audit log 곳곳에 흩어져 있던 "⚠️ staging 실결제 검증 필수" 항목을 한 곳으로 통합.
> **게이트 플래그는 여기 시나리오를 통과하기 전에 프로덕션에서 켜지 말 것.**
> 어드민 현황판: `/admin/system-monitoring` → "게이트·하트비트" 탭 (`GET /api/admin/ops-status`)
> — 어떤 게이트가 활성인지 + S# 검증 참조가 표시됨.
>
> **운영 룰**:
> 1. 항목 검증 통과 시 아래 표의 상태를 ✅ + 날짜로 갱신하고 같은 커밋에 기록.
> 2. 새 게이트/staging-필수 기능이 생기면 **같은 커밋에서** 이 문서에 항목 추가
>    + `admin-system-monitoring.routes.ts` `OPS_GATES` 에 등록(staging_ref 부여).
> 3. staging 배포: `npm run deploy:staging` (`scripts/deploy-staging.sh`).

## S# — 게이트 플래그 (검증 전 활성 금지)

| ID | 게이트 | 위치 | 시나리오 | 통과 기준 | 상태 |
|---|---|---|---|---|---|
| **S1** | `commission_budget_enabled='true'` | platform_settings | 영입자 커미션 + 추천트리 커미션이 **겹치는** 3P 주문 결제 → 환불 | ① Σ(모든 커미션 적립) ≤ 주문당 예산(수수료−`pg_reserve_pct`) ② 환불 시 전 커미션 역전 대칭 ③ OFF 복귀 시 기존 동작과 동일 | ⬜ 미검증 (2026-07-04 배선) |
| **S2** | `promo_funding_source='owner'` | platform_settings | 이용권 구매 → 매장에서 사용 → 환불 | ① 사용 시 매장 원장 promo debit **정확히 1회** ② 쇼핑 원장 fee 합산 정합 ③ 환불 시 debit 복원 | ⬜ 미검증 (2026-07-04 배선) |
| **S3** | `SHOPPING_LEDGER_ENABLED='true'` | Cloudflare env | 일반 쇼핑 주문 결제 → 환불 (쇼핑탭 재오픈 전 필수) | ① 셀러 원장 net 크레딧(gross+fee) **정확히 1회**(이용권/공구 주문은 skip — 이중적립 0) ② 환불 시 역전 → receivable 0 | ⬜ 미검증 (2026-07-01 배선) |
| **S4** | `FEE_RESOLVER_ENABLED='true'` | Cloudflare env | 다양한 소유모델 주문 여러 건 결제 (그림자 — 정산 무영향) | ① `order_fee_breakdown` 에 주문당 1행 기록 ② 기록된 분배 vs 현행 정산 비교 검증 → 일치 확인 후에만 authoritative 전환 논의 | ⬜ 미검증 (2026-06-27 배선) |

## P# — 게이트 없는 staging-필수 검증 (코드 경로 변경분)

| ID | 항목 | 시나리오 | 통과 기준 | 상태 |
|---|---|---|---|---|
| **P1** | 가상계좌(무통장) 조기확정 방어 (2026-07-01) | 가상계좌 결제 → 입금 전/후 확인 | 입금 전: 주문 `AWAITING_PAYMENT` + 재고/딜/교환권 발송 미실행. 입금 webhook 후: 확정 + KT 발송 **1회** | ⬜ |
| **P2** | 혼합결제 딜 차감 bind fix (2026-07-01, 쇼핑 재오픈 전) | 쿠폰+딜 혼합 결제 → 환불 | confirm 통과 + 딜 잔액 차감 1회 + 환불 시 복원 | ⬜ |
| **P3** | 결제 felt-latency waitUntil 이동 (2026-07-02) | 교환권 딜결제 1회 | 응답 즉시 + 교환권 수초 내 도착 + `kt-alpha-voucher-retry` 스위퍼 무발동(정상 주문) | ⬜ |
| **P4** | webhook-only 확정 알림 대칭 (2026-07-01) | 브라우저 confirm 누락 상태로 webhook 확정 / Toss측 취소 | 셀러 '결제 확정' 벨 1회 / 구매자 취소 알림 1회 | ⬜ |
| **P5** | 확정경로 side-effect 대칭 3종 (2026-06-26) | 디지털 상품·교환권·혼합결제 각 1회 (webhook-only 포함) | 디지털 보관함 발급 1회 / KT 발송 1회(이중발송 0) / 딜 차감 1회 | ⬜ |
| **P6** | TossPaymentWidget 약관 클릭-시점 검증 (2026-06-26) | 미동의 클릭 / 동의 후 결제 | 미동의: 안내+스크롤(Toss 미호출) / 동의: 정상 진행 | ⬜ |
| **P7** | 결제 셀프취소 3건 fix (AUDIT_INVARIANTS 2026-06-26, 쇼핑 재오픈 전 fix 필요) | TECHNICAL_DEBT 등록분 — fix 후 시나리오 확정 | 쇼핑 재오픈 전 fix + 검증 | ⬜ (fix 선행) |
| **P8** | 링크샵 공유 카드 (2026-07-01) | `/u/{handle}` 카톡 공유 + 하드로드 | 큐레이터 이름·프로필 OG 카드 / 로더 1종만 노출 | ⬜ |

## 검증 데이 권장 순서 (반나절)

1. staging 배포 + `bash scripts/audit-gate.sh` GREEN 확인
2. **P1→P6** (게이트 무관 경로 변경분 — 현재 라이브에 이미 나가 있는 코드) 먼저
3. **S1→S4** 게이트를 staging 에서만 켜고 순서대로 (각각 켜기→검증→끄기, 상호간섭 배제)
4. 통과 항목 이 문서에 ✅ + 날짜 기록 → 프로덕션 게이트 활성은 별도 커밋/기록으로

## 완료 기록

| 날짜 | 항목 | 결과 | 비고 |
|---|---|---|---|
| — | — | — | 아직 없음 |
