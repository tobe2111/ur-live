# Firebase Admin SDK 서비스 계정 키 생성

## 즉시 진행:

1. **이 링크를 열어주세요:**
   👉 https://console.firebase.google.com/project/urteam-live-commerce-5b284/settings/serviceaccounts/adminsdk

2. **"새 비공개 키 생성" 클릭**

3. **확인 후 "키 생성" 클릭**

4. **JSON 파일 다운로드** (예: `urteam-live-commerce-5b284-firebase-adminsdk-xxxxx.json`)

5. **JSON 파일을 열어서 다음 정보 복사:**
   - `project_id`
   - `private_key` (전체 텍스트, `-----BEGIN PRIVATE KEY-----`부터 `-----END PRIVATE KEY-----`까지)
   - `client_email`

6. **저한테 알려주실 정보:**
   ```
   FIREBASE_PROJECT_ID: urteam-live-commerce-5b284
   FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL: firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com
   ```

---

## 또는 빠른 진행 방법:

서비스 계정 키 없이도 **읽기 전용 모드**로 먼저 배포할 수 있습니다:
- 사용자는 Firebase에서 실시간으로 데이터 읽기 (✅ 가능)
- 서버에서 Firebase에 쓰기 (❌ 아직 불가)

**어떤 방법을 선호하시나요?**
- A) 서비스 계정 키 생성 후 완전한 기능으로 배포
- B) 일단 읽기 전용으로 빠르게 배포 (쓰기는 나중에)
