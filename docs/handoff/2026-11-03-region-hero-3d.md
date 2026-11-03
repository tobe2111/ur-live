# 지역 일러스트 3D — 대전·충북·전국 (2026-11-03)

## 완료분
- `public/assets/region-hero/{daejeon-v2,chungbuk-v1,national-v1}.webp` (1080×360, q74, 33~49KB)
- `src/shared/home-region-hero.ts` — 대전 v2 · 충북 신규(상자 표 맨 뒤) · 전국 전용 `national`(상자 없음, NATIONAL_HERO)
- 시험: home-region-hero-row(전국=national·충북 판정·대전 우선) · home-hero-ssr(쿠키 기본=national)

## 이번에 틀렸던 판단
- 처음 전국 안(랜드마크 나열)을 그대로 냈다 — 대표 기각. 지역 랜드마크와 달리 '전국'은 유어딜이 파는 것(동네 가게)이 더 맞았다.
- Figma 생성 이미지는 이 환경에서 원본을 못 받는다(www.figma.com 차단 · use_figma 반환 48KB 한도). 미리보기(256px)만 보인다 → 대표가 내보내 보내 주는 길.
