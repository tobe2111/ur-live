# 디자인 시안 archive

이 폴더는 사용자가 제공한 UI/UX 디자인 시안과 그 구현 상태를 추적합니다.

## 작성 규칙

1. **파일명**: `<page-or-component-name>.md` (예: `home-sidebar.md`, `checkout-page.md`)
2. **각 파일 구조**:
   - 시안 이미지 또는 설명
   - 시안 받은 날짜 / 출처
   - 핵심 요구사항 (섹션별)
   - 현재 구현 vs 시안 차이점 표
   - 구현 todo 체크리스트
   - 완료 시 commit hash 마킹

## 시안 받았을 때 절차 (필수)

1. 이미지를 `docs/design/<page-name>.png` 으로 저장 (Claude Code 가 multimodal 이라 첨부 이미지 직접 읽음 — 저장은 사용자 수동)
2. `docs/design/<page-name>.md` 작성: 시안 설명 + todo
3. 같은 commit 으로 push (구현 전이라도)
4. 구현 완료 시 같은 파일 하단에 `## ✅ 구현 완료` 섹션 + commit hash 추가

## 미구현 시안

| 페이지 | 시안 받은 날 | 상태 | 파일 |
|---|---|---|---|
| **🛍️ PC 홈 — 그루폰 UI 참고 방향**(대표 "그루폰 최대한 참고" + 그루폰 홈 스크린샷 공유) | 2026-08-17 | 🟡 부분 구현 — 컴팩트화·1줄 5개·4:3 카드·섹션 행은 PR #1161 반영. 잔여 채택 후보(섹션 카드 평점·할인 pill·가로 캐러셀·카드 하트 등)는 문서 체크리스트에 — 대표 우선순위 대기. ⚠️ groupon.com 은 이 원격환경에서 접근 불가(프록시 차단) — 스크린샷 기반 | [groupon-reference-home.md](./groupon-reference-home.md) |
| **🎨 시안 도착 — 운영자 몰 파일럿 화면 A·A-2·B·C·D**(Claude Design 핸드오프. 원본 `.dc.html` + 다이클로 참고 10장 포함) | 2026-08-02 | ✅ 구현 완료 (`94d58eb`·`c3c50d4`·`1f5036a`·`dcec8dd`) — 🔴 **의뢰서 §5.1(로즈) 무효**, `branding.ts` 대표 확정(몰 `#2E7D5B`, 본진 로즈와 **구분**)이 우선. 다크는 운영자 색 안 씀(`colorDark` 항상 `#5FBF95`). 남은 것 2건: **화면 C 픽업일 미보유**(주문 API 가 `pickup_date` 를 안 실어 주문일로 대체) · **운영자 색 AA 대비 가드 부재**(코드 가드 필요) | [operator-mall-pilot.md](./operator-mall-pilot.md) |
| **🎨 디자인 의뢰서 — 운영자 몰 파일럿**(외주/AI 디자이너에게 **이 문서 하나만** 전달) | 2026-08-02 | 🟢 전달 준비 완료(시안 대기) — 사전지식 없이 읽히게 작성: 서비스 설명 → 사용자 2명 → 흐름 → **화면별 요소 전수 + 실제 문구** → 브랜드·제약 → 금지사항. Tier1 = 손님 가게 홈(유일 착지점) · 3분 등록(파일럿 판정 ①의 무대). ⚠️ 손님 화면만 다크 두 벌 / 사장님 화면은 라이트 한 벌(정반대) | [design-outsourcing-brief.md](./design-outsourcing-brief.md) |
| **🌏 해외판(GLOBAL) 실행 준비 상태** — "켜려면 실제로 뭐가 필요한가" 실측 체크리스트 | 2026-07-28 | 🅿️ 파킹(결정 대기) — 배포구조는 이미 해결(런타임 hostname 판정, 배포 1개+도메인 N개). **현 상태로 켜면 사고**: Stripe 가 주문 확정만 하고 이행(재고·발급·정산·알림) 0. 대표 결정 3건(무엇을 팔까·통화정책·유료전환) 후 착수. `ur-live-global` 은 폐기 확정 — **다시 만들지 말 것** | [global-launch-readiness.md](./global-launch-readiness.md) |
| **🧨 도매몰 전면 종료 — 철거 계획**(유통스타트+메디스타트 접음. 지울 것/잔류할 것 경계 · 머니 게이트 · 순서) | 2026-07-29 | 🟡 계획(코드 0) — **착수 전 머니 게이트 필수**(예치금·미확인충전·미지급정산·plus 4항목 0 확인). 🔴 최대 함정: `features/supply` 통째 삭제 시 **소비자 결제 파손**(order-commissions·order-refund·scheduled 가 부름). 삭제 대상은 라우트·화면이지 디렉터리가 아님. 덤: §8-C mall_id 겸용 문제 자동 해소 | [wholesale-teardown-plan.md](./wholesale-teardown-plan.md) |
| **🏪 도매몰 용도 변경 — 공구 운영자 SaaS 갭 판정**(B2B 유통 → 공구 운영자에게 자기 이름의 판. 셀프개설·자체상품등록·소비자결제·gb엔진·픽업·정산·예치금·덜어낼것 8항목) | 2026-07-29 | 🟡 조사·판정 완료(코드 0) — **최대 갭은 결제가 아니라 §2 운영자 자체 상품 등록 경로 부재**(판매사는 재판매 복제만 가능). 소비자 결제는 **소비자 레일로 태우면 됨**(도매 레일은 인증·스코프·테이블 불가). 운영자=**merchant**, 5% 불변식 그대로. 착수 조건 = gb 가격 결제 배선 완료 | [operator-mall-saas-gap.md](./operator-mall-saas-gap.md) |
| **🔗 픽업 공구 + 도매몰 연계**(대표 원문 아카이브 + 코드 대조 검증. 모드 A/B/C · 역할분담 · 정산 분리) | 2026-07-29 | 🟡 설계 · **대표 확인 A1 대기**(§4 HTTP 연계 폐기 제안 — 같은 D1 이라 불필요·역효과). 모드 C(상권 공동몰)는 `wholesale_malls` 멀티테넌트로 **신규 개발 거의 0 사실 확인** | [pickup-groupbuy-wholesale-link.md](./pickup-groupbuy-wholesale-link.md) |
| **🏪 매장 상품 픽업 공구 — 설계 판정**(매장이 자기 물리 상품을 공구로 팔고 매장에서 픽업. 재사용 범위·gb_mode 파손 지점·픽업확인·정산 판정) | 2026-07-28 | 🟡 조사·판정 완료(코드 0) — **대표 결정 D1(미수령 손실 귀속) 대기 = 블로킹**. 결론: 쇼핑 재오픈 아님, **이용권 레일 위 하위종**(`stay_voucher` 선례). 5%·promo 레일은 무변경 성립 | [store-pickup-group-buy.md](./store-pickup-group-buy.md) |
| **💸 벤더 커미션 Pass-through 분할**(소속 여부 자동분기 A/B + 딜단위 per-promo, order-commissions.ts 위에 얹기) | 2026-07-08 | 🅿️ 설계/구현 파킹 — 실벤더 1곳 이주 의사 시 그 벤더 분배방식에 맞춰 착수(단독 세션+staging). 규모 ≈10~14일 | [vendor-commission-passthrough.md](./vendor-commission-passthrough.md) |
| **📝 블로그 상세 — 3단 레이아웃**(좌 목차 + 중앙 본문 + 우 추천글, 아싸뷰 스타일) | 2026-07-02 | ✅ 구현 완료 | [blog-detail-3col.md](./blog-detail-3col.md) |
| **📝 블로그 UI — 토스 테크 스타일**(히어로 캐러셀 + 전체 아티클 리스트 + 페이지네이션) | 2026-07-01 | ✅ 구현 완료 (BlogListPage 전면 개편) | [blog-toss-style.md](./blog-toss-style.md) |
| 홈 사이드바 (3 섹션 + 카테고리) | 2026-05-06 | ✅ 구현 완료 (단, 홈은 2026-06-20 동네딜 지도로 전환됨 — 사이드바는 라이브 시절 잔재, 라이브 중단으로 사실상 무의미) | [home-sidebar.md](./home-sidebar.md) |
| Quick Action FAB (당근식 확장 버튼) | 2026-05-24 | ✅ BottomNav ➕ 시트로 구현(역할별 만들기 메뉴) | [quick-action-fab.md](./quick-action-fab.md) |
| **🚀 비즈니스 pivot — 링크샵·공구·어필리에이트** | 2026-05-25 | ✅ Phase 1–4 구현(링크샵·핀·어필리에이트 정산·공구 호스팅·셀러 승급). Phase 5(셀러 흡수)+폴리시만 잔여. ⚠️ 문서 내 '라이브' 언급은 **영구 중단**(LIVE_COMMERCE_SUSPENDED) — 무시 | [linkshop-pivot.md](./linkshop-pivot.md) |
| **🌐 유어딜 플랫폼 모델 — 전 서비스 마스터 SSOT(행위자·상품·경제·성장·로드맵)** | 2026-07-02 | 🟡 전략/설계 SSOT (살아있는 문서) · 새 세션 전체그림 진입점 · 결정 6건 §13 | [urdeal-platform-model.md](./urdeal-platform-model.md) |
| **🧭 링크샵 역할 모델 — 5부류 성과 구조 + 역할 적응형 링크샵(드릴다운)** | 2026-07-02 | 🟡 설계 / 대표 결정(§7 4건) 대기 · 1단계(매장 링크샵 하단 추천 opt-in 부활)부터 착수 권장 · 마스터=urdeal-platform-model.md | [linkshop-role-model.md](./linkshop-role-model.md) |
| **🚢 배송 시스템 재설계** | 2026-05-25 | ⏳ 컨셉 / 정책 결정 대기 | [shipping-redesign.md](./shipping-redesign.md) |
| **🛒 공동구매 = 즉시판매 모델** | 2026-05-30 | 🟡 설계 확정 대기 (A1/A2 + UNLOCK) | [groupbuy-instant-sale.md](./groupbuy-instant-sale.md) |
| **🏭 유통스타트 도매몰 — 제조사↔플랫폼↔유통사 등급제** | 2026-06-01 | 🟡 스펙 박제 / 결정(D-A~F) 대기 | [wholesale-utongstart.md](./wholesale-utongstart.md) |
| **🥕 공구 상세 hero — 당근 스타일 full-bleed + 스크롤 헤더** | 2026-06-07 | ✅ 구현 완료 | [groupbuy-detail-karrot.md](./groupbuy-detail-karrot.md) |
| **🎟️ 교환권 상세 — Refined Classic (그라데이션 카드+잔액)** | 2026-06-17 | ✅ 구현 완료 | [voucher-detail.md](./voucher-detail.md) |
| **🎫 교환권 `/vouchers` 1줄 리스트 배치 (이미지 좌+텍스트 우)** | 2026-06-20 | ✅ 구현 완료 | [voucher-list-row.md](./voucher-list-row.md) |
| **🔐 대시보드 토큰 httpOnly 쿠키 전환 (XSS 하드닝)** | 2026-06-17 | 🟡 설계 (단계 구현 대기 — Phase0 CSRF→admin→supplier/agency→seller) | [dashboard-cookie-auth.md](./dashboard-cookie-auth.md) |
| **🔗 링크샵 랜딩 리디자인 — 마퀴 + 배너 히어로 + QR + 사이드바 숨김 (나브랜딩 시안)** | 2026-06-17 | ✅ 구현 완료 (CuratorHeader 마퀴 헤드라인 + 풀블리드 배너 히어로) | [linkshop-landing-redesign.md](./linkshop-landing-redesign.md) |
| **📦 주문 내역/상세 — 무신사 스타일(썸네일·날짜그룹·검색)** | 2026-06-18 | ✅ 구현 완료 (옵션 A — 종류 탭 + 종류별 카드 + 데이터버그 3건 수정) | [my-orders.md](./my-orders.md) |
| **🎟️ 내 지갑 `/my-vouchers` — 흑백 iOS-클린 리디자인 (식사권/교환권 6화면)** | 2026-06-20 | ✅ 구현 완료 (단일 페이지 톤 리파인 + 지갑 4페이지 잉크 통일 / 지도·설정 전용화면 보류) | [my-vouchers-wallet-bw.md](./my-vouchers-wallet-bw.md) |
| **🗺️ 동네딜 = 지도 + 바텀시트 (에버랜드 파크맵)** | 2026-06-20 | ✅ 구현 완료 (홈 `/` = `RestaurantMapPage` 지도+드래그 바텀시트) | [dongnedeal-map-bottomsheet.md](./dongnedeal-map-bottomsheet.md) |
| **🖥️ PC = 중앙 모바일 액자 + 데코 사이드레일 + 하단 네비** | 2026-06-20 | ✅ 구현 완료 (`ConsumerFrameRails` + app-frame-host/bar) | [pc-app-frame-decorated-rails.md](./pc-app-frame-decorated-rails.md) |
| **🎟️ 동네딜 공구권 사용처리 — 매장원장+느슨카운터+정산검문 (SSOT 확정)** | 2026-06-20 | 🟢 Phase 1 착수 (매장원장 읽기 API ✅ / 셀프사용·에스크로 다음) | [dongnedeal-redemption.md](./dongnedeal-redemption.md) |
| **🏷️ 상품 소유 모델 — 원청(주인)/홍보(핀) + 어드민·셀러 업로드 통합** | 2026-06-23 | 🟡 정책 ✅ 확정 + fee-resolver SSOT·26테스트·settings ✅ / **결제 배선만 gated**(3P 10→5%·에이전시 2→1% 인하 동반 → 대표 승인+staging 필요) | [product-ownership-model.md](./product-ownership-model.md) |
| **📦 유어애즈 인수인계(SSOT — 새 세션 먼저 읽기)** | 2026-06-27 | 🟢 기능 완성 / 키설정·디자인·결정 대기 | [urads-HANDOFF.md](./urads-HANDOFF.md) |
| **📣 유어애즈 — 보라웨어 레퍼런스(자동입찰·부정클릭·키워드확장·통합실적·AI마케터)** | 2026-06-27 | 🟢 5종 + 추가 전부 구현(현황표) | [urads-boraware-reference.md](./urads-boraware-reference.md) |
| **🛡️ 유어애즈 부정클릭 방지 설계** | 2026-06-27 | ✅ Phase1(탐지)+Phase2(반자동 차단) 구현 / 공식 API 시 자동전환 | [urads-clickfraud-design.md](./urads-clickfraud-design.md) |
| **💵 유어애즈 추가 서비스 & 수익화 전략** | 2026-06-27 | 🟡 전략 박제 / 모델·가격 결정 대기(수익화 보류, 기능 우선) | [urads-services-monetization.md](./urads-services-monetization.md) |
| **🔗 유어애즈 × 유어딜 판매채널 번들** | 2026-06-27 | 🟡 설계 / 크로스서비스 결정 A~D 대기 | [urads-yourdeal-channel-bundle.md](./urads-yourdeal-channel-bundle.md) |
| **🏭 도매몰 통합 셸 — 카탈로그↔판매사↔제조사 한 제품화** | 2026-06-29 | ⏳ 제안 / 착수 승인 대기 (Phase 1 권장) | [wholesale-unified-shell.md](./wholesale-unified-shell.md) |
| **💸 정산 정합(소비자 셀러) — 3중 회계 통합 + 지급 SSOT** (아키텍처) | 2026-07-01 | 🟡 수수료 5% 통일 ✅ 배포 / 머니-이동(payout 단일화·정산신청 폐기) 대표 정책 결정 + staging 대기 | [settlement-reconciliation.md](./settlement-reconciliation.md) |
| **🗺️ 카카오맵 리뷰 게이미피케이션 — 리뷰 점수·레벨 → 전용 이용권/홍보 자격** | 2026-07-02 | ✅ v1 구현 완료 (매장 확인 큐 + 레벨 + 전용 이용권 게이트 / 홍보 자격·딥링크 CTA 는 v2) | [kakao-review-gamification.md](./kakao-review-gamification.md) |
| **🏦 이용권 에스크로 & 정산 안전판 (티몬 붕괴 회피)** | 2026-07-03 | 🟡 "사용 후 정산" ✅ / 진짜 신탁분리(Phase 2a 회계분리 코드가능·2b PG/은행 결정)·기본 redemption 모드 대표 결정 대기 | [voucher-escrow.md](./voucher-escrow.md) |
| **🤝 유어애즈 B2B 파트너(업체) 수집 트랙 — 3레인(자동/레지스트리/수동)** | 2026-07-21 | 🟢 **1단계+레인 A(지역검색+이메일 크롤)+B/C(명부 임포트) 구현 완료** / 웹문서 보충·API 피드는 후속 | [partner-company-collection.md](./partner-company-collection.md) |
| **🎯 전환추적(진짜 ROAS) — QR 실방문 증명 통합** | 2026-07-21 | 🟡 설계 SSOT / **착수 10월**(8월 실판매 데이터로 귀속 규칙 캘리브레이션 후) · 픽셀·조인 파이프라인 선설계 | [conversion-tracking-roas.md](./conversion-tracking-roas.md) |
