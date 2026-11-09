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
