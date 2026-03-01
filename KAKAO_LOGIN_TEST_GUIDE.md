# 카카오 로그인 테스트 가이드 🧪

## 빠른 테스트 (5분)

### 1. 캐시 삭제 (필수!)
```javascript
// Chrome 개발자도구 Console (F12)에서 실행:
localStorage.clear()
sessionStorage.clear()
location.reload(true)
```

### 2. 로그인 테스트
1. 브라우저에서 https://live.ur-team.com/login 접속
2. "카카오 로그인" 버튼 클릭
3. 카카오 계정 인증
4. 자동으로 홈 또는 프로필 페이지로 이동 (무한 루프 ❌)

### 3. 성공 확인
```javascript
// F12 Console에서 확인:
localStorage.getItem('user_id')        // "123" (숫자)
localStorage.getItem('user_name')      // "사용자이름"
localStorage.getItem('firebase_token') // "eyJhbGci..."
localStorage.getItem('user_type')      // "user"
```

## 예상 콘솔 로그

### ✅ 정상 로그인 플로우
```javascript
[Firebase 초기화] ✅ Firebase 초기화 완료
[Firebase Auth 초기화] ✅ Firebase Auth 초기화 완료
[Firebase Database 초기화] ✅ Firebase Database 초기화 완료

[AuthContext] 🔑 카카오 로그인 시도
[AuthContext] ✅ 카카오 Custom Token 수신: { id: 123, name: "...", ... }
[AuthContext] ✅ 카카오 Firebase 로그인 성공: kakao_4735311250

[AuthContext] 🔄 onAuthStateChanged 트리거
[AuthContext] ✅ D1 동기화 완료 + localStorage 저장: { userId: 123, userName: "..." }
[AuthContext] ✅ 로그인 상태 확정: { uid: "kakao_4735311250", role: "user" }
```

### ❌ 에러 시나리오

#### 1. D1 Sync 실패
```javascript
[AuthContext] ❌ D1 동기화 실패: { ... }
→ 원인: Firebase token 검증 실패, Rate limit, 네트워크 에러
→ 조치: 콘솔 로그 확인 후 재시도
```

#### 2. localStorage 저장 실패
```javascript
localStorage.getItem('user_id')  // null
→ 원인: D1 sync 응답에 user 데이터 없음
→ 조치: 백엔드 로그 확인 (/api/auth/firebase/sync)
```

## 디버깅 체크리스트

### 프론트엔드 (브라우저)
- [ ] `localStorage.clear()` 실행 완료
- [ ] 콘솔에 Firebase 초기화 로그 3개 확인
- [ ] `[AuthContext] ✅ D1 동기화 완료 + localStorage 저장` 로그 확인
- [ ] `localStorage.getItem('user_id')` 값 존재 확인
- [ ] URL에 `error=` 파라미터 없음 확인

### 백엔드 (Cloudflare Workers)
- [ ] Firebase 환경변수 4개 모두 설정됨 (`/api/test/env`)
- [ ] D1 데이터베이스 연결 정상
- [ ] `/api/auth/firebase/sync` 엔드포인트 정상 응답

## 트러블슈팅

### 문제: 여전히 무한 루프 발생
**원인**: 캐시가 남아있거나 localStorage에 저장 안 됨  
**해결**:
```javascript
// 1. 완전 캐시 삭제
localStorage.clear()
sessionStorage.clear()

// 2. 하드 리프레시
// Chrome: Ctrl + Shift + Delete → "캐시된 이미지 및 파일" 삭제

// 3. 시크릿 모드 테스트
// Chrome: Ctrl + Shift + N
```

### 문제: user_id가 null
**원인**: D1 sync 실패 또는 응답 구조 변경  
**해결**:
```javascript
// 1. D1 sync 재시도
localStorage.removeItem('last_sync_kakao_4735311250')
location.reload()

// 2. 수동 확인
fetch('https://live.ur-team.com/api/test/env')
  .then(r => r.json())
  .then(d => console.log(d.summary))
```

### 문제: Firebase token 검증 실패
**원인**: Firebase 환경변수 누락  
**해결**:
```bash
# 환경변수 확인
curl https://live.ur-team.com/api/test/env | jq '.results[] | select(.name | startswith("FIREBASE"))'

# 모두 "status": "pass" 여야 함
```

## API 엔드포인트 테스트

### 1. Firebase Sync Endpoint
```bash
# 수동 테스트 (idToken 필요)
curl -X POST https://live.ur-team.com/api/auth/firebase/sync \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "YOUR_FIREBASE_TOKEN",
    "firebaseUid": "kakao_123456",
    "email": "test@example.com",
    "displayName": "테스트"
  }'

# 예상 응답:
{
  "success": true,
  "user": {
    "id": 123,
    "email": "test@example.com",
    "name": "테스트"
  }
}
```

### 2. Environment Check
```bash
curl https://live.ur-team.com/api/test/env | jq '.summary'

# 예상 결과:
{
  "total": 9,
  "pass": 9,    # 모두 pass 여야 함
  "warn": 0,
  "fail": 0
}
```

## 성공 기준

### ✅ 테스트 통과 조건
1. 카카오 로그인 후 무한 루프 없음
2. `/user/profile` 페이지 정상 표시
3. `localStorage.getItem('user_id')` 값 존재
4. 콘솔에 에러 로그 없음
5. URL에 `error=` 파라미터 없음

### ⚠️ 추가 검증 (선택)
```javascript
// 로그인 상태 확인
console.log({
  userId: localStorage.getItem('user_id'),
  userName: localStorage.getItem('user_name'),
  firebaseToken: localStorage.getItem('firebase_token')?.slice(0, 20) + '...',
  userType: localStorage.getItem('user_type')
})

// Firebase Auth 상태 확인
import { getAuth } from 'firebase/auth'
import { app } from '@/lib/firebase'
const auth = getAuth(app)
console.log('Firebase User:', auth.currentUser?.uid)
```

## 배포 정보

- **프로덕션 URL**: https://live.ur-team.com
- **최신 커밋**: cf76f47
- **빌드 시간**: 2026-03-01T14:44:38.349Z
- **상태**: ✅ 배포 완료, 테스트 준비됨

---

**테스트 완료 후**: 결과를 공유해주세요!
- ✅ 성공: 스크린샷 + 콘솔 로그
- ❌ 실패: 에러 메시지 + `localStorage` 값 + URL
