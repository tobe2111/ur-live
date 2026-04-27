# Capacitor 모바일 앱 정찰 (O2)

> 작성: 2026-04-26
> 목적: iOS / Android 네이티브 앱 빌드 환경 + 통합 상태 파악
>
> ⚠️ 본 문서는 **현재 상태 정찰**. 실제 빌드/배포는 사용자 환경 (Mac for iOS, Android Studio) 필요.

---

## 1. 설정 요약

### `capacitor.config.ts`
- **App ID**: `com.urteam.yourdeal`
- **App Name**: 유어딜
- **Web Dir**: `dist/client` (빌드 산출물 그대로 packaging)
- **Server URL**: development 시 localhost:5173, production 시 packaged web

### 보안 설정
- ✅ `cleartext: false` (production HTTPS 강제, MITM 방어)
- ✅ `allowMixedContent: false` (Android, HTTP 리소스 차단)
- ✅ `allowNavigation` 화이트리스트 (live.ur-team.com / kakao / youtube / toss / google)
- ✅ iOS `limitsNavigationsToAppBoundDomains: true` (Associated Domains 만)

### iOS 특화
- `scheme: 'yourdeal'` — 딥링크 (yourdeal://...)
- `contentInset: 'automatic'`
- `preferredContentMode: 'mobile'`

### Android 특화
- `appendUrlPath: true` (딥링크)
- `backgroundColor: '#020202'`

---

## 2. 설치된 Capacitor 플러그인 (13개)

| 플러그인 | 버전 | 목적 |
|---|---|---|
| `@capacitor/core` | 8.3.0 | 코어 |
| `@capacitor/cli` | 8.3.0 | CLI |
| `@capacitor/android` | 8.3.0 | Android 어댑터 |
| `@capacitor/ios` | 8.3.0 | iOS 어댑터 |
| `@capacitor/app` | 8.1.0 | 앱 라이프사이클 |
| `@capacitor/browser` | 8.0.3 | In-app browser |
| `@capacitor/haptics` | 8.0.2 | 햅틱 피드백 |
| `@capacitor/keyboard` | 8.0.2 | 키보드 (resize: body) |
| `@capacitor/push-notifications` | 8.0.3 | FCM/APNs |
| `@capacitor/share` | 8.0.1 | OS 공유 시트 |
| `@capacitor/splash-screen` | 8.0.1 | 스플래시 |
| `@capacitor/status-bar` | 8.0.2 | 상태바 |
| `@capacitor-community/admob` | 6.2.0 | AdMob 광고 |

**주의**: AdMob 만 community 플러그인. 업데이트 주기 다를 수 있음.

---

## 3. 네이티브 프로젝트 상태

### Android (`/android/`)
- ✅ `build.gradle` 존재
- ✅ `variables.gradle` 존재 — Android SDK 36 (최신, 2024 기준)
  - minSdkVersion: 24 (Android 7.0+)
  - targetSdkVersion: 36
  - compileSdkVersion: 36
- ✅ `gradlew` (Gradle Wrapper) 존재
- ⚠️ `app/google-services.json` (FCM) — `.gitignore` 처리, 별도 보관 필요

### iOS (`/ios/`)
- ✅ `App/` 디렉토리
- ✅ `debug.xcconfig` (CAPACITOR_DEBUG=true)
- ⚠️ `App/GoogleService-Info.plist` (FCM) — `.gitignore` 처리, 별도 보관 필요

---

## 4. 동기화 / 빌드 명령

```bash
# 1. 웹 빌드 + 네이티브 동기화
npm run app:sync           # = npm run build + npx cap sync

# 2. Android Studio 열기 (Android 빌드)
npm run app:android        # = sync + npx cap open android

# 3. Xcode 열기 (iOS 빌드)
npm run app:ios            # = sync + npx cap open ios
```

⚠️ `npm run build` 는 worker 빌드도 포함 → 모바일 앱은 worker 사용 안 함.
권장: `npm run build:client && npx cap sync` (worker 빌드 skip).

---

## 5. 환경별 동작 차이 분석

### 카카오 로그인
- **웹**: 카카오 OAuth → 콜백 → 세션 쿠키 (`isKorea()` 분기)
- **모바일**: `@capacitor/browser` In-app browser 로 처리 가능?
- ⚠️ **확인 필요**: 카카오 OAuth 콜백 URL 에 모바일 scheme(`yourdeal://`) 등록되어 있는지

### Firebase Auth
- **웹**: Firebase Web SDK
- **모바일**: 같은 SDK 사용 (Capacitor + Web SDK 호환)
- ⚠️ **확인 필요**: iOS GoogleService-Info.plist 와 Web Firebase 프로젝트 일치 여부

### 푸시 알림
- 인프라 있음 (`@capacitor/push-notifications`)
- ⚠️ **확인 필요**: 백엔드 측 `dashboard_notifications` 가 모바일 푸시도 트리거하는지
- ⚠️ FCM Server Key / APNs 인증서 별도 등록 필요

### YouTube 라이브 송출
- **웹**: YouTube Studio / OBS 외부 도구
- **모바일**: 자체 송출 X — 셀러는 모바일에서도 OBS 중계 또는 데스크톱 사용 가정?

---

## 6. ⚠️ 모바일에서 잠재 이슈

### 6.1 보안 헤더
- `allowNavigation` 화이트리스트에 **algonomous (알리고)** 도메인 없음 — 알림톡 발송이 모바일에서 작동 X 가능
  - 단: 백엔드가 알리고 호출하므로 클라이언트 영향 없을 수 있음
- 토스페이먼츠 결제 콜백 처리 → `js.tosspayments.com` 등록되어 있음 ✅

### 6.2 딥링크
- iOS scheme `yourdeal://` 등록
- ⚠️ Universal Links / Apple App Site Association 파일 (https://live.ur-team.com/.well-known/apple-app-site-association) 확인 필요
- ⚠️ Android Intent Filter (App Links) 확인 필요

### 6.3 빌드 환경
- iOS: Mac + Xcode 16+ 필요
- Android: Android Studio + JDK 17+ + Android SDK 36
- CI 빌드 ❌ (현재 main.yml 은 웹 배포만)

### 6.4 미사용 가능성 의심
- `chrome-extension/` — UR Live OBS Bridge (셀러 데스크톱용, 모바일 무관)
- 모바일에서 라이브 송출 가능하다면 Chrome Extension 불필요

---

## 7. 권장 조치 (Priority 순)

### 🔴 즉시 확인 (사용자)
1. **iOS 빌드 환경 확인**: Xcode 16+ 설치, App Store Connect 인증서 유효성
2. **Android 빌드 환경 확인**: Android Studio 최신, Google Play Console 키 인증서
3. **FCM/APNs 인증서 만료일** 확인
4. **카카오 OAuth Redirect URI** 에 모바일 콜백 등록 여부

### 🟡 권장 개선
5. **딥링크 테스트**: 카톡 공유 / 메시지로 받은 URL 클릭 → 앱 실행되는지
6. **푸시 알림 통합**: 백엔드 `dashboard_notifications` → FCM/APNs 자동 발송 로직 추가
7. **Universal Links** 설정 (iOS 우선)

### 🟢 장기
8. **CI 빌드** (Android 만 — Mac 필요한 iOS 는 별도)
9. **Capacitor 9.x 마이그레이션** 모니터링
10. **TWA (Trusted Web Activity)** 검토 — Android 전용, 더 가벼운 대안

---

## 8. 빠른 health check 명령

```bash
# 1. Android 의존성 / 가용성 체크
cd android && ./gradlew --version
cd android && ./gradlew tasks --all | head -50

# 2. iOS 의존성 (Mac 에서만)
cd ios && pod --version
cd ios && xcodebuild -showBuildSettings | head -30

# 3. Capacitor 동기화 dry-run
npx cap doctor

# 4. 앱 ID / scheme 일치 확인
grep -r "com.urteam.yourdeal" ios/ android/ capacitor.config.ts
grep -r "yourdeal://" ios/ android/

# 5. FCM/APNs 파일 존재 확인 (gitignored)
ls -la android/app/google-services.json 2>&1
ls -la ios/App/GoogleService-Info.plist 2>&1
```

---

## 9. 결론

- **인프라**: 견고함 (보안 헤더, 도메인 화이트리스트, MITM 방어 모두 설정됨)
- **상태**: 실제 빌드 / 스토어 배포 여부 불명 (사용자 확인 필요)
- **위험**: 푸시 알림 백엔드 통합 미완성 가능성, 딥링크 검증 필요
- **권장**: 사용자가 위 8번 health check 명령 1회 실행 → 결과 공유 → 다음 단계 결정
