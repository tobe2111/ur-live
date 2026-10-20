# 💸 Fee-resolver 실배선 전 정합 결정 시트

**작성**: 2026-06-29 · **상태**: ⏳ 대표 결정 대기 (결정 후 배선은 기계적)
**관련**: `src/worker/utils/fee-resolver.ts`(구현·미배선) · `docs/design/product-ownership-model.md`(정책 확정) · `src/tests/unit/fee-resolver.test.ts`(26 불변식)

> **왜 이 문서**: 리졸버(SSOT)는 깔끔한 **5-슬라이스 타겟 모델**로 구현돼 있으나, **라이브 커미션이 그 모델과 어긋나 있다**(아래 표). 리졸버를 *그대로* 배선하면 **실제 파트너 지급액이 바뀐다**(영입자 1.5% 증발, 에이전시 2%→1%+24개월 절벽, ₩30k 보너스 증발). 그래서 배선은 "스위치"가 아니라 **대표 결정 5~6건**이 선행. 이 문서가 그 결정을 한 번에 모은 시트 — 결정만 채워지면 배선은 기계적 + 스테이징 검증.

---

## 1. 라이브 커미션 인벤토리 (ground truth — 코드 직접 확인)

| # | 커미션 | 라이브 율/주기 | 출처 | 코드 | 원장 테이블 | 역전(환불) |
|---|---|---|---|---|---|---|
| A | 플랫폼 수수료 | **5%** (3P) / 0% (1P) — `sellers.commission_rate` COALESCE 5 | 소비자 결제 | `settlement-automation.ts`(이번 세션 5% 통일) | 정산 차감 |
| B | 에이전시 매장영입 | **2%** 매 주문 **영구**(한도 없음) + **₩30,000** 첫주문 보너스 1회 | **추가**(가게 부담 — 플랫폼서 분배 아님) | `agency-store-intro-commission.ts` | `agency_store_intro_commissions` | `reverseAgencyStoreIntroOnRefund` ✅ |
| C | 영입자(인플) 매장영입 | **1.5%** 매 주문 **영구** | 추가 | `influencer-store-intro-commission.ts` | `influencer_attributions(source='store_intro')` | `reverseInfluencerStoreIntroOnRefund` ✅ |
| D | 홍보 소개비(핀/affiliate) | 어드민 `platform_settings.affiliate_commission_rate`(CAC, 플랫폼 설정) | 추가 | `affiliate-credit.ts` | affiliate_earnings | 환불 회수 ✅ |
| E | 제조가(공급가) | 도매 사입 원가 | 별도 B2B 축 | `supply-settlement.ts` `creditSupplierOnOrder` | supplier settlement | `reverseSupplierOnRefund` ✅ |

세 적립(B/C/E)은 `creditOrderCommissions`(order-commissions.ts)에서 order_id 멱등으로 confirm·webhook 양쪽 호출.

## 2. 리졸버 타겟 모델 (5 슬라이스) — `resolveOrderFees`

```
amount = platform(1P=0) + supply + promo + ownerNet
                └ 안에서 agency 분배(≤ platform)
```
- **platform**: 3P 5% / 1P 0%
- **agency**: platform *안에서* 1%(기본), 실판매+24개월+영입에이전시 있을 때만, per-agency override
- **supply**: 제조가(B2B 원가)
- **promo**: 홍보 소개비 — **주인 자율**(주인 몫에서, 음수 가드)
- **ownerNet**: 나머지 전부(반올림 잔차 흡수 → 합 항등식 ±0)

## 3. 갭 & 결정 필요 (대표만 가능 — 파트너 지급 변경)

| ID | 결정 | 현재(라이브) | 타겟(리졸버) | 영향 |
|---|---|---|---|---|
| **D1** | 에이전시 율 | 2% | 1% | 에이전시 수입 절반 |
| **D2** | 에이전시 24개월 한도 | 없음(영구) | 24개월 | 24개월 지난 영입건 적립 중단. **기존 영입건에 소급?** |
| **D3** | 에이전시 출처 | **추가**(가게 부담↑) | 플랫폼 5%서 분배(가게 부담 0) | 가게 순수익 ↑, 플랫폼 net ↓ |
| **D4** | 영입자(인플) 1.5% | 있음(C) | **모델에 슬라이스 없음** | 유지? 폐지? agency로 흡수? |
| **D5** | 활성화 보너스 | ₩30,000 | "기본값"(금액 미확정) | 유지/조정 |
| **D6** | affiliate(핀) = promo? | 플랫폼 설정율(CAC) | 주인 자율 | 책정 주체 이동(플랫폼→주인) |

> 정책 문서(`product-ownership-model.md`)는 B(에이전시)를 **1%/24개월/플랫폼분배**로 *확정*했고 C(영입자)는 **모델에 없음** — 즉 라이브가 정책보다 후하게(에이전시 2%+영구+추가, 영입자 추가 1.5%) 나가는 중. 정책대로 조이면 절감이지만 **기존 파트너 약속 변경**이라 소급 여부(D2)가 민감.

## 4. 시나리오 before/after — 3P 공구권 10,000원 (에이전시+영입자 영입 가게)

| 슬라이스 | 라이브(현재) | 리졸버(타겟, D1~D4 정책대로) |
|---|---|---|
| 플랫폼 net | 500 (5%) − 0 분배 = 500 | 500 − **agency 100** = 400 |
| 에이전시 | **200**(2%, 추가) | **100**(1%, 플랫폼서) |
| 영입자(인플) | **150**(1.5%, 추가) | **0**(모델 없음) ← D4 |
| 보너스(첫주문) | ₩30,000 1회 | D5 |
| 주인(가게) 순수익 | 9,000 − (추가분 영향은 정산구조) | 9,000 |

→ 가게 입장: 현재는 플랫폼5%만 떼지만 에이전시/영입자 적립이 **추가 비용**으로 정산구조에 어떻게 반영되는지(가게 부담 vs 플랫폼 부담)가 D3 핵심. 리졸버는 "가게 부담 0"(플랫폼서 분배)로 못박음.

## 5. 배선 계획 (결정 확정 후 — 기계적)

1. **shadow mode 먼저(안전)**: `/confirm` 에서 `resolveOrderFees` 를 **계산만**(적립은 기존 유지) + 결과를 기존 적립합과 비교 로깅 → 며칠 라이브 로그로 "리졸버 = 의도값" 확인. 돈 영향 0.
2. **컷오버**: 슬라이스별로 기존 credit 함수를 리졸버 출력 기반으로 대체. `loadFeeRates(DB)` 주입 → `resolveOrderFees` → platform/agency/supply/promo 적립. C(영입자)는 D4 결정대로 유지/제거/흡수.
3. **잠금파일 절차**: `/confirm` 은 잠금 → `AskUserQuestion` 승인 + CLAUDE.md audit-log + ASCII commit.
4. **환불 역전**: `negateBreakdown` 대칭 — `order-refund.ts` + `returns.routes.ts` 양쪽(기존 reverse* 패턴 대체).
5. **요율 어드민화**: `fee_platform_pct_3p`/`fee_agency_pct`/`fee_agency_term_months`(migration 0283) + per-agency override UI.

## 6. 안전레일
- 리졸버는 **순수함수 + 26 불변식 테스트**(합=결제액, ownerNet≥0, agency≤platform, 1P=0).
- **shadow mode**로 컷오버 전 라이브 일치 확인(돈 영향 0).
- 단계적: platform/agency 먼저(검증 쉬움) → promo/supply.
- ⚠️ **스테이징 실결제 검증 필수**(이 환경 egress 차단 — 라이브 검증 불가).

---

## 결정 기록 (채워질 곳)
- D1 _____ · D2 _____ · D3 _____ · D4 _____ · D5 _____ · D6 _____
- 승인일 _____ · 배선 commit _____
