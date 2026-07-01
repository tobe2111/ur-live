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
| 홈 사이드바 (3 섹션 + 카테고리) | 2026-05-06 | ✅ 구현 완료 (단, 홈은 2026-06-20 동네딜 지도로 전환됨 — 사이드바는 라이브 시절 잔재, 라이브 중단으로 사실상 무의미) | [home-sidebar.md](./home-sidebar.md) |
| Quick Action FAB (당근식 확장 버튼) | 2026-05-24 | ✅ BottomNav ➕ 시트로 구현(역할별 만들기 메뉴) | [quick-action-fab.md](./quick-action-fab.md) |
| **🚀 비즈니스 pivot — 링크샵·공구·어필리에이트** | 2026-05-25 | ✅ Phase 1–4 구현(링크샵·핀·어필리에이트 정산·공구 호스팅·셀러 승급). Phase 5(셀러 흡수)+폴리시만 잔여. ⚠️ 문서 내 '라이브' 언급은 **영구 중단**(LIVE_COMMERCE_SUSPENDED) — 무시 | [linkshop-pivot.md](./linkshop-pivot.md) |
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
