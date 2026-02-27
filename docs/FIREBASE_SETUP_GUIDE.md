# Firebase 프로젝트 생성 및 설정 가이드

## 1단계: Firebase 프로젝트 생성

### 1.1 Firebase Console 접속
1. https://console.firebase.google.com 접속
2. Google 계정으로 로그인

### 1.2 새 프로젝트 생성
1. **"프로젝트 추가"** 또는 **"Add project"** 클릭
2. 프로젝트 이름 입력: `urteam-live-commerce` (또는 원하는 이름)
3. **계속** 클릭
4. Google Analytics 사용 여부 선택 (선택사항, 비활성화 권장)
5. **프로젝트 만들기** 클릭
6. 프로젝트 생성 완료 대기 (약 30초~1분)

---

## 2단계: Realtime Database 활성화

### 2.1 Realtime Database 생성
1. 왼쪽 메뉴에서 **"Realtime Database"** 클릭
2. **"데이터베이스 만들기"** 클릭
3. 데이터베이스 위치 선택: **asia-southeast1** (싱가포르 - 한국과 가장 가까움)
4. 보안 규칙 선택: **"잠금 모드로 시작"** (나중에 수정)
5. **사용 설정** 클릭

### 2.2 데이터베이스 URL 복사
- 생성된 데이터베이스 URL을 복사합니다
- 형식: `https://프로젝트이름-default-rtdb.asia-southeast1.firebasedatabase.app`
- 예시: `https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app`

---

## 3단계: Web API Key 가져오기

### 3.1 프로젝트 설정 열기
1. 왼쪽 상단 **톱니바퀴 아이콘** 클릭
2. **"프로젝트 설정"** 클릭

### 3.2 Web API Key 복사
1. **"일반"** 탭에서 **"웹 API 키"** 찾기
2. API 키 복사 (형식: `AIzaSy...`)

---

## 4단계: Firebase Admin SDK 설정

### 4.1 서비스 계정 키 생성
1. 프로젝트 설정에서 **"서비스 계정"** 탭 클릭
2. **"Firebase Admin SDK"** 섹션 찾기
3. **"새 비공개 키 생성"** 클릭
4. 확인 후 **"키 생성"** 클릭
5. JSON 파일 다운로드 (안전한 곳에 보관)

### 4.2 서비스 계정 키에서 필요한 정보 추출
다운로드한 JSON 파일을 열어서 다음 정보를 복사:
- `project_id`
- `private_key`
- `client_email`

---

## 5단계: 보안 규칙 설정

### 5.1 Realtime Database 규칙 설정
1. **Realtime Database** → **"규칙"** 탭 클릭
2. 다음 규칙 붙여넣기:

```json
{
  "rules": {
    "streams": {
      "$streamId": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "products": {
      "$productId": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "stream_products": {
      "$streamId": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "chats": {
      "$streamId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

3. **"게시"** 클릭

---

## 6단계: 환경 변수 설정

### 6.1 .dev.vars 파일 업데이트
프로젝트 루트의 `.dev.vars` 파일을 다음과 같이 업데이트:

```bash
# Firebase Configuration
FIREBASE_DATABASE_URL=https://[프로젝트이름]-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_API_KEY=AIzaSy...

# Firebase Admin SDK (서버 전용)
FIREBASE_PROJECT_ID=프로젝트ID
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@프로젝트ID.iam.gserviceaccount.com
```

### 6.2 Cloudflare Pages에 환경 변수 추가
```bash
# Firebase Database URL
npx wrangler pages secret put FIREBASE_DATABASE_URL

# Firebase API Key
npx wrangler pages secret put FIREBASE_API_KEY

# Firebase Admin SDK
npx wrangler pages secret put FIREBASE_PROJECT_ID
npx wrangler pages secret put FIREBASE_PRIVATE_KEY
npx wrangler pages secret put FIREBASE_CLIENT_EMAIL
```

---

## 7단계: 테스트

### 7.1 로컬 개발 서버 시작
```bash
cd /home/user/webapp
npm run build
pm2 restart webapp
```

### 7.2 Firebase 연결 테스트
1. https://localhost:3000/live/1 접속
2. 브라우저 개발자 도구 → Console 열기
3. Firebase 연결 로그 확인:
   - `✅ Firebase initialized successfully`
   - `✅ Firebase stream listener attached`

### 7.3 실시간 업데이트 테스트
1. 셀러 페이지에서 상품 변경
2. 라이브 페이지가 0.2초 이내에 업데이트되는지 확인

---

## 완료! 🎉

Firebase 설정이 완료되었습니다. 이제 다음 기능이 활성화됩니다:

✅ **실시간 재고 업데이트** (3초 → 0.2초)
✅ **실시간 상품 변경** (3초 → 0.2초)
✅ **자동 재연결** (네트워크 끊김 시)
✅ **90명 동시 접속 시 Discord 알림**
✅ **월 $0 비용** (무료 tier)

---

## 문제 해결

### Firebase 초기화 실패
- API 키와 Database URL이 정확한지 확인
- 브라우저 콘솔에서 에러 메시지 확인

### 데이터 쓰기 실패
- Firebase 보안 규칙이 올바르게 설정되었는지 확인
- 서버가 Admin SDK를 사용하는지 확인

### 연결 끊김
- 네트워크 상태 확인
- 자동 재연결 로직이 작동하는지 확인 (최대 3번 재시도)
