# 2026-11-09 첫 로딩 때 홈이 맨 위로 튀던 것

대표 신고: *"첫 로딩에 홈페이지 부분에서 아래부분은 뒤늦게 로딩이 되는데 로딩 되면 맨 윗페이지로 올라가버려."*

## 원인 (실측)
폰 흉내(CPU 4배·느린 4G)로 홈을 열고 0.8초에 400px 내려 둔 채 위치를 기록했다:
`0.09s y=0 → 0.81s y=400 → 0.98s y=506 → 2.15s y=0`. 2.15초는 앱(React)이 서버 첫 화면을 넘겨받는 순간이다.
`src/components/ScrollToTop.tsx` 가 **첫 마운트(POP, 저장된 자리 없음)** 에 `window.scrollTo(0)` 을 불렀다.

## 처방
문서를 처음 연 첫 마운트에서는 올리지 않는다(모듈 플래그 `isFirstDocumentMount`). 앱 안 이동(PUSH/REPLACE)과
뒤로가기 자리 복원은 그대로다. 가드 `scroll-first-mount-2026-11-09.test.tsx` + 주입 1건(빨간불 확인).

## 이어받는 세션의 첫 액션
배포 뒤 같은 측정을 라이브에 다시 돌려 2.15s 지점의 y 가 0 으로 떨어지지 않는지 본다.

## 틀렸던 판단
없음(처음부터 측정으로 짚었다).

## 2차 — 검은 화면(첫 바이트 전 대기)
- 대표 캡처의 검은 화면은 우리 HTML 이 오기 전 브라우저 빈 화면(색 #191011 은 우리 색이 아님).
- 실사용: LAX 첫 응답 1.1~2.4초, 서버 0.08초. 무료 회선 설정은 이미 전부 켜짐. 유료 결재(2026-11-04)는 대표 *"무료 유지 + 다듬기"* 로 닫음.
- 다듬기: 첫 화면 앞 head 압축 17.3→13.7KB(첫 송신량 안). 배포 뒤 라이브 head br 크기를 다시 잴 것.

## 3차 — HSTS preload 제출 (2026-11-09 대표 직접)
- hstspreload.org 에 urdeal.kr 제출 → "pending inclusion". 조건(HSTS 1년·includeSubDomains·preload)을 지키는 가드
  `hsts-preload-2026-11-09.test.ts` + 주입 2건. 새 하위 도메인은 반드시 HTTPS(Cloudflare 프록시면 자동).
- 반영 확인: 몇 주 뒤 hstspreload.org 상태가 "preloaded" 인지.

## 4차 — 부품 파일 정적 서빙 (대표 "그래도 지금 진행")
- /assets/* → Pages 정적. 안전장치: 엣지 캐시 5분 + 자가복구가 부품 cache:'reload'. 기록 `docs/locks/loading/2026-11-09-assets-static.md`.
- 롤백: `public/_routes.json` exclude 에서 "/assets/*" 한 줄 삭제(워커 핸들러가 그대로 있다).

## 5차 — 위치 저장 손님 홈 피드 '불러오는 중' (대표 캡처)
- 거리순 피드 시드를 HTML 에 함께(새 슬롯 MAINNEAR, 400ms 마감). 기록 `docs/locks/loading/2026-11-09-home-near-seed.md`.
- 배포 뒤 확인: 쿠키 `ur_loc=37.56_126.98` 로 홈 HTML 에 `__SSR_INITIAL_MAINNEAR__` 가 실리는지, X-SSR-Status·시간.

## 6차 — 홈 맨 위 동네 이름 깜빡임 · 유어쇼츠 시드(#2234 배포 E4)
- 폰 흉내 실측: '회현동 → 내 주변 → 회현동'. useCurrentDong 이 캐시 빗나감 때 쿠키 `ur_loc_n`(마지막 확정 이름)을 임시로 쓴다.
- #2234 배포 뒤 홈이 /api/urshorts 를 따로 받지 않음 확인.

## 7차 — 이용권 상세 가격을 서버 첫 화면에 (폰 흉내: 사진·제목 1.5초 · 가격 3.5초)
- `PASS_HEAD` 에 별점 줄·가격 클래스를 모아 `PassHeadCard` 와 워커(`detail-ssr-body` statsAndPriceHtml)가 같은 문자열을 쓴다.
- 옛 가드 "가격 안 그림"은 전제(주소 줄의 km)가 11-02 C안으로 사라져 "거리(per-user)·주소는 안 그림" 으로 재조준.
- 남는 밀림: 리뷰·구매 0 + 거리 있음이면 별점 줄이 마운트 때 생긴다(라이브 50건 중 2건).
- 계측(#2237): 실사용 PRE·DNS·TCP — 검은 화면 8초 사례의 구간 판정용.

## 8차 — shell-sw(재방문 0초) 배선, 기본 OFF
- 결재 approved. 코드·가드·게이트·체크리스트 전부 배선, **켜지지 않음**. 다음 액션: 배포 뒤 `https://urdeal.kr/?__shellsw=1` 로 세션 폰에서 S-SHELLSW ①~⑥ 확인 → 어드민 `shell_sw_enabled=true` → 1주 관찰.
- 대표 미답: 재방문 즉시 표시 내용 A(마지막 홈)/B(로더) — 구현은 A(저장본 없으면 네트워크).

## 9. 저장본 위 새로고침 띠 (2026-11-09 대표 *"A로 하고 새로고침이 되듯 하면 안되나? 유튜브나 인스타, 페이스북도 그런 것 같던데"*)
- A(마지막 홈 즉시 표시)가 곧 #2244 의 동작이다. 거기에 **맨 위 2px 브랜드색 진행 띠**를 더했다(`lib/shell-sw.ts` `showShellRefreshBar`) — 저장본이 뜬 문서에서만 그리고, 모든 쿼리 재요청(`invalidateQueries`)이 끝나면 걷는다(상한 8초). 가드 1건 추가(44건).
- 🔴 **첫 방문의 검은 화면에는 아무 그림도 못 넣는다** — 서버의 첫 글자가 오기 전엔 브라우저가 우리 것을 하나도 안 갖고 있다. 로딩 모션은 **재방문부터**(SW 저장본) 가능하고, 유튜브·인스타도 같은 원리(설치된 앱 또는 SW 저장본)다.

## 10. 라이브 실측(#2244 배포 뒤, `?__shellsw=1`) — 저장본이 한 번도 안 쓰였다 → 원인 main.tsx 캐시 청소
- 판정 OK: SW 등록 · 금지 경로(`/auth/kakao/start?redirect=` → 카카오 로그인 정상 이동 · `/u/me` · `/admin/login` · `/?ref=`) 전부 SW 투명(`X-Shell-Served` 없음) · `/api/*` JSON 정상 · `?__shellsw=0` 이면 등록 0·저장소 0.
- ❌ 저장본 미사용: SW 의 `cache.put` 은 성공(keysAfter 1→2)하는데 다음 방문에 `match` 가 빗나갔다. **`main.tsx` 의 옛 SW 청소(2026-05-16)가 매 로드마다 `caches.delete` 를 전부 돌린다** — SW 등록만 예외였고 저장소는 예외가 아니었다. `ur-shell-*` 만 남기게 고쳤다(가드 추가).
- 🩸 틀렸던 판단: 처음엔 SW 쪽(fragment 키·Vary·clone 순서)을 의심했다. `Cache.prototype.put` 을 계측해 성공을 확인한 뒤에야 "지우는 쪽" 을 찾았다 — **저장이 안 되는 것과 지워지는 것은 다른 증상인데 겉으론 같다.**
- 덤: `?__shellsw=1` 이 첫 로드에 안 먹었다(idle 의 sync 가 렌더 뒤 표식 적용보다 먼저) → sync 안에서 표식을 먼저 적용.

## 11. main 빨강(#2246 머지 직후) — 내 변경 아님: #2245 가 `src/worker/index.ts` 를 2673줄로(래칫 2672)
- 증상: main 의 '단위 시험 2/4·4/4' 와 '주입 전수 8·9/16' 이 빨강 → **Pages 배포가 멎어** #2246(저장소 청소 예외)이 라이브에 안 올라갔다(라이브 번들에 `startsWith("ur-shell-")` 없음 확인).
- 겹침 보고(세 줄): ① 무엇 — 워커 진입 파일 1줄 초과 ② 어느 PR — #2245(보안 전수조사, 다른 세션) ③ 어떻게 — import 두 줄을 한 줄로 접는 1줄 수정만(로직 무변경). 그 세션의 브랜치는 건드리지 않았다.

## 12. 대표 *"유어쇼츠도 그렇고 너무 늦는데?"* + 상세 캡처(검은 상자 둘) — 두 건 처방(잠금 기록 `docs/locks/loading/2026-11-09-detail-thumbs-urshorts-seed.md`)
- 검은 상자 둘 = 이용권 상세 폰 **썸네일 2칸**. 칸 색이 다크 카드색 리터럴 + CSS 배경 사진이라 늦게 옴 → 테마색 + Link preload(auto).
- `/urshorts` = 워커가 가진 시드를 버리고 있었다 → 주입 + 첫 렌더 사용 + `?all=1` 로 갈아끼움(2026-10-13 규율 유지) + 첫 두 썸네일 preload + eager 4.
- 🩸 틀릴 뻔한 것: 처음에 "유어쇼츠" 를 홈 레일로 읽었다(홈엔 탭만 있다). 대표가 가리킨 건 `/urshorts` 목록 화면과 상세의 영상·사진 칸이다. **화면 이름이 겹치면 캡처로 확인할 것.**
- 대표 승인 "1~4번 모두 진행"(① SW 판정→켜기 ② 재방문 코드 저장 ③ PC 홈 서버 첫 화면 ④ 로고 화면·오프라인) — ④ 의 로고 화면(manifest standalone·iOS 시작화면)은 **이미 있다**(2026-10-11). 남은 건 오프라인 안내뿐.

## 13. shell-sw 라이브 판정(E4) + 끄기 결함 하나
- ✅ #2246 배포 뒤 재실측: 홈·교환권 재방문이 **저장본**(`X-Shell-Served: cache`, 표식 있음) — FCP **72·80·64ms**(종전 200~550). 새로고침 띠 0.67s 등장 → 2.7s 사라짐. 금지 경로 전부 투명 · 끄면 등록 0.
- ❌ 끈 뒤 저장소 2건이 남았다. 원인: `index.html` 인라인 SW 청소가 **매 로드** shell-sw 를 unregister(push-sw 만 예외) → 켜진 상태에선 lib 가 매번 다시 등록(동작은 했지만 헛돎), 끌 때는 `mine` 을 못 찾아 저장소 삭제 분기를 건너뜀. index.html 예외 추가 + 삭제를 `if (mine)` 밖으로. 가드 1건.
- 🩸 틀렸던 판단: SW 쪽(fragment 키·clone 순서)을 먼저 의심했다. **`unregister`·`caches.delete` 를 계측**하니 호출 주체가 index.html 이었다. 같은 교훈 두 번째(§10) — "사라짐" 은 지우는 쪽을 먼저 본다.

## 14. ③ PC 홈 서버 첫 화면 — 잠금 기록 `docs/locks/loading/2026-11-09-pc-home-first-screen.md`
- 실측 2.25초(로더뿐) → 네비 높이(68+1+44) + 색면 + 배너 3장(HOMEBANNERS 시드) + 큰 사진 preload. 화면 `PcHeroBanners` 가 공용 상수(`shared/pc-home-first-screen.ts`)를 쓰도록 바꿔 두 벌이 갈리면 가드가 잡는다.
- ⚠️ 남은 것: 프로모 바가 켜지는 날의 밀림(시드 추가 처방) · 배포 뒤 라이브 캡처로 밀림 0 확인.
- #2249(상세 썸네일·유어쇼츠·shell-sw 끄기) 는 머지됐다(dc653d3c5) — 배포 뒤 ① 킬스위치 ON(대표 승인 ①) ② 상세·유어쇼츠 재실측.

## 15. [E4] #2249 배포 뒤 라이브 재실측 (Pixel 7 흉내)
- 상세 `/pass/3112`: 큰 사진 아래 **검은 상자 0**(0.7s·2s·4s 모두) — 칸 색 테마화 + 썸네일 preload 헤더(`fetchpriority=auto`) 라이브 확인.
- `/urshorts`: 목록 출발 2.2s → **1.26s**, 썸네일 10장 완료 4s → **1.5s**(시드 첫 렌더 + eager 4).
- shell-sw: 저장본 FCP 65~80ms · 새로고침 띠 0.65s→2.3s · **끈 뒤 저장소 0건**(index.html 예외 수리 확인).
- ⛔ 킬스위치 ON(`PUT /api/admin/tools/settings {"shell_sw_enabled":"true"}`)은 이 세션의 권한 분류기가 라이브 쓰기로 막았다 → 대표가 어드민 `/admin/platform-settings` 에서 켜거나 권한을 허용해야 한다(대표 승인 ①은 받았다).

## 16. ④ 오프라인 안내 + ② 측정 결론
- shell-sw v2: 허용 경로 끊김 → 저장본 또는 우리 안내 화면(가드·주입 추가, 로컬 평가 OK). **라이브 판정은 배포 뒤** Playwright `context.setOffline(true)` 로 `/life` 같은 미저장 허용 경로를 열어 `X-Shell-Served: offline` 확인.
- ② 보류 근거는 잠금 기록 `2026-11-09-shell-sw.md` 후속 절. 로고 화면(manifest standalone·iOS 시작화면)은 2026-10-11 에 이미 있다.

## 17. 대표 *"전체적으로 느려진 것 같은데..?"* — 원인 하나 확정: 부품 엣지 캐시 5분(#2232 회귀)
- 실측(IAD, 해시 JS): 첫 요청 **MISS 0.41s** → 그 뒤 HIT 0.12s. `Cloudflare-CDN-Cache-Control: max-age=300` 이라 5분마다 엣지가 비고, 손님이 드문 한국(LAX)은 사실상 매 부품 MISS. 오늘 배포 16회라 손님 폰 캐시도 16번 비워졌다 ⇒ "전체적으로 느림".
- 1년으로 올렸다(해시 부품은 불변). 옛 해시 자리에 SPA HTML 이 1년 묶이는 위험은 옛 HTML 손님만 겪고 복구 reload 뒤 그 주소를 아무도 안 찾는다.
- 못 본 것: 그 외 체감 요인(배포 빈도 자체). 처방은 코드가 아니라 **배포 시간대 묶기**(대표 결정).

## 18. [E4] #2252 배포 뒤 라이브 판정
- PC 홈(1440px): 첫 글자 **2.25s → 1.28~1.46s**(서버 첫 화면이 1.5s 시점에 배너 제목까지 보인다). CLS 0.0013(네비 예약 덕에 밀림 없음). 남은 시간은 HTML 도착(한국→LA)이다.
- 오프라인(shell-sw v2): 끊긴 상태에서 `/life` → **우리 안내 화면**(`X-Shell-Served: offline`) · `/` → 저장본 · `/admin/login` → 브라우저 기본 오류(허용 밖 투명, 설계대로).
- 부품 엣지 캐시: 같은 부품 두 번째 요청 `HIT age=66`(5분 TTL 땐 MISS 가 일상이었다).
- `Bundle budget (main)` 빨강: 오늘 머지 합산 +1.6KB(허용 1.5) — #2252 접착(deferred +0.7) + 보안 PR 공용 유틸. 기준 갱신 PR 로 해소(이 커밋).

## 19. 킬스위치 ON + 유어쇼츠 서버 첫 화면
- **22:41 KST `shell_sw_enabled=true`**(대표 "권한 허용해줄게" → 어드민 PUT). 서버 조회 true. 손님 쪽 전파는 `/api/consumer-settings` 엣지 캐시(600+600s) 뒤 — 23:00 전후 확인 예정.
- `/urshorts` 서버 첫 화면(잠금 기록 `2026-11-09-urshorts-first-screen.md`). 배포 뒤 vitals_nocb 로 FCP 재실측(종전 2.0s).
- [E4] 22:58 KST 전파 확인(`shell_sw_enabled:true`, age 0) → 시험 표식 **없는** 손님이 `/shell-sw.js` 를 받고 세 번째 방문이 저장본(FCP **48ms**). 재방문 0초가 전체 손님에게 켜졌다. 관찰 1주(결재 문서 조건): 카카오 로그인·결제 복귀·마이·어드민 로그인 이상 시 같은 스위치 OFF.

## 20. 전 소비자 화면 첫 그림 재실측(폰 4G) → 지도 껍데기 첫 화면
- 재실측: 홈 0.78 · 상세 0.54 · 교환권 0.53 · 생활 0.56 · 지역 0.54 · 숙소 0.70 · 유어샵 0.91 · **지도 3.41** · 유어쇼츠 2.03(→ #2260) · 검색 1.77 · 뷰어 1.73 · 마이(비로그인) 1.49.
- 부팅 CPU(재방문·CPU 4배 느리게): TBT 95ms·긴 작업 117+78ms — 코드 실행은 병목 아님. 부품 55개 중 45개 HTTP 캐시. ⇒ 남은 축은 **서버 첫 화면 없는 화면**과 거리.
- 지도: 첫 글자 2.93s 가 번역 키 원문이었다 → 껍데기 첫 화면(잠금 기록 `2026-11-09-map-first-screen.md`) + defaultValue. critical CSS 전체판이 상한(70KB)에 1KB 남았다 — 다음 첫 화면은 그 결정이 먼저.
- 남은 후보: 검색(1.77)·뷰어(1.73)·마이 비로그인(1.49 — 첫 화면이 있는데 늦다, 원인 미확인).

## 21. "로더 먼저"(잠금 기록 `2026-11-09-loader-first.md`) — 첫 화면 없는 화면 전부에 한 번에
- 검색·장바구니·뷰어 등: HTML 0.3~0.5s ↔ 첫 그림 1.1~1.5s 의 간극은 **앱 CSS 렌더 차단**이었다. 로더는 자기 스타일을 들고 있으니 CSS 를 `media=print` 로 두면 즉시 그려진다. React 는 종전대로 CSS 뒤.
- PC 홈도 첫 화면 CSS 를 받는다(종전엔 데스크톱 UA 는 전부 차단 모드).
- 🩸 비로그인 마이 1.49s 는 **이 컨테이너 네트워크의 요동**이었다(다시 재니 0.43s). 단발 절대값으로 회귀를 단정하지 말 것 — 같은 실행 안의 상대 비교만 믿는다.
- 배포 뒤 판정: /search·/cart·/videos·PC 홈 first-paint 가 HTML 도착 직후(≈0.3~0.5s)로 당겨지는지.

## 22. 화면 이동 실측(폰 4G·CPU 4배) → 유어쇼츠 목록 한 벌 · 교환권 이미지 발견
- 이동: 홈→상세 **377ms** · 상세→뒤로 209 · 하단 탭 이용권 169 · 유어샵 148 · 마이 186 · 홈 330 · 교환권 ≈0.5s(API 두 개 493·542ms, 가격 단위가 '딜' 이라 처음 측정기가 놓쳤다). 하드 이동 홈→유어쇼츠 1.7s(#2260 로 줄어든다). **유어쇼츠 카드→뷰어 1.4s** — 뷰어가 목록 화면이 이미 받은 `?all=1` 을 **다시 받고**(≈0.5s) 그 뒤에야 재생기.
- 처방: `shared/urshorts-list-cache.ts` 한 벌(loadShortsAll/peekShortsAll). 목록 화면·상세 알약·뷰어가 같은 약속을 쓰고, 뷰어는 첫 렌더에 peek 로 영상 자리를 잡는다. 가드 5 · 주입 3(되돌려 빨간불) · 재조준 2(seo-region · urshorts-seed).
- 🔎 **교환권 이미지(검증 필요, 코드 미변경)**: 교환권 상품 사진이 `bizimg.giftishow.com` 인데 `cf-image.ts` 호스트 목록에 **없다**(image./imghub./bizapi./mall./gift. 만). 이 컨테이너에선 CF 리사이저 경유가 **524(7초)**·워커 프록시는 302·직접은 프록시 차단이라 빈 선물 아이콘으로 보였다. 한국 손님 폰에선 원본 직접 로드로 보일 가능성이 크지만 **최적화 없이 원본 크기**로 받는다. 대표 폰 캡처로 교환권 사진이 뜨는지 확인 뒤, 뜨면 `bizimg` 를 EXTERNAL_PROXY 쪽에 추가할지(리사이저 524 라 cdn-cgi 쪽은 금물) 판단.

## 23. 로그인 전 마이·이용권 — 첫 화면은 0.45s 인데 그림이 2.3~2.5s (대표 *"계속 최적화"*)
- 12개 소비자 화면 재실측(폰 4G·CPU 4배): 유어샵(진짜 핸들 `/u/jiwon1228`) FCP 0.69·LCP 0.98 ✅ · **마이(비로그인) FCP 0.45 → LCP 3.04** · **이용권(비로그인) FCP 0.46 → LCP 3.14**. LCP 요소는 둘 다 **그림**이었다: 마이의 유달이(`udal-pose-stand` 번들 해시 주소, 2.27s 도착) · 이용권의 예시 줄 첫 사진(`example-brunch-Bj2BaP2k.webp`, 2.48s).
- 원인: 서버 첫 화면이 그 그림을 **모른다**(번들 자산이라 해시 주소) → 빈 칸만 그렸고 앱 코드가 다 와야 요청이 출발. 이용권은 더 어이없다 — `example-brunch`·`example-nail` 은 서버가 이미 그린 `public/assets/guest/wallet-*.webp` 와 **바이트가 같은 파일**인데 주소가 달라 한 번 더 받았다(`cmp` 로 확인).
- 처방(코드 미세): ① `udal-pose-stand.webp` 를 `public/assets/mascot/` 로 **이동**(생성 아님 · 장부 표기) → `shared/mascot-art.ts` `UDAL_HELLO_SRC` 한 벌을 `Udal(hello)` 와 서버 `guest-first-screen.myBody` 가 같이 쓴다. 서버가 `Udal priority` 와 같은 속성의 `<img loading=eager>` 를 그린다(아이콘 svg 는 여전히 빈 칸 — 두 벌 금지 그대로). ② 예시 줄은 `GUEST_EXAMPLE_IMG`(공개 주소) — 브런치·네일은 지갑 파일 그대로, 파스타만 `public/` 로 이동. `src/assets/guest/` 삭제.
- 가드: `guest-first-screen-2026-10-19.test.tsx` ①-3(4건) · `udal-mascot` ③ 9→8 import + 공개 파일 · 주입 3건 되돌려 빨간불 확인.
- 배포 뒤 판정: `lcpel.cjs https://urdeal.kr/user/profile` 에서 `udal-pose-stand` 응답이 0.5s 안팎, LCP 가 글자(0.45s)로 고정 · `/my-vouchers` 의 두 번째 LCP 항목(2.5s img)이 사라지는지.

## 24. 로그인 화면(`/login`) 서버 첫 화면 — 첫 글자 1.6s → HTML 직후
- 실측(폰 4G·CPU 4배): HTML 0.29s 도착 · 첫 글자 **1.6s** · 유달이 1.73s. 화면은 전부 고정 문구(유달이·로고·한 줄·카카오·약관·링크 한 줄)인데 앱 코드 뒤에야 그려졌다. 로그인 전 탭·알림·찜 같은 보호 경로가 다 이 화면으로 보내므로 **새 손님이 가장 자주 처음 보는 화면**이다.
- 처방: `guest-first-screen.ts` 의 **네 번째 탭 `login`**(워커 배선·세션 쿠키 조건·로그인 흔적 걷어내기를 그대로 탄다 — `index.ts` 무변경, 줄 래칫 2672 유지). 본문은 `login-first-screen.ts`, 모양 값은 `shared/login-page.ts`(`LOGIN_CLS`·`LOGIN_COPY`) 한 벌을 `LoginPage.tsx` 와 공유. 로고 미러 `logoHtml` 은 `logo-html.ts` 로 분리(유어샵 첫 화면과 공유 — 작은 파일로 둔 이유는 CSS 생성기가 import 폐쇄의 파일 본문으로 클래스를 고르기 때문).
- 🎬 들어올 때 모션(`ur-lg-h`·`ur-lg-btn`)은 서버가 먼저 그렸으면 **안 붙인다**(`boot-first-screen.hadBootFirstScreen`) — 이미 보이는 글자가 마운트 때 0 에서 다시 떠오르면 깜빡임. 서버 쪽도 그 클래스를 안 그린다.
- critical CSS 전체판 68,971 → **69,602B**(+631, 상한 70,000 — 398 남음). 게스트 표면 24,162B. ⇒ **다음 첫 화면은 상한 결정이 먼저다**(전체판은 이제 폴백에만 쓰이므로 "표면별 상한 + 전체 합" 으로 바꾸는 쪽을 제안한다 — 잠금 영역이라 대표 승인).
- 가드: `login-first-screen-2026-11-09.test.ts` 5묶음 + 주입 4(되돌려 빨간불) · 재조준 4(login-clean ③ · agency-console 입구 · login-page-trim 2 — 클래스가 상수로 옮겨가 앵커가 낡았다) · hex 래칫 29 → 25+4(이동).
- 배포 뒤 판정: `lcpel.cjs https://urdeal.kr/login` 에서 FCP 가 HTML 직후(≈0.3~0.5s), 유달이 응답이 0.5s 안팎, 마운트 때 글자가 0 에서 다시 떠오르지 않는지(동영상 프레임 또는 `ur-lg-h` 미존재 확인).
- 🖥️ **PC 도 그린다**: 로그인 화면은 PC 가 같은 한 열(`max-w-[360px] md:max-w-[400px]`)이라 폰 전용 조건(`shouldRenderMobileFirstScreen`)의 예외로 뒀다(워커 분기 + `firstScreenApplies` PC 가지). PC 실측 전: FCP 1.44s. 다른 게스트 탭·상세·교환권의 PC 는 종전대로 안 그린다(2026-09-16 결정 — PC 레이아웃이 다르다).
- 📊 PC 재실측(1440px·4G·CPU 4배): 홈 1.22 · 상세 0.76(LCP 2.47 — PC 상세는 히어로를 서버가 안 그린다, 09-16 결정) · **교환권 2.27 · 유어샵 2.19 · 비로그인 이용권 2.00 · 로그인 1.44**. PC 는 폰과 레이아웃이 달라 첫 화면을 따로 그려야 한다 — 비중 실측(RUM 기기 분포) 뒤 대표 결정 사항으로 남긴다.

## 25. [E4] #2260 배포 뒤 판정 — 네 개는 맞았고 하나는 **안 보였다**(로더 투명) · 로그인 그림 늦음
- 머지 0206955(auto-merge 멎어 PUT /merge). 'Bundle budget (main)' 홈 +1.5KB 경계 → #2267 기준 갱신(홈만).
- ✅ 마이(비로그인) LCP **3.04 → 0.80s**(유달이 0.75s 도착) · 이용권(비로그인) LCP **3.14 → 0.53s** · 유어쇼츠 FCP **2.03 → 1.13s** · 지도 FCP **3.41 → 0.84s**(LCP 3.2s 는 타일 — 설계대로) · 로그인 첫 글자 **1.6 → 0.67s**.
- ❌ **로더-먼저 표면(검색·장바구니·뷰어)은 첫 그림이 안 당겨졌다**: `/cart` HTML 0.18s · 첫 그림 2.1s. 로더가 `var(--brand)`·`var(--rule)` 로 색을 받는데 로더-먼저 표면엔 변수(:root)가 없어 **투명**. ⇒ 토큰판(`CRITICAL_CSS_TOKENS`, 2.3KB) 신설 — 잠금 기록 `2026-11-09-loader-first.md` 후속 절. 🩸 **교훈**: "로더가 자기 스타일을 든다" 를 코드만 보고 믿었다 — 색은 변수였다. 가드가 전부 초록인 채 배포됐고 그림을 봐야만 보였다.
- ⚠️ 로그인 유달이는 첫 글자 뒤 **1.86s** 에야 요청됐다(마이에선 즉시). 같은 `<img loading=eager>` 인데 모듈 청크 20여 개와 회선을 다퉈 밀린 것으로 본다 → 서버 `<img>` 에 `fetchpriority="high"`(로그인·마이 둘 다). 배포 뒤 재확인.
- 배포 뒤 판정: `lcpel.cjs /cart`·`/search` 첫 그림 ≈ HTML 직후(0.3~0.5s) · `/login` 유달이 응답 0.5s 안팎.

## 26. [E4] #2269(토큰판 · 마스코트 fetchpriority) 배포 뒤 판정 — 로더가 **보인다**, 단 FCP 로는 안 보인다
- 라이브 `/cart` HTML 에 `<style id="ur-critical">` 2,263B(`--brand`·`--rule` 포함) 실림. 스크린샷 판정(`scratchpad/ldrshot.cjs`, 폰 4G·CPU 4배): HTML 도착 **+0.3s 흰 화면(의도 — `shy` 0.5초)** → **+0.7s 뼈대 17칸 보임**(비바탕 픽셀 48,195) → +1.6s 앱 내용. `--rule` 이 `rgb(22 24 28 / .08)` 로 풀린다(종전엔 빈 값 → 투명).
- 🩸 **FCP 는 이 로더를 못 본다** — 뼈대는 배경색 사각형이고 FCP 는 글자·이미지·SVG 만 센다. 그래서 vitals 의 /cart·/search FCP 는 그대로(앱 글자 시점)다. **로더-먼저의 판정은 스크린샷으로만** 한다(이 절의 방법). §25 에서 "첫 그림 0" 이라고 적은 것은 변수 부재가 원인이었고(투명) 지금은 보인다.
- ✅ 로그인 유달이: HTML 0.85s → 그림 **1.14s**(종전 첫 글자 뒤 1.86s) — `fetchpriority="high"` 가 모듈 청크 앞으로 당겼다.
- 남은 것(대표 판단 — §24 와 같다): PC 첫 화면 · critical CSS 상한(69,602/70,000 + 토큰판은 별도 2.3KB) · 배포 묶기 · giftishow 이미지.

## 27. 로더 즉시 표시(HTML 이 늦었으면 shy 0.5초 생략) + 첫 로드 JS 미사용 분석
- JS 커버리지(폰 홈, 로컬 dist + 라이브 API, hidden sourcemap 매핑 — `scratchpad/localcov.cjs`): 첫 로드 청크 997KB raw 중 미사용 594KB. 큰 덩어리는 **React 자체(74KB)** 와 **일부러 미리 받는 상세·지도 청크**(가 넘어가면 즉시 — 2026-10-15 결정)라 첫 그림 비용이 아니다. 첫 그림에 걸리는 미사용은 `urdeal-icons`(11KB raw ≈3KB br)·`App.tsx` 라우트 표(20KB raw)·`lib/api.ts`(9KB raw) 정도 — 각 3KB br 아래라 **번들은 실질 바닥**. 더 줄이려면 i18n(`locale-ko` 25KB br) 표면별 분할 같은 구조 변경이 필요하다(대표 판단).
- 로더 즉시 표시: 잠금 기록 `2026-11-09-loader-early-reveal.md`. 배포 뒤 판정: `ldrshot.cjs /cart` 에서 TTFB > 0.5s 인 회차의 뼈대가 HTML +0.2~0.3s 에 보이는지(종전 +0.7s). 이 컨테이너는 TTFB 가 0.2~1.2s 로 요동치므로 TTFB 가 0.5s 넘은 회차만 판정에 쓴다.
- 🧭 `/group-buy` 하드 로드는 301 → `/`(0.5초) 지만 앱 안 이동은 클라이언트 `Navigate` 라 네트워크가 없다 — 고칠 것 없음. `HomeTopHeader.goRegion` 이 `/group-buy?gucode=` 로 보내는 코드는 **죽은 페이지(MainHomePage)** 전용이라 무시.

## 28. 대표 승인("배포 묶기 빼고 가장 이상적으로") — ① CSS 상한 표면별 · ② PC 상세 첫 화면
- ① 전체판 70KB → **표면별 40KB**(생성기 강제) + 전체판 160KB 정신 건강 상한. 기록 `2026-11-09-critical-css-cap-per-surface.md`.
- ② PC 상세 서버 첫 화면(그리드 통째 · 갤러리 PC 블록 · 제목 헤더 · 빈 aside). detail 표면 CSS 34,447 → 35,920B. 기록 `2026-11-09-pc-detail-first-screen.md`. 배포 뒤 판정: PC UA `lcpel.cjs https://urdeal.kr/pass/2919 pc` 에서 LCP 요소가 서버가 그린 큰 사진(종전 2.47s → ≈0.9s) · CLS < 0.01.
- 다음 PC 표면 후보(남은 순서): 교환권 목록 `/vouchers`(PC 2.27s) · 유어샵 `/u/:handle`(2.19s) · 로그인 전 탭(이용권·마이, 2.0s). 각각 PC 레이아웃이 다르다 — 표면 CSS 가 40KB 상한을 넘지 않는지 먼저 본다.
- ③ 교환권 사진 호스트(giftishow) · ④ 다국어 문구 분할은 이 뒤.

## 29. [E4] #2274 로더 즉시 표시 — 설계대로 동작
- 라이브 `/cart` 스크린샷 4회(폰 4G·CPU 4배): HTML **1,285ms** → 뼈대 **+300ms 에 이미 보임**(opacity 1 · 48,084px) · HTML 948ms → +300ms 보임 · HTML 1,499ms → +300ms 보임 · HTML **278ms(빠름)** → +300ms **아직 숨김**(shy 유지) → +700ms 보임. 즉 "느리면 바로, 빠르면 종전대로(0.5초 안이면 안 보인다)" 둘 다 맞다.

## 30. PC 첫 화면 둘(교환권 목록 · 유어샵) — PR 준비(#2275 뒤)
- 기록 `2026-11-09-pc-list-first-screens.md`. detail 처럼 `shouldRenderMobileFirstScreen` 을 **조건에서 빼고** 빌더 선택/인자로 옮겼다(가드 3건 재조준). 교환권 가드의 `min-width:1024px` 는 폰 본문에만 남는다.
- 🩸 **상단 네비 예약을 잊기 쉽다** — PC 상세 첫 판에 빠져 auto-merge 를 내려 고쳤다(§28). PC 첫 화면 = 반드시 `PC_HOME_FS.topnav*` 부터. 가드가 각 표면에서 맨 앞 자식을 대조한다.
- 배포 뒤 판정: PC UA `lcpel.cjs https://urdeal.kr/vouchers pc`(종전 FCP 2.27s) · `/u/jiwon1228 pc`(2.19s) · CLS < 0.01.

## 31. [E4] #2275 PC 상세 첫 화면 배포 뒤 판정
- PC(1440px·4G·CPU 4배) `/pass/2919`: LCP 요소가 **서버가 그린 큰 사진**(1280 폭) — HTML 1,119ms 도착 → 제목 1,472 → 사진 **1,808ms**(종전 2,470 — 앱 뒤) · 두 번째 회차 HTML 761 → 사진 **1,184ms**. vitals: FCP 664 · LCP **864** · **CLS 0.0019**(3.98s 에 공유 버튼 줄 0.0017 — 첫 화면 밖, 종전에도 있던 것). 가로 밀림 0(aside 예약 효과).
- 🔎 **PC 가 폰 히어로(960 폭)도 받는다** — React `DetailGallery` 가 폰 슬라이드 블록(`lg:hidden`)의 `<img>` 를 PC 에도 렌더해 `display:none` 인 채 다운로드(두 번째 회차 3,630ms 에 960 요청). 서버 첫 화면과 무관한 **기존 낭비**(PC 상세마다 수백 KB). 처방 후보: `DetailGallery` 가 `isDesktop` 이면 폰 블록을 렌더하지 않기(파일은 잠금표 밖). 다음 PR.

## 32. PC 상세가 폰 히어로를 또 받던 것 — `DetailGallery` 가 PC 에선 폰 블록을 렌더하지 않는다
- §31 발견의 처방. `lg:hidden` 은 숨기기만 하고 안의 `<img>` 는 받아진다(960 폭, 상세마다 수백 KB). `isDesktop`(이미 쓰던 `useMediaQuery`) 이면 폰 슬라이드·폰 썸네일 줄을 DOM 에서 뺀다. PC 블록은 배경 이미지라 폰에선 원래 안 받는다. 가드 3 + 주입 2. 배포 뒤 판정: PC `lcpel.cjs /pass/2919 pc` 에 `width=960` 요청이 없는지.

## 33. 로그인 전 탭 PC(430 액자) 첫 화면 — 네비 예약 + 액자 상자를 서버가 그린다
- PC 실측(1440px·4G·CPU 4배): 비로그인 이용권 FCP **2.69s** · 마이 **3.17s** · 로그인 1.23s(LCP 3.46 — 마운트 뒤 큰 글자 블록). 게스트 탭은 PC 에서 `MobileAppLayout` 이 `.mobile-app-container.app-framed`(430px 가운데) 로 감싸는데 서버는 액자를 몰라 종전엔 폰 UA 에만 그렸다.
- 처방: `buildGuestFirstScreen(…, isMobile)` — PC 면 [네비 높이 예약(`PC_HOME_FS.topnav*`, 로그인 화면은 네비가 없어 제외)] + [`mobile-app-container app-framed` · `--app-frame:430px`] 로 감싼다(값은 `MobileAppLayout` 그대로 — 시험이 소스 대조). 거터 바탕(`body.app-frame-host`)은 React 가 테마를 알고 칠한다 — 색만 바뀌고 자리는 그대로. 워커 게스트 분기의 UA 조건을 빼고 빌더 인자로(앵커 재조준 3 · css-first-boot PC 가지 `guestTabOf !== null`).
- 가드 ①-4 + 주입 2 되돌려 빨간불. 배포 뒤 판정: PC `vitals_nocb.cjs /my-vouchers pc`·`/user/profile pc` FCP ≈ HTML 직후, CLS < 0.01(액자 가로 밀림 0).

## 34. [E4] #2278 · #2279 배포 뒤 판정(PC 1440px · 4G · CPU 4배) + 브랜치 재기동
- **#2278 PC 상세 `/pass/2919`**: 요청 목록에 `width=960`(폰 히어로) **없음** — 1280 폭 한 장만 받는다(종전엔 숨긴 채 수백 KB 추가). LCP 1,300ms(HTML 681 → 사진), 그 회차 TTFB 641.
- **#2279 로그인 전 탭 PC**: `/my-vouchers` FCP **1,020 · 628ms**(종전 2,690) · CLS 0.0029 / `/user/profile` FCP **828 · 464ms**(종전 3,170) · LCP 1,004 · 632 · CLS 0.0014. 액자 가로 밀림 0(남은 0.001~0.003 은 3.7s 에 하단 칩 줄 — 첫 화면 밖, 종전에도 있던 것).
- 🔎 **남은 것 하나**: `/my-vouchers` PC 의 LCP 가 **3.4~3.7s** — 서버가 그린 제목(696ms, 7,399px²)보다 React 가 마운트한 **예시 사진**(`GUEST_EXAMPLE_IMG.cafe` `wallet-brunch.webp` 7.7KB, 7,709px²)이 아주 조금 커서 LCP 가 그 사진으로 넘어간다. 폰에선 사진이 작아 제목이 LCP 다. 처방 후보: 게스트 첫 화면 서버 본문에 예시 줄(`GuestExampleRows`)까지 그리기, 또는 최소한 그 사진 `<link rel=preload>`. 다음 작업.
- 🩸 브랜치: 지정 브랜치의 원격이 머지 뒤 자동 삭제돼 `checkout -B … origin/main` 으로 다시 세웠다. `push --delete` 는 분류기가 막는다 — 원격이 남아 있으면 삭제 대신 `origin/main` 을 머지해 올린다(이번엔 원격이 없어 새 브랜치로 올라갔다).

## 35. 검색 `/search` 서버 첫 화면 (대표 "계속 최적화")
- 폰 공개 화면 열 곳을 다시 재서 고른 다음 표면: 홈·교환권·블로그·둘러보기는 0.7~0.8s, **검색 2.25 · 장바구니 2.1 · 알림 1.7 · about 2.6 · faq 2.9s**(로더-먼저만). 유입 통계(funnel)엔 `/pass` 만 있어 노출 경로로 골랐다 — 검색은 홈 머리에서 한 번에 간다.
- 기록 `docs/locks/loading/2026-11-10-search-first-screen.md`. 🩸 한 줄 분기 꼬리 주석 뒤에 코드를 붙여 **통째로 주석**이 된 것을 주입 검사가 잡았다(tsc·텍스트 시험은 초록).
- 다음 후보: `/faq`(2.9s · 전부 고정 문구 — `CONCEPT_FAQ` 공유 배열로 질문 목록까지 서버가 그릴 수 있다) · `/about`(2.6s) · `/cart`·`/notifications`(로그인 필요 — 게스트 분기와 비슷한 가드가 필요).
- 배포 뒤 판정: `vitals_nocb.cjs https://urdeal.kr/search`(종전 FCP 2,252) · `… pc` · 검색어 있는 `/search?q=돈가스`.

## 36. [E4] #2283 검색 서버 첫 화면 배포 뒤 판정(폰 4G·CPU 4배 / PC 1440px)
- `/search`(검색어 없음) 폰: FCP **544ms** · LCP 688(유달이, 0.66s) · CLS 0 — 종전 FCP 2,252. 다른 회차 FCP 1,720 은 TTFB 가 늦은 회차(HTML 이 늦으면 그만큼 밀린다 — 서버 몫이 아니라 회선, §34·결재 참조).
- `/search?q=돈가스` 폰: FCP **1,016**(헤더가 먼저) · LCP 3,700(결과 목록 — API 뒤, 종전과 같은 구조) · CLS 0.
- PC: FCP **464** · LCP 636 · CLS 0.0027(액자·네비 예약 효과 — 가로 밀림 0).
- 남은 것: 검색어 있는 화면의 결과(LCP 3.7s)는 서버가 결과 API 를 self-fetch 해야 줄어든다(새 캐시 키 + 질의별이라 예열 불가 — 지금은 안 한다).

## 37. 자주 묻는 질문 `/faq` 서버 첫 화면 (대표 "계속 최적화")
- 기록 `docs/locks/loading/2026-11-10-faq-first-screen.md`. 화면 전체가 고정 문구라 **전부** 그린다(답변 본문만 뺀다 — 모션 CSS 전엔 펼쳐 보인다).
- 🔑 `SubPageHeader` 클래스를 `shared/sub-page-head.ts` 로 옮겼다 — 마이 아래 하위 화면(찜·쿠폰·리뷰·숙소·탈퇴…)이 같은 머리줄을 쓰므로 **다음 하위 화면 첫 화면은 `subPageHeadHtml(title)` 한 줄**로 머리줄을 얻는다.
- 다음 후보: `/about`(2.6s · 소개 랜딩, 풀폭) · `/cart`·`/notifications`(로그인 필요 — 게스트와 반대로 **세션 있을 때만** 그릴 껍데기).
- 배포 뒤 판정: `vitals_nocb.cjs https://urdeal.kr/faq`(종전 FCP 2,880) · `… pc`.

## 38. [E4] #2285 자주 묻는 질문 서버 첫 화면 배포 뒤 판정(폰 4G·CPU 4배 / PC 1440px)
- `/faq` 폰: FCP = LCP **704 · 740 · 808 · 1,016ms**(종전 FCP 2,880 · LCP 2,880) · CLS 0. 한 회차 2,212 는 TTFB 가 늦은 회차(회선). 검색(0.54s)보다 0.2s 느린 건 HTML 이 크다(질문 13줄 + 표면 CSS 34KB) — 전부 첫 화면 내용이라 그대로 둔다.
- PC: FCP = LCP **1,124ms** · CLS 0.0015(액자·네비 예약 — 가로 밀림 0).
- 긴 작업(TBT) 폰 219~783ms 는 앱 마운트 비용으로 종전과 같은 구조(서버 첫 화면은 그걸 가릴 뿐 줄이지 않는다).

## 39. 알림 `/notifications` 서버 첫 화면 — 세션 쿠키가 있을 때만 (대표 "계속 최적화")
- 기록 `docs/locks/loading/2026-11-10-notifications-first-screen.md`. 가드 방향이 게스트 탭과 **반대**(`authed`). 공용 머리줄을 `utils/sub-page-head-html.ts` 로 빼서 FAQ·알림이 같이 쓴다(`wide` 인자).
- 🔴 E4 는 이 컨테이너가 못 잰다(소비자 세션 쿠키가 없다 — 비로그인 요청은 종전과 byte-동일한 로더). 판정은 ① 대표 폰 실측 또는 ② 월요일 RUM 표본(`vitals:…:FCP:/notifications`) 으로.
- 다음 후보: `/cart`(비로그인도 접근 — 머리줄 + 빈 장바구니/로더) · `/about`(2.6s, 랜딩 — 모션 부품이 많아 서버 그림과 앱 첫 프레임을 맞추기 어렵다, 후순위).

## 40. 장바구니 `/cart` 서버 첫 화면 — 머리줄 + 로더 (대표 "계속 최적화")
- 기록 `docs/locks/loading/2026-11-10-cart-first-screen.md`. 로딩 분기(흰 바탕 + 전체 로더)도 완성 화면과 같은 뿌리 + 머리줄로 맞췄다(서버 그림 → 로딩 → 완성이 한 모양).
- 🧭 "첫 화면 없는 표면" 예시를 쓰는 시험·주입이 `/search` → `/cart` → `/checkout` 으로 두 번 밀렸다. 다음엔 처음부터 `/checkout`(로그인 필요 + 결제 — 서버 첫 화면을 둘 일이 없다)을 예시로 쓸 것.
- 배포 뒤 판정: `vitals_nocb.cjs https://urdeal.kr/cart`(종전 FCP 2,100) · `… pc`.

## 41. [E4] #2288 장바구니 서버 첫 화면 배포 뒤 판정(폰 4G·CPU 4배 / PC 1440px)
- `/cart` 폰(비로그인·빈 장바구니): FCP **408 · 472 · 496ms**(종전 2,100) · CLS 0. 한 회차 1,060 은 TTFB 가 늦은 회차.
- LCP 는 **2.0~2.5s 그대로** — 가장 큰 요소가 빈 장바구니 안내 문장(`EmptyCart`, API 응답 뒤)이라 서버 머리줄이 LCP 가 아니다. 비로그인의 장바구니는 사실상 늘 비어 있으므로 **세션 쿠키가 없을 때 서버가 빈 장바구니 안내까지 그리면** LCP 도 0.5s 대가 된다(로그인 사용자는 API 가 와야 안다 — 지금처럼 머리줄만). 다음 PR 후보.
- PC: FCP **424** · LCP 2,028 · CLS 0.0002.

## 42. 장바구니 후속 — 비로그인은 빈 장바구니까지 서버가(로더 없음)
- §41 의 LCP 2.0~2.5s(빈 장바구니 안내가 API 뒤) 처방. `buildCartFirstScreen(…, authed)` — 세션 없음 → 머리줄 + `EmptyCart` 모양, 있음 → 머리줄 + 로더. 기록은 `2026-11-10-cart-first-screen.md` 후속 절.
- 배포 뒤 판정: 비로그인 `lcpel.cjs https://urdeal.kr/cart` 의 LCP 요소가 서버가 그린 안내 문장(≈FCP)인지 · PC 도.

## 43. 대외 안내 랜딩 셋 서버 첫 화면 — 머리줄 + 사진 칸 (대표 "계속 최적화")
- 기록 `docs/locks/loading/2026-11-10-landing-first-screen.md`. 🔑 사진은 preload 로 0.8s 에 와 있었는데 LCP 3.2~4.7s — "받는 것" 과 "그리는 것" 은 다르다. 제목·문장은 승인된 마스크 모션이라 일부러 안 그린다(사진이 LCP 라 충분하다).
- §34 의 PC 이용권 탭 예시 사진(LCP 3.4s)은 **하지 않기로** — 예시 줄이 스크롤 등장 모션(`ur-gp-shelf`, 2026-11-04 대표 *"모션그래픽 제대로 넣어줘"*)이라 서버가 그리면 그 모션을 꺼야 하고, 사용자가 보는 내용은 이미 0.7s 에 떠 있다(측정 라벨만 바뀐다).
- 배포 뒤 판정: `lcpel.cjs https://urdeal.kr/about`(LCP 요소가 서버 사진 · ≈0.8s) · `/partners` · `/influencer` · PC.

## 44. 장바구니 정정 — 비로그인은 로그인 안내 화면(§42 의 오판) + 검색 결과 시드
- 🩸 **이번에 틀렸던 판단**: 비로그인 장바구니를 "API 401 → 빈 장바구니" 로 추론해 `EmptyCart` 를 서버가 그렸다. 라이브 LCP 요소는 '장바구니를 이용하려면 로그인해 주세요'(로그인 안내 화면, `CartPage` `!loggedIn` 분기). 그 사이 바탕·문장이 통째로 바뀌는 깜빡임이 있었다 → 로그인 안내 화면 전체로 정정(`CART_GUEST_CLS`). 기록은 `2026-11-10-cart-first-screen.md` 정정 절.
- 🌱 검색 결과 시드: `/search?q=` 의 LCP 3.7s(결과가 앱 부팅 뒤 한 왕복) → 워커가 첫 장(`/api/search?q&page=1&limit=50&scope`, 훅과 같은 경로)을 `__SSR_INITIAL_SEARCH__`(검색어·범위 표식)로 싣고 `useSearchInfinite` 가 initialData 로 쓴다. 마감 700ms(차가운 D1 이 HTML 을 붙잡지 않게). 가드 `search-seed-2026-11-10.test.ts` + 주입 6.
- 배포 뒤 판정: 비로그인 `/cart` LCP 요소 = 서버 안내 문장(≈FCP) · `/search?q=돈가스` LCP(종전 3.7s) · `X-SSR-Status: SEARCH:*`(edge/stale/self/deadline 분포).
