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
| 홈 사이드바 (3 섹션 + 카테고리) | 2026-05-06 | ⏳ 미구현 | [home-sidebar.md](./home-sidebar.md) |
| Quick Action FAB (당근식 확장 버튼) | 2026-05-24 | ⏳ 미구현 (신모델로 컨셉 변경 가능) | [quick-action-fab.md](./quick-action-fab.md) |
| **🚀 비즈니스 pivot — 링크샵·공구·어필리에이트** | 2026-05-25 | ⏳ 컨셉 / 정책 결정 대기 | [linkshop-pivot.md](./linkshop-pivot.md) |
| **🚢 배송 시스템 재설계** | 2026-05-25 | ⏳ 컨셉 / 정책 결정 대기 | [shipping-redesign.md](./shipping-redesign.md) |
| **🛒 공동구매 = 즉시판매 모델** | 2026-05-30 | 🟡 설계 확정 대기 (A1/A2 + UNLOCK) | [groupbuy-instant-sale.md](./groupbuy-instant-sale.md) |
| **🏭 유통스타트 도매몰 — 제조사↔플랫폼↔유통사 등급제** | 2026-06-01 | 🟡 스펙 박제 / 결정(D-A~F) 대기 | [wholesale-utongstart.md](./wholesale-utongstart.md) |
| **🥕 공구 상세 hero — 당근 스타일 full-bleed + 스크롤 헤더** | 2026-06-07 | ✅ 구현 완료 | [groupbuy-detail-karrot.md](./groupbuy-detail-karrot.md) |
| **🎟️ 교환권 상세 — Refined Classic (그라데이션 카드+잔액)** | 2026-06-17 | ✅ 구현 완료 | [voucher-detail.md](./voucher-detail.md) |
| **🔐 대시보드 토큰 httpOnly 쿠키 전환 (XSS 하드닝)** | 2026-06-17 | 🟡 설계 (단계 구현 대기 — Phase0 CSRF→admin→supplier/agency→seller) | [dashboard-cookie-auth.md](./dashboard-cookie-auth.md) |
| **📦 주문 내역/상세 — 무신사 스타일(썸네일·날짜그룹·검색)** | 2026-06-18 | ⏳ 미구현 (시안 박제 + 데이터버그 동반수정 + 결정 4건 대기) | [my-orders.md](./my-orders.md) |
