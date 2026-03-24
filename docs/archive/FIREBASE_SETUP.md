# Firebase 설정 가이드

## 🔥 Firebase 프로젝트 설정

### 1단계: Firebase Console에서 프로젝트 생성

1. **Firebase Console 접속**
   - https://console.firebase.google.com
   - Google 계정으로 로그인

2. **프로젝트 추가**
   ```
   - "프로젝트 추가" 클릭
   - 프로젝트 이름: "toss-live-commerce"
   - Google 애널리틱스: 사용 안 함 (선택 사항)
   - "프로젝트 만들기" 클릭
   ```

### 2단계: Realtime Database 생성

1. **데이터베이스 생성**
   ```
   - 좌측 메뉴: Build → Realtime Database
   - "데이터베이스 만들기" 클릭
   - 위치: asia-southeast1 (싱가포르) - 한국에 가장 가까움
   - 보안 규칙: "잠금 모드로 시작" 선택
   - "사용 설정" 클릭
   ```

2. **보안 규칙 설정**
   ```
   - Realtime Database → 규칙 탭
   - firebase-database-rules.json 파일 내용 복사
   - "게시" 클릭
   ```

### 3단계: 웹 앱 등록

1. **웹 앱 추가**
   ```
   - 프로젝트 설정 (⚙️) → 일반 탭
   - "앱 추가" → 웹 (</>) 클릭
   - 앱 닉네임: "webapp"
   - Firebase 호스팅: 사용 안 함
   - "앱 등록" 클릭
   ```

2. **구성 정보 복사**
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "toss-live-commerce.firebaseapp.com",
     databaseURL: "https://toss-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app",
     projectId: "toss-live-commerce",
     storageBucket: "toss-live-commerce.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

### 4단계: 프로젝트 설정 파일 업데이트

1. **firebase-config.js 수정**
   ```bash
   # 파일 위치
   public/static/firebase-config.js
   
   # firebaseConfig 객체를 위에서 복사한 값으로 교체
   ```

2. **빌드 및 재시작**
   ```bash
   npm run build
   pm2 restart webapp
   
   # 또는 프로덕션 배포
   npm run deploy:prod
   ```

## 💰 비용 최적화 전략

### Firebase 무료 플랜 할당량
- **동시 접속**: 100명
- **데이터 다운로드**: 10GB/월
- **저장 용량**: 1GB
- **읽기 작업**: 무제한
- **쓰기 작업**: 무제한

### 최적화 구현 사항
1. ✅ 최신 50개 메시지만 유지
2. ✅ 5분마다 오래된 메시지 자동 삭제
3. ✅ 클라이언트에서도 50개 초과 시 삭제
4. ✅ 휘발성 데이터 (영구 저장 안 함)

### 예상 비용
- **시청자 100명 이하**: 완전 무료 ($0)
- **시청자 1,000명**: 월 $5-10 예상
- **시청자 10,000명**: 월 $50-100 예상

## 🔒 보안 규칙 설명

### 현재 규칙
```json
{
  "rules": {
    "chats": {
      "$streamId": {
        ".read": true,              // 누구나 읽기 가능
        ".write": "auth != null",   // 인증된 사용자만 쓰기 가능
        // 메시지 구조 및 길이 검증
      }
    }
  }
}
```

### 보안 강화 옵션 (향후)
```json
{
  "rules": {
    "chats": {
      "$streamId": {
        ".read": true,
        ".write": "auth != null && 
                   !data.exists() &&              // 새 메시지만
                   newData.child('username').val() === auth.uid",  // 본인 이름만
        // 스팸 방지: 같은 유저가 1초 내 중복 메시지 금지
      }
    }
  }
}
```

## 🧪 테스트 방법

### 로컬 테스트
```bash
# 개발 서버 시작
pm2 start ecosystem.config.cjs

# 브라우저에서 접속
https://3000-idza9aonokj4y1prq2vkt-b32ec7bb.sandbox.novita.ai/live/1

# 채팅 메시지 전송 테스트
# - 입력창에 메시지 입력
# - 전송 버튼 클릭 또는 엔터
# - 채팅창에 메시지 표시 확인
```

### Firebase Console에서 확인
```
1. Firebase Console → Realtime Database → 데이터 탭
2. chats → stream1 경로 확인
3. 메시지가 실시간으로 추가되는지 확인
4. 50개 초과 시 자동 삭제 확인 (5분 후)
```

## 🚀 프로덕션 배포

### Cloudflare Pages 배포
```bash
# 빌드
npm run build

# 프로덕션 배포
npx wrangler pages deploy dist --project-name toss-live-commerce

# 배포 URL 확인
https://toss-live-commerce.pages.dev/live/1
```

### 환경 변수 설정 (선택)
```bash
# Firebase API Key를 환경 변수로 관리 (보안 강화)
npx wrangler pages secret put FIREBASE_API_KEY --project-name toss-live-commerce

# 입력: Firebase API Key 값
```

## 📊 모니터링

### Firebase Console
- Realtime Database → 사용량 탭
- 다운로드, 저장 용량, 동시 접속자 확인

### Cloudflare Analytics
- Workers & Pages → toss-live-commerce → 분석
- 요청 수, 응답 시간, 에러율 확인

## ⚠️ 주의사항

1. **보안 규칙 확인**
   - 테스트 모드 (`".write": true`)는 프로덕션에서 절대 사용 금지
   - 반드시 인증 규칙 적용

2. **비용 모니터링**
   - Firebase Console에서 주기적으로 사용량 확인
   - 할당량 초과 시 알림 설정

3. **메시지 길이 제한**
   - 최대 200자로 제한
   - 스팸 메시지 방지

4. **Rate Limiting**
   - 향후 같은 유저의 빠른 연속 메시지 차단 고려

## 🔗 참고 링크

- Firebase Realtime Database 문서: https://firebase.google.com/docs/database
- Firebase 보안 규칙: https://firebase.google.com/docs/database/security
- 토스페이먼츠 API: https://docs.tosspayments.com
- Cloudflare Pages: https://developers.cloudflare.com/pages
