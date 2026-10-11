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
- iOS 는 웹앱 시작화면이 이 설정을 안 쓴다(apple-touch-startup-image 없음) — 필요하면 별건.
