# 2026-10-12 홈 배너 3D (세션 담당: 메인 배너 디자인)

- 대표가 이 세션에 **메인 페이지 배너 디자인**을 맡김. 레퍼런스 = NOL 홈 3D 카드 캐러셀.
- 시안·일러스트·모의: `docs/design/home-banner-3d.md` (원본 URL 2026-10-19 경 만료).
- 라이브 실측: `/api/banners` 에 자리 지정된 배너 **0건** → 지금 홈엔 배너가 안 뜬다.
- 이 환경은 figma.com 다운로드가 막혀(프록시 403) 3D 원본을 레포에 못 넣는다 — 대표가 받아 어드민 업로드.

## 다음 세션 첫 액션
대표 결정(틀 크기·자동 재생) 확인 → `HomeBannerStrip` strip 렌더를 3D 카드로 구현 → `node scripts/visual-preview.mjs --route=/` 로 확인.
