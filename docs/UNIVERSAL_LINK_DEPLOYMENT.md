# Universal Link / App Link / Capacitor 배포 가이드

> 🎯 목적: 카카오톡 / FB / IG / Line / Google 앱 등 인앱 webview 사용자가 링크 클릭 시 → 자동으로 우리 앱 (또는 외부 브라우저) 으로 진입.

## 현재 상태 (2026-04-30)

✅ **완료됨 (코드 인프라)**
- `public/.well-known/apple-app-site-association` — 템플릿
- `public/.well-known/assetlinks.json` — 템플릿
- `public/_headers` — Content-Type: application/json 설정
- `ios/App/App/App.entitlements` — `applinks:live.ur-team.com`
- `android/app/src/main/AndroidManifest.xml` — `intent-filter android:autoVerify="true"` + `https://live.ur-team.com`
- `capacitor.config.ts` — appId, allowNavigation, scheme 설정 완료
- `src/components/PWAInstallPrompt.tsx` — PWA 설치 prompt UI
- `src/lib/in-app-warning.ts` — progressive enhancement (PWA + permissions API + UA matrix)

❌ **사용자 액션 필요**
1. Apple Developer 계정 ($99/yr) → Team ID 발급
2. Google Play Console 계정 ($25 1회)
3. Capacitor 앱 빌드 + 서명 + Store 등록
4. 위에서 받은 정보로 `.well-known/` 파일 finalize

---

## 단계 1: Apple Developer 등록 + Universal Link 활성화

### 1-1. Apple Developer 계정 생성
- https://developer.apple.com/programs/
- 연 $99 (개인) 또는 $299 (조직)
- Team ID 발급 (예: `ABCD1234EF`)

### 1-2. App ID 생성
- Identifier: `com.urteam.yourdeal`
- Capabilities: ✅ Associated Domains

### 1-3. AASA 파일 업데이트
**파일**: `public/.well-known/apple-app-site-association`

`TEAMID` 를 발급받은 Team ID 로 교체:
```diff
- "appIDs": ["TEAMID.com.urteam.yourdeal"]
+ "appIDs": ["ABCD1234EF.com.urteam.yourdeal"]
```

### 1-4. Capacitor iOS 빌드
```bash
npm run build
npx cap sync ios
npx cap open ios   # Xcode 열림
```

Xcode 에서:
1. Signing & Capabilities → Team 선택 (Apple Developer)
2. **Capabilities → + → Associated Domains 추가**
   - `applinks:live.ur-team.com`
3. Bundle Identifier: `com.urteam.yourdeal`
4. Build → Archive → Validate → Distribute App → App Store Connect

### 1-5. App Store 심사 (1-3일)
- Apple 이 자동으로 `https://live.ur-team.com/.well-known/apple-app-site-association` 검증
- 심사 통과 후 사용자 device 에 앱 설치되면 Universal Link 자동 활성

### 1-6. 검증
**테스트**: 카카오톡에서 자기 자신에게 `https://live.ur-team.com/products/123` 메시지 → 클릭
- ✅ 앱 설치돼 있으면 → 유어딜 앱 자동 진입
- ❌ 앱 없으면 → 카카오 webview 그대로 (지금과 동일)

---

## 단계 2: Google Play 등록 + App Link 활성화

### 2-1. Google Play Console 계정
- https://play.google.com/console/
- $25 1회 결제

### 2-2. Android App Bundle 생성
```bash
npm run build
npx cap sync android
npx cap open android   # Android Studio 열림
```

Android Studio 에서:
1. Build → Generate Signed Bundle / APK
2. Create new keystore (또는 기존 keystore 사용)
3. **keystore 의 SHA256 fingerprint 추출**:
   ```bash
   keytool -list -v -keystore your-keystore.jks -alias your-alias
   ```
   출력 중 `SHA256: XX:XX:...` 복사

### 2-3. assetlinks.json 업데이트
**파일**: `public/.well-known/assetlinks.json`

```diff
- "REPLACE_WITH_PRODUCTION_SHA256_FINGERPRINT_AFTER_PLAY_CONSOLE_UPLOAD"
+ "AB:CD:EF:01:23:45:67:89:..."  // keytool 결과 그대로
```

**주의**: Play 가 자체 서명 (Play App Signing) 사용 시:
- Play Console → 앱 → Setup → App integrity → App signing key 의 SHA256 도 추가
- assetlinks.json 의 `sha256_cert_fingerprints` 배열에 둘 다 등록 (upload 키 + Play 서명 키)

### 2-4. Play Console 업로드 + 심사 (1-3일)
- App Bundle 업로드
- 심사 통과 후 출시

### 2-5. 검증
**테스트**: Chrome 에서 `adb shell pm verify-app-links --re-verify com.urteam.yourdeal`
- 카카오톡 메시지 링크 → 앱 자동 진입

---

## 단계 3: PWA 설치 권장 (즉시 효과)

자체 앱 없이도 사용자가 PWA 설치하면 인앱 차단 우회 가능. 이미 적용:
- `PWAInstallPrompt.tsx` — 7일 dismiss 가드 + 인앱 사용자 우선 표시
- `manifest.webmanifest` — display: standalone, shortcuts 등록

**권장 작업**:
1. **다양한 사이즈 아이콘 추가** (현재 `favicon.svg` 만)
   - `/public/icon-192.png` (192x192)
   - `/public/icon-512.png` (512x512)
   - `/public/icon-maskable-192.png` (Android adaptive)
2. manifest.webmanifest 의 icons 배열 업데이트

---

## 단계 4: 배포 후 모니터링

### Sentry 알림 추가
- `error.message` 에 'Universal Link' / 'App Link' 포함되면 즉시 alert
- PWA install 이벤트 → analytics
- 인앱 webview 별 페이지 로드 비율 추적

### A/B 테스트
- 카카오 webview 사용자에게 PWA prompt 표시 vs 미표시 → 전환율 비교
- "외부 브라우저로 열기" 버튼 클릭률

---

## 트러블슈팅

### iOS Universal Link 안 작동
1. AASA 파일이 `https://live.ur-team.com/.well-known/apple-app-site-association` 에서 200 + `application/json` 으로 응답하는지 확인
   ```bash
   curl -I https://live.ur-team.com/.well-known/apple-app-site-association
   ```
2. 파일에 BOM / 확장자 (`.json`) 없는지 확인 — Apple 은 확장자 없는 plain JSON 만 인식
3. Apple CDN 캐시 — 변경 후 24h 대기 또는 Apple 의 CDN-Apple-Validation 헤더 확인

### Android App Link 안 작동
1. assetlinks.json 의 SHA256 이 실제 production 서명 키와 일치하는지
2. Play App Signing 사용 시 → Play Console 의 SHA256 도 등록
3. 검증: `adb shell pm get-app-links com.urteam.yourdeal` 결과가 'verified'

---

## 참고 자료
- iOS Universal Link: https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app
- Android App Link: https://developer.android.com/training/app-links
- Capacitor: https://capacitorjs.com/docs/guides/deep-links
