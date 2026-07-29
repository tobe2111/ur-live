# 유어애즈 — 마케팅 서비스몰 (Service Marketplace)

> 2026-07-02 대표 시안(스크린샷) — 마케팅 서비스를 상품처럼 파는 페이지. 유어애즈 안에 구현.
> 결정(AskUserQuestion): **주문요청 접수(무결제)** · **마케팅 서비스 카탈로그(확장형)** · **유어애즈 안(/ads/services)**.

## 시안 요약 (스크린샷)
카카오톡 브랜드(노랑) 상품 상세 + 주문 페이지:
- 상단 히어로 카드: 상품명("카카오톡 재테크 공구 늘리기") + **기간 티어 버튼**(1개월/3개월/6개월/12개월…) + **수량 입력** + 우측 **주문 패널**(가격 계산 60,000원 + '로그인 후 주문하기')
- 하단: 긴 **상세/FAQ**(서비스란 무엇인가 · 어떻게 참여 · 추가 옵션 · **수량별 할인표**(1~4주 0% / 5~8주 7% / … ) · 주의사항 · 알림톡)

## 구현 (2026-07-02)
- 표면: `/ads/services`(대시보드 섹션 `sec-services`). 인증 = ad_accounts(유어애즈 계정).
- 데이터: `ad_services`(카탈로그) · `ad_service_orders`(주문요청 큐, 무결제).
- 가격: `computeServicePrice`(순수) — 단위가×수량 → 수량구간 할인% → +옵션. presets(빠른 기간 선택) = 수량 프리셋.
- 주문: 티어/수량/옵션 선택 → 가격계산 → **주문요청 제출**(연락처 카톡/전화/메모) → status=`requested`. 어드민이 접수함에서 확인·상태변경·수동정산.
- 어드민: `AdminAdsServicesPage` — 주문 접수함(상태: requested→confirmed→in_progress→done/cancelled) + 상품 관리(등록/수정/노출토글).
- 시드: 카카오톡 오픈채팅 멤버 · 인스타 팔로워 · 블로그 상위노출(테이블 비었을 때 1회).

## 결제(향후)
현재 무결제(요청 접수). 실결제 원하면 유어딜 Toss helper 호출로 연동(잠금파일 미수정, helper만 호출) — 별도 작업.

## ✅ 구현 완료
- backend `ad-services.ts` · `routes/services.routes.ts` · admin 엔드포인트(admin-ads.routes)
- UI `ServiceMarketplacePanel.tsx` · `AdminAdsServicesPage.tsx`
- 단위테스트 `ads-service-price.test.ts`(가격 계산)
- commit: (아래 커밋 hash)

## 수기 결제(계좌이체) 흐름 — 2026-07-10 (대표 "내가 수기로 하게")
PG 미연동 상태에서 수기 운영 완결: ① 주문 접수 직후 + 내 주문(미입금 존재 시)에 **입금 계좌 안내**(`ADS_BANK_INFO` env, 미설정 시 생략) ② `ad_service_orders.payment_status`(unpaid→paid/refunded) ③ 어드민 접수함 **입금확인 토글**. 고객 배지 = 입금 대기/입금 확인. 실 PG(토스) 연동은 별도 작업(잠금 helper 호출 방식).
