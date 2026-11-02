# 2026-11-02 — 해외 진출 세팅 질문 (결제·비용·로그인·지도)

## 대표가 시킨 것
"해외 진출하려면 어떤 세팅이 필요? 지도 구글로? 결제 구글페이? 이미 세팅된 건?" → "Stripe 가 편할까 구글페이가 편할까? 비용은? 로그인도" → "세팅할 수 있는 건 다 해둘래?"

## 한 것 (문서만 — 코드 변경 0)
- `docs/design/global-launch-readiness.md` §7 신설(기존 07-28 문서에 보탬).
- 결재 파일 `docs/decisions/2026-11-02-global-launch-first-decisions.md`(나라·결제 방식 선택).

## 이번에 틀렸던 판단 (같은 오진 방지)
- 첫 답에서 "해외판은 구글 로그인을 쓰도록 설정돼 있다"고 했는데 **구글 로그인은 #804 로 꺼져 있다**(설정 파일 `region.ts` 의 `authProviders: ['google']` 는 선언일 뿐 경로가 없다). 설정 파일만 보고 '된다'고 하지 말 것.
- "Stripe 키만 등록하면 된다"도 성급했다 — 한국 법인은 Stripe 가입이 안 될 수 있다(§7-2, 대표 가입 화면으로 판정).

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
결재 파일의 `## 결정` 을 먼저 본다. 비어 있으면 아무것도 하지 않는다. 1번(토스 해외 간편결제)이면 토스 MCP 로 `integration-international` 문서를 읽고 잠금표(`payment.routes.ts` 등) 승인부터 받는다.

## 남은 결정
나라 · 팔 상품 · 결제 방식 · 통화 정책 · 해외 수수료율 — 전부 결재 파일에.

---

## 2차 — 1단계(외국인 관광객) 개발 착수 (같은 날)

대표 *"필요한 개발 일단 다 해볼래?"* + 선택: 잠금 파일 문구 수정 허락 · 영어 먼저 · 외국어일 때만 네이버맵.

### 한 것
- 이용권 상세(`/pass/:id`)·구매/결제 완료·내 이용권 QR 의 한국어 문장을 번역 함수로 — 키 181개(`pass.*` 60 · `passBuy.*` 46 · `wallet.*` 42 + 기존 `voucher.*` 누락분 28 · `map.*` 5). ko·en 채움, ja·zh·es·fr 는 `[TODO:xx]`(화면엔 한국어로 나감).
- 네이버 지도: `src/lib/naver-maps.ts` · `src/components/NaverMiniMap.tsx` · 고르는 곳 `src/pages/group-buy/StoreLocation.tsx` · CSP `oapi.map.naver.com` · env `VITE_NAVER_MAP_KEY_ID`(없으면 카카오).
- 가드 `src/tests/unit/tourist-english-pass-flow-2026-11-02.test.ts`(① 한국어 불변 ② 영어 완비) — ko 값 하나를 바꾸는 주입으로 빨간불 확인.
- 문구가 옮겨져 낡은 시험 3개·주입 앵커 2개 재조준(주입 둘 다 빨간불 재확인).

### 아직 화면에 안 보인다 — 일부러
`CONSUMER_LANGUAGE_SWITCH_HIDDEN = true`(2026-08-11 대표) 그대로다. 외국인이 끝까지 살 수 있게(해외 카드 결제 + 외국인 로그인) 된 뒤 연다.

### 이번에 틀렸던 판단
- 네이버 지도를 처음엔 잠금 파일(`GroupBuyDetailPage`)에 `lazy(` 로 넣었다 → 잠금 지문 시험 3개가 `lazy(` 개수 3을 센다. 잠금 파일엔 문구 말고 넣지 말 것.
- 전체 `tsc` 가 기본 힙에서 죽는다 — `NODE_OPTIONS=--max-old-space-size=7000` 필요(죽은 것을 타입 에러로 읽지 말 것).

### 남은 것 (대표 몫)
1. 네이버 클라우드 Maps Client ID 발급 → Pages 환경변수 `VITE_NAVER_MAP_KEY_ID`.
2. 해외 카드 결제: 토스 해외 간편결제 MID 계약 문의(결재 C).
3. 외국인 로그인: 구글 OAuth 클라이언트 ID/시크릿 발급(구글 로그인 새로 짓기 — #804 로 끈 Firebase 경로는 되살리지 않는다).
4. 남은 번역: 홈·목록·로그인·지도 화면, 가게 이름·메뉴(서버 데이터) 자동 번역, `passSubLine`·`getVoucherShortLabel`·날짜 형식(`ko-KR` 고정).
