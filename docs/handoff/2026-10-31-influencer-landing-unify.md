# 2026-10-31 · 소개 파트너 모집 랜딩 `/influencer` 단일화

대표: *"랜딩페이지로 사장님용/인플루언서용이 필요해. 이미 있는지 확인해볼래?"* → *"인플루언서용은 하나로 통일하자. /influencer 이걸로 쓰면 좋겠네."*

## 확인 결과
- 사장님용: `/partners` 하나(2026-09-16 PC 판). 변경 없음.
- 인플루언서용: `/creators`(CreatorsPage, PC·캡처·신청서 연결, 푸터 링크) + `/influencer`(InfluencerLandingPage, 짧은 판, 앱 안 링크 0)가 **둘**이었고 둘 다 sitemap 제출.

## 한 것
- `/influencer` → `CreatorsPage` 를 띄운다. `InfluencerLandingPage.tsx` 삭제.
- `/creators` → `/influencer` 301(`consumer-redirects.ts`) + SPA `<Navigate>`. 신청서 `/creators/apply`·`/start` 는 그대로.
- 링크 교체: 푸터 2 · 봇 셸 푸터 noscript · `/about` 3 · `/creators/start` 1 · 안내 메일 2(inbound-onboarding · outreach-send).
- 푸터 이름 "크리에이터 모집" → "소개 파트너 모집"(명칭 SSOT).
- SEO 표(`consumer-surfaces`·`surface-copy`)의 `/creators` 문구를 `/influencer` 로 옮김. `/creators/apply` 빵부스러기 라벨 '소개 파트너 신청'.
- sitemap: `/creators` 제거, `/influencer` priority 0.7 → 0.85.
- `consumer-chrome.ts` `fullScreenExactPaths = ['/influencer']` — 정확 일치(하위 `/influencer/dashboard` 등 도구 화면은 네비 유지).
- 가드 `influencer-landing-unify-2026-10-31.test.ts` 8건 + 주입 6건(전부 빨간불 확인). 기존 시험 재조준: landing-pc · consumer-surface-seo · surface-title-contract(23→22, 페이지 하나 삭제) · 주입 앵커 1(thin-indexable).

## 검증
tsc 0 · vitest 1204파일 15,420건 중 실패 1건(위 22 조정으로 해소) · build 0 · `visual-preview` `/influencer`(모바일·PC) · `/creators` 렌더 정상(같은 본문).

## 이번에 틀렸던 판단
- 전체 vitest 를 10분 타임아웃으로 돌려 끊겼다(실측 13분). 배경으로 돌릴 것.
- vitest 와 tsc 를 동시에 돌려 tsc 가 OOM — 순차로.

## 다음 세션 첫 액션 (E4)
배포 후 `curl -sI https://urdeal.kr/creators` → 301 Location `/influencer` · `curl -s https://urdeal.kr/sitemap.xml | grep -c '/creators<'` = 0 · `/influencer` 의 `<title>` 이 "동네 딜 소개하고 수익 받기".
