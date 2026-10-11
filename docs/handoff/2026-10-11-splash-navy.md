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
