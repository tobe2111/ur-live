# 🎯 전환추적(진짜 ROAS) — QR 실방문 증명 통합 설계 SSOT

> **2026-07-21 대표 방향**: "부정클릭 픽셀 인프라 재활용 → 구매완료 픽셀 → 실전환/매출 귀속. 유어딜 QR
> 실방문 증명과 개념이 겹치니 **함께 설계**." **착수는 10월**(지금은 설계만 — 실판매 데이터 나온 뒤).
>
> 핵심 통찰: 유어애즈 광고는 "클릭 → 유어딜 딜 구매 → **매장 실방문(QR 사용)**"까지 가야 진짜 전환이다.
> 유어딜은 이미 **QR 실방문(voucher 사용)** 을 ground-truth 로 갖고 있다 → 광고 ROAS 의 최종 분모/분자를
> 클릭·주문이 아니라 **실사용(실매출 확정)** 으로 잡을 수 있는 드문 구조. 이게 대표가 말한 "겹침".

## 0. 왜 지금 설계만 (착수 10월)

- ROAS = 귀속매출 / 광고비. **귀속매출의 신뢰도**가 핵심인데, 8월 방배 시드 캠페인 전엔 실판매·실사용
  데이터가 0 → 지금 가중치·귀속창(window)·감쇠(decay)를 정하면 **추측**이라 다시 짜야 함(갭 ④ fit 스코어와 동일 사유).
- 그래서: **이벤트 수집 파이프라인(픽셀·조인)** 은 미리 설계·(가능하면)배선하되, **스코어링/귀속 규칙은
  8월 데이터로 캘리브레이션**. 이 문서는 그 경계를 고정한다.

## 1. 기존 인프라 재활용 (신규 최소화)

| 자산 | 위치 | 재활용 |
|---|---|---|
| **clickguard 픽셀** | `features/marketing/api/clickguard.ts`(`/clickguard/pixel.js`·`hit`) | 광고주 사이트 삽입 픽셀 인프라 → **구매완료 픽셀**(conversion) 확장. PIPA 해시·90일 자동삭제 그대로 |
| **inflow_clicks** | `worker/utils/inflow-clicks.ts` (`ref_id`·`anon_id`·`user_id` first-touch) | 클릭 → 유입 귀속(이미 존재). ref_id=유입원(인플/광고 캠페인) |
| **voucher_visits** | (매장 QR 사용 기록) | ⭐ **ground-truth 전환** — 클릭이 실매장 방문/사용까지 이어졌는가 |
| **affiliate_earnings** | `worker/utils/affiliate-credit.ts` | 주문 단위 귀속(referrer_id·order_amount·commission·status holding→granted) |
| **매칭 엔진(PR #523)** | `features/marketing/api/matching.ts` `getInfluencerMetrics` | inflow_clicks→voucher_visits first-touch 조인 CTE 이미 존재(admin 전용) → ROAS 뷰로 확장 |
| **searchad stats** | `features/marketing/api/searchad-client.ts` | 광고비(분모) — 네이버 검색광고 실비(impressions·clicks·cost) |

## 2. 전환 퍼널 (4단 — 각 단이 다음의 분모)

```
① 노출/클릭(광고비 발생)  → searchad stats · clickguard hit
② 유어딜 유입(landing)     → inflow_clicks (ref_id=캠페인/인플, anon_id, user_id 로그인시 bind)
③ 딜 구매(결제확정)        → orders / affiliate_earnings (order_amount = 명목매출)
④ 매장 실사용(QR 사용) ⭐  → voucher_visits (실매출 확정 = 진짜 전환)
```

- **CVR 단계별**: 클릭→유입, 유입→구매, 구매→실사용. 어디서 새는지 진단.
- **ROAS(명목)** = Σ③ order_amount / 광고비. **ROAS(실질)** = Σ④ 실사용액 / 광고비 ← 대표가 원한 "진짜".
- 실질 ROAS 가 유어딜의 **차별점**: 대부분 광고 플랫폼은 ④를 못 봄(클릭·주문까지). 유어딜은 QR 로 봄.

## 3. 귀속 모델 (규칙은 8월 캘리브레이션 — 기본값만)

- **first-touch**(기본, 매칭엔진과 동일): 유저의 최초 inflow_clicks.ref_id 가 그 유저의 이후 구매/사용을 귀속.
  (last-touch·multi-touch 는 데이터 본 뒤 옵션.)
- **귀속창(window)**: 클릭 → 구매 N일 이내(기본 30일, 어드민 조정). 구매 → 사용은 이용권 유효기간 내.
- **중복 제거**: anon_id·user_id 로 dedup(매칭엔진 `n < N_MIN=5` 억제 규칙 계승 — 소표본 노출 안 함).
- **PIPA**: 개인 식별자 해시·90일 자동삭제(clickguard 계승). 집계만 노출, 개인 단위 미노출.

## 4. 산출물 (뷰)

- **광고주 대시보드**: 캠페인별 실질 ROAS·단계별 CVR·실사용 매출. `getInfluencerMetrics` 를 ROAS 뷰로 확장.
- **크리에이터 성과 탭 연계**: 이미 만든 `/api/affiliate/stats`(클릭·전환율·적립) 에 ④ 실사용 전환 추가 가능.
- **어드민**: 캠페인 ROI·부정전환(클릭만 많고 ④ 0) 이상탐지.

## 5. 신규 최소 (착수 시)

- [ ] 구매완료/사용 픽셀 이벤트: clickguard 픽셀에 `conversion`(order)·`redeemed`(voucher use) 타입 추가.
- [ ] `ad_conversions` 격리 테이블(anon_id/user_id·ref_id·order_id·stage·amount·hashed·created_at) — 90일 TTL.
- [ ] ROAS 조인 뷰(inflow_clicks ⋈ orders ⋈ voucher_visits, first-touch CTE 재사용) — 광고비(searchad)와 결합.
- [ ] 어드민/광고주 ROAS 패널.
- ⚠️ 전부 **읽기전용 집계 + 격리 테이블 + 게이트** — 결제/정산 머니 경로 무접촉(잔존장치·수집과 동일 원칙).

## 6. 경계 / 서비스 분리

- 유어애즈(ur-ads 워커) 소유. 유어딜 소비자 결제/정산 로직 무접촉(voucher_visits 는 읽기만).
- 크로스서비스 데이터(유어딜 voucher_visits → 유어애즈 ROAS)라 **읽기 경계**만 넘고 쓰기 안 함.

## 구현 로그
_(착수 10월 — commit hash 기록)_
