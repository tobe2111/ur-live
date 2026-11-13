# [LOADING_ADDITIVE] 2026-11-13 블로그 목록·글 PC — 폰과 같은 서버 첫 화면

- 대상: `src/worker/index.ts` 블로그 분기(기존 두 줄 — 폰 조건 제거 · noscript 감추기는 첫 화면이 없을 때만) · `css-first-boot.ts` `firstScreenApplies` PC 에 `/blog`·`/blog/:slug`
- 왜: PC 블로그 첫 글자 목록 2.6~2.9s · 글 2.4~3.2s(#2345 뒤 PC 는 noscript + 로더).
- 🩸 2026-10-19 엔 *"PC 는 왼쪽 목차 칸 때문에 다른 마크업 — 본문이 옆으로 밀린다"* 고 막았다(주입까지 있었다). **라이브 끼워 재기로 틀렸다**: 본문 칸은 PC 에서도 같은 자리이고 목차·추천 글은 빈 자리에 나중에 선다.
- 이 빌드의 표면 CSS 그대로 라이브 HTML 에 끼워 재기(PC · CPU 4배 · 2회):
  글 `/blog/what-is-urdeal` FCP **3.22 · 2.40s → 0.95 · 0.95s** · CLS 0.0013 → 0.0013 / 목록 `/blog` FCP **2.59 · 2.88s → 1.21 · 0.52s** · CLS 0 → 0.
- 롤백: `blogFirst` 에 `!blogPhone ? '' :` 를 되살리고 `firstScreenApplies` 의 블로그 정규식 제거.
