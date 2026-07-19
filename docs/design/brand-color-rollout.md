# 유어딜 브랜드 컬러 전면 적용 — 매핑표 & 롤아웃 (2026-07-19)

> 대표 개발지시서 기반. 성격: **CSS/색상만** — 레이아웃·기능·마크업 무접촉. draft PR → 스크린샷 비교 → 대표 확인 후 머지.
> 대표 확정 2결정: ① **라이트=새 팔레트 / 다크=서피스 유지+로즈 액센트**(토글 보존) ② 잠금 결제화면 **색만 [UNLOCK]**.

## 1. 토큰 (SSOT 2곳 — 항상 동기)
- `src/index.css` `:root` — `--brand #E0526B · --brand-dark #C43D55 · --brand-tint #FBEDF0 · --ink #1A2C42 · --ink-soft #5F6B7A · --ink-faint #8A8580 · --bg #FAF7F5 · --surface #FFF · --line #EAE4E0` + shadcn `--primary/--accent/--ring = 349 70% 60%`(#E0526B, 구 #FF4D6D).
- `tailwind.config.js` — `brand/{DEFAULT,dark,tint}` · `ink/{DEFAULT,soft,faint}` · `surface/line/warm` 클래스 신설.

## 2. 인벤토리 → 매핑 (전수조사 2026-07-19 요약)
전제: 기존 앱은 **MONO 흑백 체계**(tailwind 16색계열→회색 리매핑, 2026-06-19) + CTA=검정(gray-900) + 브랜드색은 `--primary` 1곳. 따라서 "클래스 3,900개 치환"이 아니라 **값 리매핑(단일 지점) + CTA 표적 치환**.

| 기존 | 새 값 | 방법 |
|---|---|---|
| tailwind `gray` 스케일(모든 text/bg/border-gray-*) | **INK 스케일** — 50=#FAF7F5(--bg) · 200=#EAE4E0(--line) · 400=#8A8580(faint) · 500=#5F6B7A(soft) · 900=#1A2C42(ink) | `tailwind.config.js` `gray: INK` — **클래스명 불변**(테마가드 영향 0) |
| MONO(16색계열 중화 회색) | 같은 INK 스케일 | `MONO = INK` — 장식색 전부 잉크 정렬 |
| `--primary/--accent/--ring` #FF4D6D | #E0526B | index.css hsl(349 70% 60%) |
| CTA 검정 `bg-gray-900`(주문/결제/딜잡기) + 하드코딩 `#fb2d3f` | `bg-brand hover:bg-brand-dark text-white` | 표적 치환(아래 §3) |
| 동네딜 상세 `--gbd-*`(bg #EDEEF1·cta #16181B·accent #2B6FF0) | bg #FAF7F5 · cta #E0526B · accent #E0526B(다크 #E76B81) · ink 계열 | index.css `.gbd` 블록 |
| 대시보드 `--primary` 파랑(211 100% 50%) | #E0526B (bg #F4F5F7 구조 유지) | `.seller-light-theme,.admin-light-theme` |
| PWA theme_color #020202 / bg #020202 | #E0526B / #FAF7F5 (다크 meta #020202 유지) | index.html + manifest.webmanifest |
| 맵 핀 배지/라이브링/선택링 #111827 | #E0526B (카테고리 링·정보 오버레이는 유지) | useKakaoMap.ts |
| 다크 서피스 #020202/#121212/#1A1A1A/#2A2A2A (~1,900회) | **불변** (대표 결정 — 다크 유지) | — |
| 기능색 red(에러/마감), 카카오 #FEE500 | **불변** (지시서 §4) | — |
| 도매몰 #FC5424/#0C2454 · UrAds #3B6EF5 | **불변** (별도 브랜드 계층) | — |

## 3. CTA/액센트 표적 치환 (이번 라운드)
- CartPage 주문하기 · BottomNav 시트 CTA 2 · (+)만들기 버튼 · PcHomeAppBand 구매하기(#fb2d3f) · TossPaymentWidget 결제하기(bg-blue-600→brand, **[UNLOCK] 색만**) · BottomNav 활성탭 아이콘/라벨(brand)/비활성(gray-400=faint) · 맵 핀 할인배지/라이브/선택링.
- 잔여(후속 라운드): 각 상세 CTA·뱃지·탭 활성 표시 개별 점검(60-30-10, 로즈 ≤10%).

## 4. 금지선 준수
QR 흑백 유지(렌더 코드 무접촉 — 인벤토리상 fgColor 지정 1곳뿐, 이미 흑) · Toss SDK 위젯 영역 무접촉(자사 버튼만) · 레이아웃/마크업 무변 · 머니 로직 무접촉 · 로즈 위 텍스트=흰색 · 성공/오류 기능색 유지.

## 5. 검증
- 가드 GREEN: check-theme-consistency(클래스명 불변이라 무영향) · check-dashboard-theme · light-input · loader-continuity.
- ⚠️ 이 환경 npm 403 — 빌드/스크린샷(after)은 CI + 프리뷰/스테이징 배포 후. before 스크린샷은 라이브 캡처.
- 미완(후속): PWA 아이콘 PNG(icon-192/512) 브랜드 재생성 — 디자인 원본 필요(대표), 코드로 불가.

## 구현 로그
- 2026-07-19 1차: 토큰층 + CTA 표적 + PWA meta + 맵 핀 (이 커밋)
- 2026-07-19 2차(마감): 상태바 theme-color 라이트=로즈(App.tsx 동적 writer) · 로더 스윕바 로즈(BrandLoader 기본/forceDark + 워커 정적 로더 [UNLOCK_LOADING] — forceLight 대시보드 중립 유지) · 피드 할인뱃지 red→brand · favicon.svg UR 마크 로즈.
- 2026-07-19 3차(STEP B — 다크 토큰, 지시서 §6): 다크 hex 일괄 이행(#020202/#0A0A0A→#0F151D · #121212→#1A2334 · #1A1A1A→border는 #2A3446/bg는 #1A2334 · #2A2A2A/#1F1F1F→#2A3446, 소비자+셀러 263파일 — 도매/유어애즈/어드민/에이전시 제외) · :root shadcn 다크 var 네이비 혈통화+웜화이트 foreground · `.dark`/[data-theme=dark] 토큰 블록(--brand-text #EF6E85·--brand-tint #3A2530) · tailwind brand.text/tint var화(테마 자동 적응) · BottomNav 활성=text-brand-text · gbd 다크(음식사진 배경 근검정 유지, accent #EF6E85) · theme-color 라이트 #FAF7F5/다크 #0F151D(§6 확정, manifest 동일) · 가드 hex 목록 동기(check-theme-consistency 83/108). 한계 고지: dark:text-white 리터럴(순백)은 잔존 — var 소비자(foreground)는 #F5F3F1, 시각차 미미.
- 2026-07-19 4차(확정 로고 — "Ur Deal 로고 Final" 핸드오프 수령): 워드마크 SSOT `UrDealLogo` 재작성(소문자 `urdeal`+로즈 원 마침표, Poppins 800·자간 −3.5% — 구 "UR·DEAL" 이탤릭+▶ 폐기, 사용처 8곳 자동 상속) · worker 정적 로더 미러([UNLOCK_LOADING]) · Poppins `&text=urdeal` 서브셋 로드(index.html) · 파비콘/아이콘 전면 납품본 교체(favicon-32/16 PNG + favicon.svg 임베드 + icon-192/512 + maskable-512 납품/192 다운스케일 + apple-touch-180) · 세컨더리(biz 네이비) 파비콘 셀러 대시보드 스왑(`biz-favicon.ts`) · og-image.png/svg 신규(웜 bg + 유어딜/urdeal. 국문 우선 병기) + SEO 기본 OG → png · 자산 아카이브 `docs/design/brand-assets/`(SSOT — 앱 아이콘 추출 원본). 도매몰=유통스타트 파비콘 유지(서비스 분리).
