# 유어딜 모바일 앱 빌드 가이드

## 사전 준비

### 1. Firebase 설정 파일 다운로드
Firebase Console (https://console.firebase.google.com) → 프로젝트 설정 → 앱

**Android:**
- "Android 앱 추가" (패키지명: `com.urteam.yourdeal`)
- `google-services.json` 다운로드
- `android/app/` 폴더에 배치

**iOS:**
- "iOS 앱 추가" (번들 ID: `com.urteam.yourdeal`)
- `GoogleService-Info.plist` 다운로드
- `ios/App/App/` 폴더에 배치

### 2. Android 서명 키 생성
```bash
keytool -genkey -v -keystore android/yourdeal-release.keystore \
  -alias yourdeal -keyalg RSA -keysize 2048 -validity 10000
```
프롬프트에서 비밀번호와 정보 입력 후:
```bash
cp android/keystore.properties.example android/keystore.properties
```
`android/keystore.properties` 편집:
```properties
storeFile=../yourdeal-release.keystore
storePassword=입력한_비밀번호
keyAlias=yourdeal
keyPassword=입력한_비밀번호
```

## 빌드

### 웹 빌드 + 네이티브 동기화
```bash
npm run app:sync
```

### Android 빌드
```bash
npm run app:android
# Android Studio가 열림 → Build → Generate Signed Bundle/APK
# 또는 커맨드라인:
cd android && ./gradlew assembleRelease
# 결과: android/app/build/outputs/apk/release/app-release.apk
```

### iOS 빌드
```bash
npm run app:ios
# Xcode가 열림 → Product → Archive → Distribute App
```
※ iOS 빌드에는 Mac + Apple Developer 계정 ($99/년) 필요

## 스토어 출시

### Google Play Store
1. https://play.google.com/console 에서 개발자 계정 생성 ($25 일회성)
2. "앱 만들기" → 앱 이름: 유어딜
3. APK 또는 AAB 업로드
4. 스토어 등록정보:
   - 앱 이름: 유어딜 - 라이브 커머스
   - 간단한 설명: 인플루언서 라이브 방송으로 최저가 맛집 공동구매
   - 자세한 설명: 라이브 방송 시청 + 실시간 채팅 + 경매 + 타임딜 + 맛집 바우처
   - 스크린샷: 최소 2장 (폰 사이즈)
   - 개인정보처리방침 URL: https://live.ur-team.com/privacy
5. 심사 제출 → 보통 1-3일

### Apple App Store
1. https://appstoreconnect.apple.com 에서 앱 등록
2. Xcode에서 Archive → Upload
3. 스토어 정보 입력 (위와 동일)
4. 심사 제출 → 보통 1-7일

## 환경 정보
- App ID: `com.urteam.yourdeal`
- App Name: 유어딜
- iOS Scheme: `yourdeal://`
- Android Min SDK: 24
- Android Target SDK: 36
