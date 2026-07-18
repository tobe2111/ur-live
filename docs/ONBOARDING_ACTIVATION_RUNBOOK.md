# 방배 온보딩 — 활성(flip) 순서 런북 (SSOT)

> 작성 2026-07-14. 목적: 데이터 감사·보안·매칭·정산이 **여러 PR/문서에 흩어져** 있어, 방배 온보딩 때
> "무엇을 어떤 순서로 켜는가"를 한 곳에서 본다. **순서와 격리가 핵심** — 각 단계는 앞 단계 검증 후,
> 머니(정산)는 반드시 단독 세션.
>
> ⚠️ 이 문서가 참조하는 상세 문서 일부는 **별도 브랜치/PR**에 있다(머지되면 경로 유효):
> `DATA_CAPTURE_AUDIT_2026-07.md`(#514), `design/pii-encryption-rollout.md`, `design/data-products-design-2026-07.md`(#520),
> `design/commission-funding-restructure.md`(main), `design/influencer-matching-service-2026-07.md`(#523), `D1_RESTORE_RUNBOOK.md`(main).

---

## 0. 사전 상태 (이미 완료/동작 중)
- ✅ **D1 주간 백업**(`.github/workflows/d1-backup.yml`, 수 20:00 UTC · GH artifact 90일) — 동작 확인됨.
  - 남은 것: **복원 리허설 1회**(artifact → gunzip → `wrangler d1 execute`, `D1_RESTORE_RUNBOOK.md`). 대표 직접.
  - 선택: Worker cron 덤프용 `BACKUP_BUCKET` R2 바인딩(대시보드) — 2차 백업 경로. GH Actions 경로와 독립.

---

## 1. 데이터 감사 활성 (#514) — **매칭의 데이터 원천, 먼저**
매칭 엔진은 `inflow_clicks·voucher_visits`를 읽는다. 이게 없으면 매칭은 빈 결과(graceful)라, **데이터부터**.

| 단계 | 내용 | 검증(staging) | 리스크 |
|---|---|---|---|
| Stage 1 | user_id 정규화(`resolveUserIdString`) + 위치 하향(~1.1km 그리드) | 라이브=카카오=numeric → **no-op**(회귀 0). off-live만 정규화 | 낮음 |
| Stage 2 | 유입 클릭(`inflow_clicks`) + 방문(`voucher_visits`) 이벤트 적재 | 클릭→가입 bind→이용권 사용 시 각 이벤트 1행 | 낮음(additive) |
| Stage 3b | off-live user_id backfill(`backfillUserIdMapping`) | **dry-run(apply=false) 먼저** → 매핑 수 확인 → apply=true | 중(멱등·conflict-aware) |

> 완료 기준: staging에서 유입→방문→(재)방문 고리가 단일 user_id로 이어지는지 1건 추적.

---

## 2. 보안 / PII (대시보드 작업 — 대표 직접)
- **ADMIN_IP_WHITELIST**(`env.ts:116`, comma-separated IP/CIDR): 고정 IP 확정 후 대시보드 env 설정. 미설정=현행(전체 허용).
- **PII 암호화 활성**: dual-read + 기본 OFF 플래그는 이미 배포(평문 통과). 순서(`pii-encryption-rollout.md`):
  1. `bank_account` 파일럿 암호화 → 복호 읽기 검증
  2. `kakao_id` blind-index(HMAC 조회) → 로그인 조회 검증
  3. `email` LIKE-검색 경로 확인 후 암호화
  각 컬럼 staging 검증 후 flag ON(경로 B/flip 패턴).

---

## 3. 매칭 도구 활성 (읽기 — 저리스크) — PR #523
데이터(1)가 쌓인 뒤 켜야 실측. 켜기 전엔 목업 미리보기만.
- `src/shared/feature-flags.ts` **`MATCHING_ENABLED = true`** + **어드민 로그인(`admin_token`)** → 유어애즈 `sec-matching` 어드민 도구 노출.
- 서버 `/api/admin/matching/*`는 `requireAdmin` 상시 — 비어드민 403(플래그 무관).
- 선택: `ANTHROPIC_API_KEY` 있으면 "AI 매칭 근거"(집계·가명만 전송).
- **데이터 준비도 스트립**으로 실측(n≥5) 인플루언서 수 확인 → 매칭 신뢰도 판단.
- 리스크: 읽기 전용·INSERT 0·머니 무접촉. 되돌리기 = 플래그 false.

---

## 4. 매칭 정산 flip (머니 — **단독 세션 필수**) — #496 규율
> ⚠️ 매칭(읽기)과 **절대 같은 세션에서 켜지 않는다.** staging 축별 실결제 검증 전 활성 금지.

1. **배선**(별도 세션, 코드): `order-commissions.ts` 아비터에 owner-funded `'matching'` 축 추가
   (`seller_influencer_deals` active인 매장↔유입귀속 인플루언서 주문에 `commission_pct` 적립) +
   `owner-promo.ts` debit 합에 `source='matching'` 포함(환불 역전 대칭). 계산·불변식은 이미
   `matching-settlement.ts`(+테스트) 완성.
2. **스위치**: `promo_funding_source='owner'` + `commission_budget_enabled='true'` + env `MATCHING_SETTLEMENT_ENABLED='true'`.
3. **검증(staging 실결제)**: 매칭 주문 → 인플루언서 딜 적립 + 매장 promo debit + **`platform:revenue` == 정확히 5%** + 환불 시 역전.
4. **불변식**: `matching-settlement.test.ts`("순수취==5%")가 flip 후에도 GREEN. `check-commission-budget`(INV-CB) 통과.

---

## 격리 원칙 (모든 세션 준수)
1. **순서**: 1(데이터) → 2(보안/PII) → 3(매칭 읽기) → 4(정산 머니). 앞 단계 검증 후 다음.
2. **격리**: 각 phase 독립 스위치. 한 phase 문제가 다른 phase로 안 샘.
3. **머니 단독**: Phase 4는 반드시 단독 세션 + staging 실결제(#496). 읽기와 안 섞음.
4. **되돌리기**: 각 스위치 OFF면 즉시 현행. 코드는 게이트 뒤에서 보존.

## 구현 로그
- 2026-07-14 — 런북 신설(활성 순서 SSOT). 매칭(#523) 완성 시점 기준. 감사(#514)·PII·데이터상품(#520) 문서는 각 PR.
