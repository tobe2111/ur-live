# Firebase 환경변수 확인 가이드

## 🔍 Firebase Console에서 정확한 값 확인하는 방법

### 📍 Firebase Console 접속
https://console.firebase.google.com/

---

## Step 1: 프로젝트 선택

1. Firebase Console 접속
2. **프로젝트 목록**에서 선택:
   - `toss-live-commerce` 또는
   - `urteam-live-commerce-5b284`

---

## Step 2: 프로젝트 설정 열기

1. 좌측 상단 **⚙️ (톱니바퀴) 아이콘** 클릭
2. **프로젝트 설정(Project settings)** 클릭

---

## Step 3: 웹 앱 설정 확인

### 3-1. 일반(General) 탭에서 확인

화면을 아래로 스크롤하면 **"내 앱(Your apps)"** 섹션이 있습니다.

#### 웹 앱이 이미 있는 경우:
```
📱 웹 앱 (</> 아이콘)
앱 닉네임: toss-live-commerce-web (또는 다른 이름)
```

**"SDK 설정 및 구성" 또는 "Config"** 버튼을 클릭하면 다음과 같은 코드가 나옵니다:

```javascript
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSy...",              // ← VITE_FIREBASE_API_KEY
  authDomain: "xxx.firebaseapp.com", // ← VITE_FIREBASE_AUTH_DOMAIN
  projectId: "xxx",                  // ← VITE_FIREBASE_PROJECT_ID
  storageBucket: "xxx.appspot.com",  // ← VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789",    // ← VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123...:web:abc...",      // ← VITE_FIREBASE_APP_ID
  measurementId: "G-XXXXXX"          // ← VITE_FIREBASE_MEASUREMENT_ID
};
```

#### 웹 앱이 없는 경우:
1. **"앱 추가(Add app)"** 버튼 클릭
2. **웹(</> 아이콘)** 선택
3. 앱 닉네임 입력 (예: `toss-live-commerce-web`)
4. **"앱 등록(Register app)"** 클릭
5. 위의 `firebaseConfig` 코드가 나타남 → **복사**

---

## Step 4: Realtime Database URL 확인

### 4-1. Realtime Database 섹션으로 이동
1. 좌측 메뉴에서 **빌드(Build)** → **Realtime Database** 클릭

### 4-2. Database URL 확인
화면 상단에 Database URL이 표시됩니다:
```
https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```
↑ 이게 `VITE_FIREBASE_DATABASE_URL` 값입니다.

#### Database가 없는 경우:
1. **"데이터베이스 만들기(Create Database)"** 클릭
2. 위치 선택: **asia-southeast1 (싱가포르)** 또는 **us-central1**
3. 보안 규칙: **테스트 모드로 시작(Test mode)** 선택 (나중에 변경 가능)
4. **사용 설정** 클릭
5. 생성된 Database URL 확인

---

## ✅ 확인된 값 정리

Firebase Console에서 확인한 값을 아래 형식으로 정리하세요:

```plaintext
VITE_FIREBASE_API_KEY=<apiKey 값>
VITE_FIREBASE_AUTH_DOMAIN=<authDomain 값>
VITE_FIREBASE_PROJECT_ID=<projectId 값>
VITE_FIREBASE_STORAGE_BUCKET=<storageBucket 값>
VITE_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId 값>
VITE_FIREBASE_APP_ID=<appId 값>
VITE_FIREBASE_MEASUREMENT_ID=<measurementId 값>
VITE_FIREBASE_DATABASE_URL=<Database URL>
```

---

## 📋 현재 제공된 값과 비교

제가 제공한 값:
```javascript
{
  apiKey: "AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM",
  authDomain: "toss-live-commerce.firebaseapp.com",
  projectId: "toss-live-commerce",
  storageBucket: "toss-live-commerce.firebasestorage.app",
  messagingSenderId: "408717649003",
  appId: "1:408717649003:web:29aa3cb5f92056dd1ec4f4",
  measurementId: "G-78M73BGT77",
  databaseURL: "https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app"
}
```

이 값들이 Firebase Console에서 확인한 값과 **정확히 일치하는지** 확인하세요!

---

## 🔍 값이 다른 경우

만약 Firebase Console에서 확인한 값이 제가 제공한 값과 다르다면:
1. **Firebase Console에서 확인한 값**이 **정확한 값**입니다
2. 제가 제공한 값 대신 **Firebase에서 확인한 값**을 사용하세요
3. Cloudflare 환경변수에 **Firebase에서 확인한 값**을 입력하세요

---

## 💡 참고: .env 파일에서도 확인 가능

프로젝트의 `.env` 파일에도 이미 값이 있을 수 있습니다:

```bash
cd /home/user/webapp && cat .env | grep VITE_FIREBASE
```

이 값들이 Firebase Console과 일치하는지 확인하세요.

---

## 🚨 주의사항

### 프로젝트 ID 혼동 주의!
- **Firebase Project ID**: `toss-live-commerce` (짧은 ID)
- **Firebase Database 이름**: `urteam-live-commerce-5b284` (긴 ID)
- 두 개가 **다를 수 있습니다!**

### Database URL 형식 확인
- 올바른 형식: `https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app`
- 잘못된 형식: `https://xxx.firebaseio.com` (구식)

---

## 🎯 요약

1. **Firebase Console** (https://console.firebase.google.com/) 접속
2. **프로젝트 설정** → **일반** → **내 앱** → **웹 앱** → **Config** 확인
3. **Realtime Database** 메뉴에서 Database URL 확인
4. 확인한 값과 제가 제공한 값 비교
5. **Firebase에서 확인한 값**을 Cloudflare에 입력

**Firebase Console이 정확한 값의 출처입니다!** ✅
