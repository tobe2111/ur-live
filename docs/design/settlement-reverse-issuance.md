# 유어딜 정산 세금계산서 역발행 (매입세금계산서)

작성일: 2026-07-01 · 브랜치: `claude/yourdle-settlement-reverse-issuance`

## 배경 / 결정

유어딜(플랫폼)이 **사업자 유저 셀러**(공급자)에게 정산금을 지급하면, 세법상 셀러가 유어딜 앞으로
매출세금계산서를 발행해야 한다. 셀러 수백 명이 각자 수기 발행하면 누락·오류·독촉이 반복된다.

→ **플랫폼 표준 = 역발행**: 유어딜(공급받는자)이 **매입세금계산서 초안을 자동 작성**해 셀러에게 보내고,
셀러는 대시보드에서 **승인 클릭 1번**으로 발행을 확정한다. **카카오 애드핏 = 유니포스트 역발행**이 정확히
이 모델(광고 수익 지급 대상 = 공급자, 애드핏 = 공급받는자, 애드핏이 역발행 초안 → 매체 승인).

- **방향**: 셀러 = 공급자, 유어딜 = 공급받는자. 매입세금계산서 역발행(셀러→유어딜).
- **대상**: 사업자 유저(`sellers.business_registration_status='verified'` + 유효 사업자번호)만.
  비사업자/미검증 셀러는 기존 **원천징수(8.8%/3.3%) + 지급명세서** 경로가 그대로 처리(세금계산서 대상 아님).
- **금액**: 지급된 정산액(`settlements.amount`)을 **공급대가(부가세 포함)** 로 보고 공급가액/세액 분리
  (`round(gross/1.1)` = 공급가액, 나머지 = 세액). 도매 `splitWholesaleVat` 와 동일 식.
- **앵커(트리거)**: 실제 현금 지급 이벤트 = `PATCH /api/admin/payout-center/seller/:id/paid`
  (`settlements.status → 'paid'`). 이 시점에 역발행 초안을 **멱등(settlement_id) 자동 생성**.

## 아키텍처

```
정산 지급(payout-center seller/:id/paid, CAS)
   └─ [additive · fail-soft · waitUntil]
      generateSettlementReverseInvoice(DB, env, settlementId)
         ├─ 사업자 유저 게이트(verified + biz_no) 아니면 skip
         ├─ settlements.amount → VAT split
         ├─ INSERT settlement_tax_invoices (status='draft', UNIQUE settlement_id 멱등)
         └─ provider 설정 시 requestReverseInvoice() → status='requested'(승인대기) / 'issued'
                                     (미설정 → 'draft' 유지, cost-0)

셀러 대시보드(SellerSettlementsPage → SettlementTaxInvoicesSection)
   ├─ GET  /api/seller/settlement-tax-invoices        (목록)
   └─ POST /api/seller/settlement-tax-invoices/:id/approve  (승인, CAS)

어드민(admin-tax.routes)
   ├─ GET  /api/admin/tax/settlement-invoices          (전체 현황)
   └─ POST /api/admin/tax/settlement-invoices/:id/reissue  (재발행/재요청)
```

### provider 게이트웨이 (`src/worker/utils/tax-invoice-gateway.ts`)
발행 채널을 **한 곳**으로 모은 provider-agnostic 게이트웨이(Toss confirm 헬퍼와 같은 "직접 fetch 금지" 철학).

| `REVERSE_INVOICE_PROVIDER` | 동작 |
|---|---|
| 미설정(기본) → `none` | 항상 skip. draft 로만 남음. 실 발행 0(cost-0). |
| `stub` | 외부 호출 없이 '요청됨' 반환 — 스테이징 승인 흐름 테스트용. |
| `unipost` | 유니포스트 e-tax 역발행 API 호출(자격증명 필수). |

**env** (`env.ts`): `REVERSE_INVOICE_PROVIDER`, `UNIPOST_API_URL`, `UNIPOST_API_KEY`,
`UNIPOST_CORP_NUM`(유어딜 사업자번호, 미설정 시 `TAX_INVOICE_SENDER_BIZ_NO` fallback).

### 상태 머신 (`settlement_tax_invoices.status`)
```
draft ──(provider 요청)──▶ requested ──(셀러 승인)──▶ approved ──(NTS 발행)──▶ issued
  │                          │                                                    ▲
  └───────(셀러 승인, provider 미설정)───────▶ approved ──────────────────────────┘
  └──(provider 거부)──▶ failed ──(재발행)──▶ requested
```
- 멱등: `UNIQUE(settlement_id)` + `INSERT … ON CONFLICT DO NOTHING`.
- 승인/재발행은 CAS(`meta.changes`)로 이중 처리 차단.

## 안전 규칙 (머니/정합성)
- **전부 additive · fail-soft(never throw) · env-gated.** 세금 레코드 실패가 정산 지급을 막지 않는다.
- 정산 지급(CAS)·금액·**원천징수 로직은 byte 불변** — 지급 *이후* 기록만 추가.
- 금액은 **서버 재계산값만** 사용(클라이언트 신뢰 금지).
- **서비스 분리**: 소비자(유어딜 공구) 전용. 도매몰 `wholesale_tax_invoices` 와 별개 테이블·별개 흐름.

## 운영 전환 체크리스트 (실 발행)
1. 유니포스트(또는 대체 ASP) 계약 + 유어딜 사업자번호(`UNIPOST_CORP_NUM`) 등록.
2. `unipostRequestReverse()` 의 엔드포인트/필드/응답코드를 **계약 문서 기준으로 확정**(현재 스켈레톤).
3. 스테이징에서 `REVERSE_INVOICE_PROVIDER='stub'` → 승인 흐름 E2E 1회.
4. 사업자 유저 실계정으로 `'unipost'` 실발행 1회(공급가액/세액/역발행 승인 확인).
5. 셀러 대표자명/업태/종목/주소는 `seller_business_info`(migration 0012)에서 보강 — 미입력 계정은
   승인 전 사업자정보 입력 유도(후속 UI).

## ⚠️ 세무 검토 필요 사항 (사용자/세무사 확인)
- 현재 `deal-withdraw` 경로는 검증 셀러에도 8.8% 원천징수를 적용한다. 사업자(세금계산서 발행) vs
  비사업자(원천징수)는 **상호배타적 과세**이므로, 사업자 유저의 현금 정산을 세금계산서 기준으로 전환할 때
  원천징수와의 중복을 정리해야 한다. 본 역발행은 **draft/기록 단계라 기존 원천징수 로직을 바꾸지 않으며**,
  실 발행 전 이 정책 결정을 반영한다.

## ✅ 구현 완료 (1차 — 인프라 + 초안/승인 레일)
- 게이트웨이 `tax-invoice-gateway.ts` (유니포스트 adapter 스켈레톤 + stub + none).
- 모듈 `settlement-tax-invoices.ts` (스키마·생성·목록·승인·재발행, fail-soft·멱등).
- 훅 `admin-payout-center.routes.ts` `seller/:id/paid` (additive·waitUntil).
- 셀러 라우트/UI(`SettlementTaxInvoicesSection`), 어드민 라우트.
- repair-schema 등록(`settlement_tax_invoices`, `seller_business_info`), env.ts.
- commit: (아래 커밋 해시 추가)
