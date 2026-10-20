# 🚨 Firebase 프로젝트 ID 불일치 발견!

## ❌ 심각한 문제

### 프론트엔드 설정 (firebaseConfig)
```javascript
projectId: "urteam-live-commerce"  // ❌ 하이픈 없음
```

### 백엔드 Service Account (JSON)
```json
"project_id": "urteam-live-commerce-5b284"  // ✅ -5b284 포함
```

**이 불일치로 인해 인증 및 데이터베이스 연결에 문제가 발생할 수 있습니다!**

---

## 📊 상세 비교

| 설정 항목 | 프론트엔드 | 백엔드 | 일치 여부 |
|-----------|-----------|--------|----------|
| **Project ID** | `urteam-live-commerce` | `urteam-live-commerce-5b284` | ❌ **불일치** |
| API Key | AIzaSyA8Lsr... | - | ✅ |
| Auth Domain | urteam-live-commerce.firebaseapp.com | - | ⚠️ 확인 필요 |
| Database URL | urteam-live-commerce-default... | - | ⚠️ 확인 필요 |
| Storage Bucket | urteam-live-commerce.firebasestorage.app | - | ⚠️ 확인 필요 |
| Client Email | - | firebase-adminsdk-fbsvc@urteam-live-commerce-5b284... | ⚠️ -5b284 포함 |

---

## 🔍 Firebase Console에서 확인 필요

### 올바른 프로젝트 찾기

Firebase Console로 이동하여 **실제 프로젝트 ID**를 확인해야 합니다:

**Option 1**: https://console.firebase.google.com/project/urteam-live-commerce  
**Option 2**: https://console.firebase.google.com/project/urteam-live-commerce-5b284

둘 중 하나만 존재하거나, 둘 다 존재하면 어느 것이 실제 사용 중인지 확인 필요!

---

## 🎯 확인 체크리스트

1. **Firebase Console 접속**
   - https://console.firebase.google.com/

2. **프로젝트 목록에서 확인**
   - `urteam-live-commerce` 존재 여부 확인
   - `urteam-live-commerce-5b284` 존재 여부 확인

3. **올바른 프로젝트 선택 후 확인**
   - Project settings (톱니바퀴 아이콘)
   - General 탭
   - **Project ID** 확인 (복사)
   - **Web API Key** 확인

4. **Realtime Database URL 확인**
   - Realtime Database 섹션
   - 데이터베이스 URL 복사
   - 예: `https://urteam-live-commerce-???-default-rtdb...`

5. **Service Account 확인**
   - Project settings → Service accounts
   - "Generate new private key" 클릭
   - 다운로드한 JSON의 `project_id` 확인

---

## ✅ 수정 방법

### Case 1: 프로젝트 ID가 `urteam-live-commerce-5b284`인 경우

**프론트엔드 설정 수정 필요:**
```javascript
const firebaseConfig = {
  projectId: "urteam-live-commerce-5b284",  // ✅ -5b284 추가
  // ... 나머지 동일
};
```

**환경 변수도 수정:**
```env
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
```

### Case 2: 프로젝트 ID가 `urteam-live-commerce`인 경우

**Service Account를 다시 생성해야 함:**
1. Firebase Console → `urteam-live-commerce` 프로젝트
2. Project settings → Service accounts
3. "Generate new private key" 클릭
4. 새 JSON 파일의 `project_id`가 `urteam-live-commerce`인지 확인

---

## 🚨 현재 추정

Service Account JSON의 다른 필드들을 보면:
```json
"client_email": "firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com"
"client_x509_cert_url": "...firebase-adminsdk-fbsvc%40urteam-live-commerce-5b284..."
```

**모두 `-5b284`를 포함하고 있으므로:**

**✅ 올바른 프로젝트 ID는 `urteam-live-commerce-5b284`일 가능성이 높습니다!**

---

## 🔧 즉시 수정 (추천)

### 1️⃣ 로컬 .env 파일 수정
```bash
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
```

### 2️⃣ Cloudflare 환경 변수 수정
```
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
```

### 3️⃣ GitHub Actions 워크플로우 수정
```yaml
VITE_FIREBASE_PROJECT_ID: urteam-live-commerce-5b284
```

### 4️⃣ 재배포
```bash
npm run build
npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
```

---

## 🔗 Quick Links

- **Firebase Console**: https://console.firebase.google.com/
- **프로젝트 (추정)**: https://console.firebase.google.com/project/urteam-live-commerce-5b284
- **Cloudflare Dashboard**: https://dash.cloudflare.com/

---

**⏰ 우선순위: 최고 (즉시 수정 필요)**

**작성일**: 2026-03-18 08:40  
**프로젝트**: ur-live  
**상태**: 🚨 긴급 수정 필요
