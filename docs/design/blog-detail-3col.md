# 블로그 상세 UI — 3단 레이아웃 (2026-07-02 대표 시안, 아싸뷰 스타일)

대표가 아싸뷰(ashaview) 블로그 상세 페이지 스크린샷 공유하며 "블로그 페이지 내 UI를 이렇게".

## 시안 요약 (상세/글 페이지)
- **상단 네비**: 로고 + `Blog` · 우측 `아싸뷰 바로가기`(외부) + 검색 아이콘 + `Subscribe`(다크 버튼).
- **3단 레이아웃(PC)**:
  - **좌측 `Contents` 목차**: 글의 H2/H3 로 자동 생성, **H3 은 들여쓰기**, 번호 배지. **sticky**. 클릭 시 해당 섹션으로 스크롤. 현재 섹션 하이라이트(스크롤스파이).
  - **중앙 본문**: 큰 **히어로 배너 이미지** + 리드 문단 + 본문.
  - **우측 추천글**: 다른 글 목록(제목 + 작은 정사각 썸네일).
- 모바일: 1단 — 목차는 상단 접이식(accordion), 추천글은 본문 하단.

## 현재 → 시안 차이
| 요소 | 현재 | 시안 |
|---|---|---|
| 레이아웃 | 단일 중앙 컬럼(ur-content-medium) | **3단**(목차·본문·추천) |
| 목차 | 없음 | **좌측 sticky TOC**(H2/H3 앵커 + 스크롤스파이) |
| 추천글 | 본문 하단 2열 | **우측 sticky 사이드바**(썸네일) |
| 히어로 | 썸네일 있을 때만 작게 | **상단 큰 배너**(썸네일 or 자동 배너) |
| 상단 | 뒤로 · 유어딜 · 공유 | 로고 | Blog · 유어딜 바로가기 · 검색 · CTA |

## 유어딜 적용 매핑
- 목차: `blogToc(content)` — BlogMarkdown 과 동일 블록 파싱으로 H2/H3 추출(`sec-{n}` id 매칭). 렌더러가 헤딩에 `id` + `scroll-mt` 부여.
- 추천글: 기존 관련글 로직(같은 태그 우선) 재사용 + 썸네일(CoverImg).
- 상단: 로고 `유어딜 블로그` | 우측 `검색`(→/blog) · `유어딜 홈`(→/) · `판매 시작하기`(Subscribe 대체 — 뉴스레터 없음).
- 히어로: `thumbnail_url` 또는 목록과 동일 자동 디자인 배너.

## 구현 체크리스트
- [ ] BlogMarkdown: 헤딩 `id={sec-n}` + `scroll-mt-24` · `export blogToc(content)`
- [ ] 3단 grid(lg): `[240px_minmax(0,1fr)_260px]`, 좌/우 sticky
- [ ] 좌측 TOC + IntersectionObserver 스크롤스파이(현재 섹션 하이라이트)
- [ ] 우측 추천글(썸네일) · 모바일 본문 하단 폴백
- [ ] 상단 네비 시안 정렬 · 히어로 배너
- [ ] 보존: `__SSR_INITIAL_BLOGPOST__` 0-RTT · stripBold · SEO/JSON-LD · 조회수 · 다크모드 · min-h-[100dvh]

## ✅ 구현 완료 (2026-07-02)
`BlogDetailPage.tsx` 전면 개편(3단 레이아웃).
- 상단 네비: `유어딜 | Blog` + 검색·공유·유어딜 홈·판매 시작하기(sticky).
- 3단 grid: `lg:[220px_1fr]` / `xl:[220px_1fr_260px]` — 좌 목차·중앙 본문·우 추천글, 좌우 sticky(top-20).
- 좌측 Contents: `blogToc(content)` 로 H2/H3 추출(BlogMarkdown 헤딩 `id=sec-{n}` 매칭) + IntersectionObserver 스크롤스파이(현재 섹션 하이라이트) + H3 들여쓰기.
- 중앙: 태그·제목·요약·메타 + 히어로 배너(CoverImg hero, aspect-16/7) + 본문 + CTA.
- 우측(xl+) 추천글(썸네일) · 모바일은 접이식 목차(상단) + 추천글(본문 하단).
- 공유 커버는 `BlogCover.tsx` 로 추출(목록·상세 공용). BlogMarkdown 헤딩에 `scroll-mt-24`.
- 보존: `__SSR_INITIAL_BLOGPOST__` 0-RTT · stripBold · SEO/JSON-LD · 조회수 · 다크모드 · min-h-[100dvh].
- 검증: tsc 0 · theme/mobile-viewport/file-size 가드 GREEN · build:client 통과.
