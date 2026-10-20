# 2026-10-11 시작화면 안 1(네이비 전면) + 6-B 앱 아이콘 적용

## 무엇
- 대표 *"시작화면 디자인이야 지금. 너무 별로야"* → 시안 3안 → *"안1로 해줘"*.
- manifest `background_color` `#F8F7FC` → `#1B2340` + 6-B 아이콘(`public/app-icon-*`) 적용(보류했던 stash 복원).
- 스토어 앱: `capacitor.config.ts` SplashScreen 바탕 `#1B2340` + `android/.../splash.png` 11장 네이비 + 6-B 로 재생성.
- 가드 `splash-seamless-2026-10-11.test.ts`(바탕색 = maskable 아이콘 첫 화소, 되돌려-검증 빨간불 확인).

## 다음 세션 첫 액션
- 배포 후 `curl -s https://urdeal.kr/manifest.webmanifest | grep background_color` → `#1B2340`.
- E4 는 안드로이드 폰에서 홈 화면 웹앱 재설치 후 시작화면 눈 확인(이미 설치된 앱은 브라우저 재검사 때 수일 뒤 바뀜).

## 남은 것
- 카카오 채널 프로필(`kakao-channel-profile-640.png`)은 대표가 카카오 비즈니스에서 직접 업로드.
- ✅ iOS 도 했다(대표 *"아이폰 시작화면도 해줘"*): 웹앱 `apple-touch-startup-image` 12종(`public/ios-splash-*.png`, 생성 `scripts/app-icon/make-ios-splash.py`) + 스토어 앱 `Splash.imageset` 네이비. 가드가 선언·파일·**픽셀 크기**·exclude 를 대조(크기 1px 만 달라도 iOS 는 흰 화면 — 되돌려-검증 빨간불 확인).
- iOS E4: 배포 후 `curl -sI https://urdeal.kr/ios-splash-1170x2532.png` 200 → 아이폰 사파리에서 홈 화면에 **새로** 추가하고 열어 남색 시작화면 확인(이미 추가한 웹앱은 지우고 다시 추가). 스토어 앱은 다음 iOS 빌드부터 반영.
- ⚠️ 안 덮는 기기: 목록 밖 아이폰·아이패드·가로 화면은 종전처럼 흰 화면(iOS 기본). 새 아이폰이 나오면 스크립트 `DEVICES` 에 한 줄 추가.

## 파비콘(구글 검색 결과·브라우저 탭) — 남색 + 유달이 얼굴
- 대표 *"구글 검색 시 뜨는 유어딜 로고도 바꿔지나?"* → *"남색 바탕에 유달이로도 해주고"*. 앱 아이콘·시작화면만으로는 구글 로고가 안 바뀐다(구글은 rel=icon 파비콘을 쓴다).
- `scripts/app-icon/make-favicon.py` → `favicon.ico`·`favicon-16/32/48/96/144.png`·`favicon.svg`·`icon-192/512.png`. 확정 얼굴 `otter-face-happy.png` 재사용(새로 그린 유달이 아님). `icon-512` 는 JSON-LD 로고·푸시 알림 아이콘도 겸한다.
- 가드: 선언된 PNG 파비콘 전부의 바탕 = 남색(옛 파비콘 하나를 되돌리면 빨간불 확인).
- E4: 배포 후 `curl -sI https://urdeal.kr/favicon-48.png` → 새 파일(크기 3,271B) · 구글 검색 결과 반영은 구글 재수집 뒤(며칠~몇 주). 서치콘솔에서 홈 URL 재색인 요청하면 빨라질 수 있다.
- 안 바꾼 것: `favicon-biz-32.png`·`icon-biz-*`(사업자 표면)·`favicon-utong.svg`(도매몰) — 다른 서비스 아이콘.
