# 방배 온보딩 — 활성(flip) 순서 런북 (SSOT)

> 작성 2026-07-14. 목적: 데이터 감사·보안·매칭·정산이 **여러 PR/문서에 흩어져** 있어, 방배 온보딩 때
> "무엇을 어떤 순서로 켜는가"를 한 곳에서 본다. **순서와 격리가 핵심** — 각 단계는 앞 단계 검증 후,
> 머니(정산)는 반드시 단독 세션.
>
> ⚠️ 이 문서가 참조하는 상세 문서 일부는 **별도 브랜치/PR**에 있다(머지되면 경로 유효):
> `DATA_CAPTURE_AUDIT_2026-07.md`(#514), `design/pii-encryption-rollout.md`, `design/data-products-design-2026-07.md`(#520),
> `design/commission-funding-restructure.md`(main), `design/influencer-matching-service-2026-07.md`(#523), `D1_RESTORE_RUNBOOK.md`(main).
>
> **🤖 자동화 현황 (2026-07-18 — 대표 "직접 말고 자동으로")**: 자동화 가능한 건 전부 자동 전환됨 —
> 수집(상시)·백업(주간)·**복원 드릴(월간 자동)**·**backfill(주간 자동)**·**매칭 도구(상시 ON, 어드민 잠금)**.
> **사람 판단이 본질이라 자동화하지 않는 것**: ① staging 실결제 검증(실카드=사람) ② PII 스위치 ON(①번 후 +
> CF 대시보드 env — 대표 자신의 "staging 전 금지" 지시) ③ ADMIN_IP_WHITELIST(고정 IP 는 대표만 앎)
> ④ **정산 flip(머니 — #496 규율상 자동화 금지·단독 세션+실결제)**.

---

## 0. 사전 상태 (이미 완료/동작 중)
- ✅ **D1 주간 백업**(`.github/workflows/d1-backup.yml`, 수 20:00 UTC · GH artifact 90일) — 동작 확인됨.
- ✅ **복원 리허설 = 월간 자동**(2026-07-18, 대표 "자동으로"): `.github/workflows/d1-restore-drill.yml` —
  매월 1일 최신 백업 artifact 를 실제 복원(sqlite3)하고 무결성 검증(테이블수·핵심행·integrity_check).
  실패 시 워크플로 빨강 + Discord("백업이 복원 불가일 수 있음"). 프로덕션 실복원 절차는 `D1_RESTORE_RUNBOOK.md`(재해 시).
  - 선택: Worker cron 덤프용 `BACKUP_BUCKET` R2 바인딩(대시보드) — 2차 백업 경로. GH Actions 경로와 독립.

---

## 1. 데이터 감사 활성 (#514) — **매칭의 데이터 원천, 먼저**
매칭 엔진은 `inflow_clicks·voucher_visits`를 읽는다. 이게 없으면 매칭은 빈 결과(graceful)라, **데이터부터**.

| 단계 | 내용 | 검증(staging) | 리스크 |
|---|---|---|---|
| Stage 1 | user_id 정규화(`resolveUserIdString`) + 위치 하향(~1.1km 그리드) | 라이브=카카오=numeric → **no-op**(회귀 0). off-live만 정규화 | 낮음 |
| Stage 2 | 유입 클릭(`inflow_clicks`) + 방문(`voucher_visits`) 이벤트 적재 | 클릭→가입 bind→이용권 사용 시 각 이벤트 1행 | 낮음(additive) |
| Stage 3b | off-live user_id backfill — ✅ **주간 자동**(2026-07-18): cron `user-id-backfill-sweep`(월 0시)이 dry-run→안전 subset 자동 apply. **user_points 충돌은 자동병합 안 함** — 어드민 벨 보고만(수동 검토) | 어드민 벨에 충돌 알림 오면 그 건만 검토 | 낮음(자동·멱등·충돌 무접촉) |

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
- ✅ **상시 ON 전환**(2026-07-18, 대표 "자동으로 켜둬"): `MATCHING_ENABLED = true` — 실질 게이트는
  **어드민 잠금**(어드민 로그인 + 서버 `requireAdmin`)이라 소비자/광고주 노출 0. 데이터 없으면 목업
  미리보기, 쌓이면 실측 자동 전환(스위치 조작 불필요).
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

## 📅 운영 캘린더 — 파일럿 기간에 **스스로 움직이는 것**

> 대표 지시 2026-07-29: *"8/22 voucher 자동환불 1건은 인지했다 — 방배 운영 캘린더에 기록해둘 것."*
>
> 여기 적는 것은 *"우리가 할 일"* 이 아니라 **"우리가 안 건드려도 그날 일어나는 일"** 이다.
> 파일럿 중 예상 못 한 움직임을 보고 장애로 오인하지 않기 위한 목록이다.

| 날짜(UTC) | 무엇 | 조건 | 규모 | 판정 |
|---|---|---|---|---|
| **2026-08-22 18:00** | `expired-voucher-refund` 가 **교환권 1장 만료 처리 + 딜 환불** | `0 18 * * *` 블록이 그날 발화해야 함(현재 등록돼 있으나 **7일 중 2일 결측** 실적) | **1건 · 1,800딜** (구매자 딜포인트 환불 + 알림 1건) | 정상 동작이다. `vouchers.id=1` 이 `expired` 로 바뀌고 사용자 딜 잔액 +1,800 |

**근거(2026-07-29 실측)**: `vouchers` 테이블 **전체 1행** — `unused` · `expires_at 2026-08-22T02:55:49Z` ·
`deal_points` · `applied_price 1,800`. 그 전까지 이 cron 의 대상은 **0건**이다.

- 환불 방향은 소비자에게 유리하고 CAS(`status='unused'` 일 때만 전이)로 이중환불이 막혀 있다.
- ⚠️ **그날 아무 일도 안 일어나면** 그건 정상이 아니라 `0 18` 결측일 가능성 —
  `docs/design/cron-staged-ignition-plan-2026-07.md` §4-b 의 미해결 항목이다.
- 새 교환권이 팔리면 이 표를 갱신할 것(만료일 = 발급일 + 90일).

---

## 격리 원칙 (모든 세션 준수)
1. **순서**: 1(데이터) → 2(보안/PII) → 3(매칭 읽기) → 4(정산 머니). 앞 단계 검증 후 다음.
2. **격리**: 각 phase 독립 스위치. 한 phase 문제가 다른 phase로 안 샘.
3. **머니 단독**: Phase 4는 반드시 단독 세션 + staging 실결제(#496). 읽기와 안 섞음.
4. **되돌리기**: 각 스위치 OFF면 즉시 현행. 코드는 게이트 뒤에서 보존.

## 구현 로그
- 2026-07-14 — 런북 신설(활성 순서 SSOT). 매칭(#523) 완성 시점 기준. 감사(#514)·PII·데이터상품(#520) 문서는 각 PR.
