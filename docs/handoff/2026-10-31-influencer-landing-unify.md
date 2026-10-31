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

---

# 2부 · 세 랜딩 움직임 + AI 티 걷기 (`/partners` · `/influencer` · `/about`)

대표: *"사장님용 랜딩도 개선할 점 있는지 봐줘. 홈페이지들 각각 ai가 만든 티가 나면 안되고, 애니메이션? 움직이는 효과도 나는 대기업급 페이지"* → *"응 세 페이지 다 그렇게 진행해줘. 또 고급 효과들 없어?"*

## 진단 (1440px 실측)
- 움직임 0개(FAQ 화살표 회전 · 버튼 눌림뿐).
- 같은 [제목 + 문단 세로 3개] 가 세 번 · 점 찍은 가로 타임라인(세 랜딩 전부) · 숫자 3개 나열 · 제목 옆에 혼자 떠 있는 작은 폰 · 흰/회색만 이어지는 단색 리듬.

## 한 것
- 신규 키트 `src/pages/landing/motion.tsx` + `motion.css`(라이브러리 0 · lazy 청크에만 실림):
  `Reveal`(화면 밖에서 시작한 요소만 숨겼다가 올라옴) · `Line`(제목 줄 마스크 상승) · `ur-load`(첫 화면 순차 등장) · `CountUp` · `useTweened`(계산기 금액 미끄러짐) · `ScrollProgress`(머리글 밑 파란 실) · `Tilt`(마우스 따라 3D 기울기, PC) · `ur-float`(폰 떠 있기) · `Marquee`(흐르는 화면 줄, 마우스 올리면 멈춤) · `spotHandlers`/`ur-spot`(커서 따라오는 빛 카드) · `ur-sweep`(비교표 유어딜 줄 띠 긋기) · `ur-collapse`(FAQ 부드럽게 열기).
- 신규 `src/pages/landing/StickyStory.tsx` — 폰은 멈추고 글이 지나가며 화면이 바뀌는 고정 스토리. 가로 타임라인 대체(`/partners` 손님이 오는 길 · `/about` 사장님 진행).
- `/partners`: 장점 = 왼쪽 고정 제목 + 오른쪽 차례로 · 안전 구역 = 어두운 띠(두 칸 + 넓은 줄) · 사장님 화면 = 흐르는 줄(PC)/가로 넘기기(폰) · 시작하는 길 카드 빛 · 고아 폰 제거.
- `/influencer`: 3단계 = 계단(단계마다 오른쪽으로 한 칸) · 폰 갤러리 엇박 등장 + 떠 있기.
- `/about`: 진행 4단계 = 고정 스토리(`deal-photo` 는 화면이 아닌 사진이라 `detail` 로) · 19조 원 세기.
- 문구는 한 글자도 안 바꿨다(사실 대조 시험·서버 noscript 요약이 그 문구를 고정한다).
- 동작 줄이기(`prefers-reduced-motion`)면 전부 꺼진다. 첫 화면에 보이는 것은 숨기지 않는다.

## 가드
- `landing-motion-2026-10-31.test.tsx` 14건(M1~M6) + 주입 `landing-motion-2026-10-31.mjs` 6건 전부 빨간불 확인.
- 기존 재조준: `partners-landing` 시험 1(폰 프레임 집계에 StickyStory 포함) · 주입 앵커 4(h2 가 `<Reveal>` 안으로 · 히어로 클래스 · h1 `Line`).

## 이번에 틀렸던 판단
- 처음엔 제목을 `<Reveal as="h2">`·`<Lines lines={[...]}>` 로 바꿨는데 h2/h1 이 소스에서 사라져 제목 시험 5건이 깨졌다 → 진짜 `<h2>`·`<h1>` 를 남기고 바깥을 감싸는 쪽으로. sticky 제목은 그때 sticky 클래스를 바깥 래퍼로 옮겨야 한다(안 옮기면 sticky 가 조용히 죽는다).
- 주입 "🏪 안 B 가 사라진다" 가 헛돌았다 — 사장님 화면이 PC/폰 두 곳에 그려져 한 곳만 지워도 집계가 안 변했다. 다른 섹션을 지우도록 재조준.

## 다음 세션 첫 액션
배포 후 실제 PC 브라우저로 `/partners` 를 끝까지 스크롤 — 고정 스토리 폰 화면이 단계마다 바뀌는지, 흐르는 줄이 마우스에서 멈추는지, 폰에서 움직임이 버벅이지 않는지(이건 사람 눈으로만 판정).
