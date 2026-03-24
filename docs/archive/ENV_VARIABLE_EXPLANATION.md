# 🔑 환경변수 이름 차이 설명 (VITE_ 있음 vs 없음)

## ❓ "기존에는 VITE_ 가 붙었는데 상관없는거야?"

### ✅ 네, **둘 다 필요합니다!** (상관 있습니다)

---

## 🎯 핵심 개념

### 환경변수 2가지 종류가 있습니다:

| 종류 | 이름 형식 | 사용 위치 | 실행 시점 |
|-----|----------|----------|----------|
| **프론트엔드** | `VITE_*` | 브라우저 (React) | **빌드 시** |
| **백엔드** | `VITE_ 없음` | Worker (Cloudflare) | **런타임** |

---

## 📋 예시: Firebase 환경변수

### 프론트엔드용 (VITE_ 있음)
```bash
# 브라우저에서 Firebase 사용
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
VITE_FIREBASE_API_KEY=AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8
VITE_FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb...
```

**사용 위치**: 
- `src/lib/firebase-config.ts` (프론트엔드)
- 브라우저 JavaScript 코드에 **빌드 시 직접 삽입됨**

**역할**:
- 브라우저에서 Firebase 실시간 채팅
- 사용자 인증 상태 확인
- 클라이언트 측 Firebase 작업

---

### 백엔드용 (VITE_ 없음)
```bash
# Worker에서 Firebase Admin SDK 사용
FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb...
```

**사용 위치**:
- `src/lib/firebase-admin.ts` (백엔드)
- Cloudflare Worker 런타임 환경

**역할**:
- **Firebase Custom Token 생성** (로그인용)
- 서버 측 인증 작업
- Admin 권한이 필요한 작업

---

## 🔍 코드로 확인

### 프론트엔드 (src/lib/firebase-config.ts)
```typescript
// ✅ VITE_ 붙은 환경변수 사용
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,        // VITE_ 있음
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, // VITE_ 있음
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL, // VITE_ 있음
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,   // VITE_ 있음
}
```

### 백엔드 (src/lib/firebase-admin.ts)
```typescript
// ✅ VITE_ 없는 환경변수 사용
constructor(env: Env) {
  this.projectId = env.FIREBASE_PROJECT_ID      // VITE_ 없음!
  this.privateKey = env.FIREBASE_PRIVATE_KEY     // VITE_ 없음!
  this.clientEmail = env.FIREBASE_CLIENT_EMAIL   // VITE_ 없음!
  this.databaseURL = env.FIREBASE_DATABASE_URL   // VITE_ 없음!
}
```

---

## ⚠️ 왜 2가지가 필요한가?

### 이유 1: 실행 환경이 다름
- **프론트엔드**: 브라우저 (사용자의 PC/모바일)
- **백엔드**: Cloudflare Worker (서버)

### 이유 2: 실행 시점이 다름
- **VITE_ 환경변수**: **빌드 시** 코드에 직접 삽입
- **Worker 환경변수**: **런타임** 동적으로 읽음

### 이유 3: 보안 수준이 다름
- **VITE_ 환경변수**: 브라우저에 노출됨 (Public)
- **Worker 환경변수**: 서버에만 존재 (Private)

---

## 🚨 현재 문제 상황

### ✅ 이미 설정된 것 (프론트엔드)
```
VITE_FIREBASE_PROJECT_ID      ✅ 설정됨
VITE_FIREBASE_API_KEY          ✅ 설정됨
VITE_FIREBASE_DATABASE_URL     ✅ 설정됨
...
```

**결과**: 
- 브라우저에서 Firebase 사용 가능
- 채팅 UI 작동 (환경변수 추가 후)

---

### ❌ 누락된 것 (백엔드)
```
FIREBASE_PROJECT_ID      ❌ 없음 → 로그인 실패!
FIREBASE_PRIVATE_KEY     ❌ 없음 → Custom Token 생성 실패!
FIREBASE_CLIENT_EMAIL    ❌ 없음 → 인증 실패!
...
```

**결과**:
- Kakao 로그인 500 error
- "Firebase custom token creation failed"

---

## 📊 전체 구조

```
사용자 → 브라우저 → 프론트엔드 (VITE_ 환경변수)
          ↓
       카카오 로그인
          ↓
      Worker (VITE_ 없는 환경변수) ← 여기서 에러!
          ↓
    Firebase Custom Token 생성
          ↓
       브라우저로 반환
```

---

## 🎯 해결 방법

### 이미 설정된 것 (Cloudflare Pages Build settings)
```
✅ VITE_FIREBASE_PROJECT_ID
✅ VITE_FIREBASE_API_KEY
✅ VITE_FIREBASE_DATABASE_URL
✅ VITE_KAKAO_REST_API_KEY
... (총 14개)
```

### 추가로 설정해야 할 것 (Cloudflare Pages Environment variables)
```
❌ FIREBASE_PROJECT_ID       (VITE_ 없음!)
❌ FIREBASE_PRIVATE_KEY      (VITE_ 없음!)
❌ FIREBASE_CLIENT_EMAIL     (VITE_ 없음!)
❌ FIREBASE_DATABASE_URL     (VITE_ 없음!)
❌ KAKAO_REST_API_KEY        (VITE_ 없음!)
```

---

## 💡 왜 같은 값이 2번 필요한가?

### 예: FIREBASE_PROJECT_ID

#### VITE_FIREBASE_PROJECT_ID (프론트엔드)
```typescript
// 브라우저 코드 (빌드 시 삽입)
const projectId = "urteam-live-commerce-5b284"; // ← 하드코딩됨
```

#### FIREBASE_PROJECT_ID (백엔드)
```typescript
// Worker 코드 (런타임 읽기)
const projectId = c.env.FIREBASE_PROJECT_ID; // ← 런타임에서 읽음
```

**결론**: 
- 같은 값이지만 **다른 환경에서 사용**
- 둘 다 필요함!

---

## ✅ 체크리스트

### Cloudflare Dashboard → Workers & Pages → [프로젝트] → Settings

#### 1. Environment variables → Production (Worker용)
```
□ FIREBASE_PROJECT_ID         (VITE_ 없음)
□ FIREBASE_PRIVATE_KEY        (VITE_ 없음)
□ FIREBASE_CLIENT_EMAIL       (VITE_ 없음)
□ FIREBASE_DATABASE_URL       (VITE_ 없음)
□ KAKAO_REST_API_KEY          (VITE_ 없음)
```

#### 2. Settings → Builds → Environment variables (프론트엔드용)
```
☑ VITE_FIREBASE_PROJECT_ID    (VITE_ 있음) - 이미 설정됨
☑ VITE_FIREBASE_API_KEY       (VITE_ 있음) - 이미 설정됨
☑ VITE_FIREBASE_DATABASE_URL  (VITE_ 있음) - 이미 설정됨
...
```

---

## 🎯 정리

**"기존에는 VITE_ 가 붙었는데 상관없는거야?"**

→ ❌ **상관 있습니다!** 둘 다 필요합니다.

**이유**:
- `VITE_*`: 프론트엔드(브라우저)용 - ✅ 이미 설정됨
- `VITE_ 없음`: 백엔드(Worker)용 - ❌ 아직 없음 (로그인 차단 원인)

**해결**:
- VITE_ 없는 환경변수 5개를 Cloudflare에 추가
- 위치: Workers & Pages → [프로젝트] → Settings → Environment variables → Production

---

**참고 문서**: `WORKER_ENV_CHECKLIST.md`  
**GitHub**: https://github.com/tobe2111/ur-live/commit/c7e41ff1
