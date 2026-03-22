# Firebase Admin SDK 설정 가이드

## 🔑 Service Account Key 생성

Firebase Admin SDK를 서버에서 사용하려면 Service Account Key가 필요합니다.

### 1단계: Service Account Key 생성

1. **Firebase Console 열기:**
   👉 https://console.firebase.google.com/project/urteam-live-commerce-5b284/settings/serviceaccounts/adminsdk

2. **"새 비공개 키 생성" 클릭**

3. **확인 후 "키 생성" 클릭**

4. **JSON 파일 다운로드** (예: `urteam-live-commerce-5b284-firebase-adminsdk-xxxxx.json`)

---

## 📋 환경 변수 추가

다운로드한 JSON 파일을 열어서 다음 값을 복사:

### .dev.vars 파일에 추가:

```bash
# Firebase Admin SDK (서버 전용)
FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...(여기에 private_key 값 붙여넣기)...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com
```

⚠️ **주의**: 
- `FIREBASE_PRIVATE_KEY`는 따옴표로 감싸야 합니다
- `\n`은 그대로 유지하세요 (실제 줄바꿈이 아님)

---

## 🚀 Cloudflare Pages에 환경 변수 추가

```bash
# 로컬 개발용 (.dev.vars에 추가 완료)
# 위에서 이미 추가했습니다

# 프로덕션 배포용 (Cloudflare Pages Secrets)
npx wrangler pages secret put FIREBASE_PROJECT_ID
# 입력: urteam-live-commerce-5b284

npx wrangler pages secret put FIREBASE_PRIVATE_KEY
# 입력: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

npx wrangler pages secret put FIREBASE_CLIENT_EMAIL
# 입력: firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com
```

---

## ✅ 테스트

Service Account Key를 추가한 후:

1. 서버 재시작:
   ```bash
   pm2 restart webapp
   ```

2. API 테스트:
   ```bash
   curl http://localhost:3000/api/test-firebase
   ```

3. 성공 메시지:
   ```json
   {"success": true, "message": "Firebase Admin SDK initialized"}
   ```

---

## 📝 현재 상태

✅ Firebase Realtime Database 활성화 완료
✅ Database URL 설정 완료: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
✅ Frontend Firebase Config 완료
✅ useFirebaseStream Hook 생성 완료
⏳ Firebase Admin SDK 설정 대기 중 (Service Account Key 필요)
⏳ 보안 규칙 설정 확인 필요

---

## 🔥 다음 단계

1. **Service Account Key 생성** (위 링크)
2. **환경 변수 추가** (.dev.vars)
3. **보안 규칙 설정** (https://console.firebase.google.com/project/urteam-live-commerce-5b284/database/urteam-live-commerce-5b284-default-rtdb/rules)
4. **서버 재시작 및 테스트**
