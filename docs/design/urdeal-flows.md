# 유어딜 전체 플로우 — 구현 기준 SSOT (2026-07-10)

> **목적**: 에이전시향·어드민향·매장향·소비자향 전체 플로우를 **구현된 코드 기준**으로 기록. 대표 검토(2026-07-10)에서 확인된 오류 2건 정정 반영: ① payout 3중 가드는 "적용됨"이 아니라 **PR #479 draft(staging 검증 전, 라이브 미적용)** ② 하단 탭에 "공구권" 없음(스테일 기록이었음 — 실제 구성 아래).
> 구조 SSOT 는 `urdeal-platform-model.md`(전체 그림) — 본 문서는 그 *플로우 절단면*. 커미션 재원: `commission-funding-restructure.md` §확정 원칙 · 위임: `vendor-commission-passthrough.md` §4.3 · flip 잔여: `flip-ui-checklist-2026-08.md`.

## 0. 계정 체계 — 누가 어디로 로그인하나 (전부 로그인 필수)

| 역할 | 로그인 | 인증 실체 | 대시보드 |
|---|---|---|---|
| 유저(소비자) | `/login` | 카카오 → httpOnly `ur_session` | 소비자 앱(`/`·`/vouchers`·`/u/*`…) |
| **매장(사업자 유저)** | `/seller/login` — **카카오 단일 로그인 권장**(same-email 자동연결, `seller_token` 자동 발급) 또는 이메일/비번 | `seller_token` JWT | **셀러 대시보드 `/seller/*`** |
| 에이전시 | `/agency/login` | `agency_token` (없으면 리다이렉트, agency.routes.tsx:52) | `/agency/*` |
| 어드민 | `/admin/login` | `admin_token` + RBAC(재무 화면 finance 역할) | `/admin/*` |

**매장 = 별도 계정이 아니라 레이어**: 유저가 사업자등록→판매 승인되면 같은 카카오 계정에 셀러 권한이 *추가*됨(신분 교체 X). 이용권 QR 스캔(`StoreScanPage`)도 `seller_token` 보유자만 — 매장 운영은 반드시 로그인 기반.

## 1. 소비자 플로우

1. **진입**: 홈 `/` = 동네딜(내 주변 매장 이용권) 표면. **하단 5탭(BottomNav.tsx:197-218) = 홈 / 교환권(`/vouchers`) / 이용권(`/my-vouchers` 지갑) / 유어샵 / 마이.** *(2026-07-10 대표 결정: 탭2 라벨 쇼핑→교환권, `/vouchers` 내 일반상품 섹션은 `SHOPPING_TAB_HIDDEN` 게이트 숨김 — 교환권은 유지. 인플 딜포인트→교환권 구매 경로가 이 카탈로그에 의존하므로 숨김 범위는 일반상품 한정.)*
2. **구매**: Toss 결제위젯 또는 딜 포인트(1원=1딜, `/points/charge`) 혼합 → `/api/payments/confirm` 서버 권위 검증·확정.
3. **사용**: 이용권 탭(`/my-vouchers`) → QR/PIN 티켓 → 매장 방문 사용. 교환권(기프티콘)은 KT-Alpha 자동 발송.
4. **담기(핀)**: 가입 즉시 유어샵 `/u/{handle}` 자동 생성 — 담아서 공유. ⚠️ **적립은 자동으로 안 붙는다**: 어필리에이트(누구나 공유 2%)는 **종료**(2026-08-22 대표). 소개비는 **매장이 그 사람에게 딜을 제안한 경우만**(`seller_influencer_deals`, 제안서의 % · 매장 부담).

## 2. 매장향 플로우 — `/seller/*`

**핵심 루프**: 이용권 등록(`/seller/meal-vouchers/new` — promo% 필드는 `SELLER_PROMO_FIELD_ENABLED=false` 로 미노출, 8월) → 판매 → QR/PIN 사용 처리(`/seller/voucher-scan`) → **사용 확인분 주간 정산**.

**정산 (구현 사실 — T+7 아님)**: 이용권 사용분은 `used_at < 주간 cutoff` 기준 **주간 배치**(auto-settlement, 실질 4~10일 lag / ledger 레일은 주간 payouts-generate). **매장 정산에 T+7 hold 없음 — T+7 은 커미션 전용**(인플 pending→available, 에이전시 성숙). ⚠️ 회사소개서에 "매장 정산 T+7" 표기가 있으면 "매장: 사용 확인 후 주간 정산 / 커미션: T+7 성숙 후 지급" 으로 수정 대상(대표 확정 2026-07-10).

**신설 표면(2026-07-10, PR #483)**: `/seller/promo-spend`(소개비 내역 — funding 게이트 문구) · `/seller/agency-delegation`(위임 grant/무조건 revoke) · `/seller/influencer-deals`(인플 협업 제안/수락).

## 3. 에이전시향 플로우 — `/agency/*`

- **현행**: 매장 영입(`introduced_by_agency_id`) → 매출 1%/24개월 커미션 적립 → T+7 성숙 → **어드민 payout-center 에서 유어딜이 지급**(`/agency/settlements` 조회). *← 이 "유어딜이 지급" 구조가 8월 flip 재배선 대상. 재배선 스펙 원칙: 고정 % 재원 이전 ✗ / promo 내 협상 마진(분배 엔진 B3 + 3단 위임) ✓.*
- **신설(PR #483)**: `/agency/delegations` — 매장 목록+모드 배지, 90일 소개비 실측 vs 그림자, 모드 **요청만**(발효는 매장 grant — 유어딜 관여 X).

## 4. 어드민향 플로우 — `/admin/*`

- **운영**: 셀러 승인 → 주간 payout 승인·송금(`/admin/payouts`) → 커미션 지급(`/admin/payout-center`) → 모니터링(cron 3채널 경보·주간 요약) → 세무 CSV.
- ⚠️ **payout 3중 가드(승인 CAS·계좌누락·중복기간)+clawback 조회+레일 대사는 PR #479(draft)에 있음 — staging 4항목 검증 후 단독 머지 예정, 라이브엔 아직 미적용.** 서초 첫 정산 전 필수 경로.
- **flip 조종석**: `/admin/platform-settings`(스위치 4종, 전부 OFF — ⚠️ 공구엔진 `gb_engine_enabled` 토글은 여기 없음, 8월 추가 필요) · `/admin/promo-ledger`(불변식 #44 검증, PR #483) · `/admin/fee-breakdown`(그림자 비교).
- **요율 설정(현행)**: `/admin/commission-settings` 등 — flip 후 "설정자→캡 가드"로 축소 예정.

## 5. 돈 흐름 (구현 기준)

```
소비자 결제 100% ─ 유어딜 5%(platform:revenue, PG 는 이 안에서 흡수)
                └ 매장 95%(net 원장 → 주간 payout → 매장 계좌)
[현행 커미션] ~~어필리에이트 2%~~·~~멀티티어~~ 종료(08-22/23) · 매장 영입 **2%**(유효기간 1년, 08-27 대표) · 에이전시 1%/24mo · 딜 제안 %(매장 부담)
[8월 flip] promo_funding_source='owner' → 전 축 매장 promo(95% 안)로 + 신규 화면 문구 동시 전환(런타임 게이트)
[8월 잔여 — 축소 인식 금지] A1 스위치 ON(staging 실결제)·A3~A9 재배선·B3 분배 엔진(신규 개발)·B1/D1 기존 문구·C1/C2/E1
```
