# 🔑 당신의 Firebase Database Secret 처리

## 제공하신 정보
```
TZCaYrnLMUUHI9R7DwmOB9ULFfTjF7lI141vkUDe
```

이것은 **Firebase Realtime Database Secret**입니다.

---

## ⚠️ 중요: 이것만으로는 부족합니다!

Firebase Admin SDK를 사용하려면 **4가지 환경변수가 모두 필요**합니다:

### 필요한 환경변수:

1. **FIREBASE_PROJECT_ID**
   - 예: `urteam-live-commerce-5b284`
   - 출처: Firebase Console → 프로젝트 설정

2. **FIREBASE_CLIENT_EMAIL**
   - 예: `firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com`
   - 출처: Firebase Console → 서비스 계정 → Firebase Admin SDK JSON

3. **FIREBASE_PRIVATE_KEY**
   - 예: `-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----`
   - 출처: Firebase Console → 서비스 계정 → "새 비공개 키 생성"

4. **FIREBASE_DATABASE_URL**
   - 예: `https://urteam-live-commerce-5b284-default-rtdb.firebaseio.com`
   - 출처: Firebase Console → Realtime Database

---

## ✅ Firebase Database Secret 설정 방법

### Cloudflare Pages에서 설정:

```bash
cd /home/user/webapp

# Database URL 설정 (Secret 포함)
npx wrangler pages secret put FIREBASE_DATABASE_URL --project-name ur-live
# 입력: https://urteam-live-commerce-5b284-default-rtdb.firebaseio.com?auth=TZCaYrnLMUUHI9R7DwmOB9ULFfTjF7lI141vkUDe

# 또는 Secret 없이 (Admin SDK는 자체 인증 사용)
npx wrangler pages secret put FIREBASE_DATABASE_URL --project-name ur-live
# 입력: https://urteam-live-commerce-5b284-default-rtdb.firebaseio.com
```

### .env 파일 (로컬 개발):

```env
# Firebase Realtime Database
FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb.firebaseio.com

# 또는 Secret 포함 (선택)
FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb.firebaseio.com?auth=TZCaYrnLMUUHI9R7DwmOB9ULFfTjF7lI141vkUDe
```

---

## 🚨 나머지 환경변수를 반드시 설정하세요!

### Firebase Console에서 Service Account JSON 다운로드:

1. **Firebase Console 접속**
   ```
   https://console.firebase.google.com/project/urteam-live-commerce-5b284/settings/serviceaccounts/adminsdk
   ```

2. **"새 비공개 키 생성" 클릭**

3. **JSON 파일 다운로드**

4. **JSON 내용 확인**:
   ```json
   {
     "type": "service_account",
     "project_id": "urteam-live-commerce-5b284",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com"
   }
   ```

5. **Cloudflare Pages에 설정**:
   ```bash
   npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live
   # 입력: urteam-live-commerce-5b284

   npx wrangler pages secret put FIREBASE_CLIENT_EMAIL --project-name ur-live
   # 입력: firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com

   npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live
   # 입력: (JSON의 private_key 값 복사)
   ```

---

## 🧪 빠른 테스트

환경변수가 모두 설정되었는지 확인:

```bash
cd /home/user/webapp
./check_firebase_env.sh
```

---

## 📝 요약

1. **Database Secret (`TZCaYrnLMUUHI9R7DwmOB9ULFfTjF7lI141vkUDe`)는 받았습니다 ✅**

2. **하지만 아직 필요한 것들**:
   - ❌ FIREBASE_PROJECT_ID
   - ❌ FIREBASE_CLIENT_EMAIL
   - ❌ FIREBASE_PRIVATE_KEY

3. **다음 단계**:
   - Firebase Console → 서비스 계정 → JSON 다운로드
   - Cloudflare Pages에 3가지 환경변수 추가 설정

**이것들을 모두 설정해야 무한 루프가 해결됩니다!** 🔥
