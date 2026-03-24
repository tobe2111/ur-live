# 🔄 ur-live → ur-live-working 환경변수 복사 가이드

## 상황 정리
- ❌ `ur-live`: 도메인 연결 안 됨
- ✅ `ur-live-working`: 도메인 연결 가능
- 🎯 해결: `ur-live`의 환경변수를 `ur-live-working`으로 복사

---

## 📋 복사할 환경변수 목록

### 1. Frontend 환경변수 (VITE_*) - 15개

#### Firebase (프론트엔드)
```
Variable name: VITE_FIREBASE_API_KEY
Value: AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8
Type: Plain text
```

```
Variable name: VITE_FIREBASE_AUTH_DOMAIN
Value: urteam-live-commerce-5b284.firebaseapp.com
Type: Plain text
```

```
Variable name: VITE_FIREBASE_PROJECT_ID
Value: urteam-live-commerce-5b284
Type: Plain text
```

```
Variable name: VITE_FIREBASE_STORAGE_BUCKET
Value: urteam-live-commerce-5b284.firebasestorage.app
Type: Plain text
```

```
Variable name: VITE_FIREBASE_MESSAGING_SENDER_ID
Value: 352937066044
Type: Plain text
```

```
Variable name: VITE_FIREBASE_APP_ID
Value: 1:352937066044:web:e5bfd5e1d8f61688e30d39
Type: Plain text
```

```
Variable name: VITE_FIREBASE_MEASUREMENT_ID
Value: G-TEST123456
Type: Plain text
```

```
Variable name: VITE_FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
Type: Plain text
```

#### Kakao (프론트엔드)
```
Variable name: VITE_KAKAO_REST_API_KEY
Value: 5dd74bccb797640b0efd070467f3bafd
Type: Plain text
```

```
Variable name: VITE_KAKAO_JAVASCRIPT_KEY
Value: 975a2e7f97254b08f15dba4d177a2865
Type: Plain text
```

```
Variable name: VITE_KAKAO_AUTH_URL
Value: https://kauth.kakao.com
Type: Plain text
```

#### Toss Payments (프론트엔드)
```
Variable name: VITE_TOSS_CLIENT_KEY
Value: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
Type: Plain text
```

#### 기타 설정
```
Variable name: VITE_REGION
Value: KR
Type: Plain text
```

```
Variable name: VITE_DEFAULT_LANGUAGE
Value: ko
Type: Plain text
```

```
Variable name: VITE_API_BASE_URL
Value: https://live.ur-team.com
Type: Plain text
```

---

### 2. Backend 환경변수 (Worker용) - 5개 🔴 중요!

⚠️ **주의**: 이 환경변수들은 `ur-live` Cloudflare Dashboard에서 확인해야 합니다!

#### Firebase Admin SDK
```
Variable name: FIREBASE_PROJECT_ID
Value: urteam-live-commerce-5b284
Type: Plain text
```

```
Variable name: FIREBASE_PRIVATE_KEY
Value: [ur-live 프로젝트에서 복사 필요 - Encrypted로 표시됨]
Type: Encrypt (⚠️ 중요)
```

```
Variable name: FIREBASE_CLIENT_EMAIL
Value: [ur-live 프로젝트에서 복사 필요]
Type: Plain text
```

```
Variable name: FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
Type: Plain text
```

#### Kakao OAuth
```
Variable name: KAKAO_REST_API_KEY
Value: 5dd74bccb797640b0efd070467f3bafd
Type: Encrypt (권장)
```

---

## 🎯 복사 작업 순서 (15분)

### Step 1: ur-live에서 환경변수 확인 (5분)

1. https://dash.cloudflare.com/ 로그인
2. **Workers & Pages** 메뉴
3. **ur-live** 프로젝트 선택
4. **Settings** → **Environment variables** → **Production** 탭

#### 확인할 변수들:
- ✅ VITE_* (15개) - 위 목록과 동일한지 확인
- 🔴 **FIREBASE_PRIVATE_KEY** - 값 복사 (Encrypted, 펼쳐서 복사)
- 🔴 **FIREBASE_CLIENT_EMAIL** - 값 복사

⚠️ **중요**: `FIREBASE_PRIVATE_KEY`는 Encrypted로 표시되어 있을 수 있습니다.
- 우측 ··· 메뉴 → **Edit** 클릭
- 값 표시 → 복사
- 또는 새로 Firebase Console에서 다운로드

---

### Step 2: ur-live-working에 환경변수 추가 (10분)

1. **Workers & Pages** → **ur-live-working** 선택
2. **Settings** → **Environment variables** → **Production** 탭
3. **Add variable** 버튼 클릭

#### 변수 추가 순서:

**Frontend 변수 (15개)** - 위 목록 순서대로:
1. VITE_FIREBASE_API_KEY
2. VITE_FIREBASE_AUTH_DOMAIN
3. VITE_FIREBASE_PROJECT_ID
4. VITE_FIREBASE_STORAGE_BUCKET
5. VITE_FIREBASE_MESSAGING_SENDER_ID
6. VITE_FIREBASE_APP_ID
7. VITE_FIREBASE_MEASUREMENT_ID
8. VITE_FIREBASE_DATABASE_URL
9. VITE_KAKAO_REST_API_KEY
10. VITE_KAKAO_JAVASCRIPT_KEY
11. VITE_KAKAO_AUTH_URL
12. VITE_TOSS_CLIENT_KEY
13. VITE_REGION
14. VITE_DEFAULT_LANGUAGE
15. VITE_API_BASE_URL

**Backend 변수 (5개)** - 🔴 로그인 필수:
1. FIREBASE_PROJECT_ID (Plain text)
2. FIREBASE_PRIVATE_KEY (Encrypt 권장)
3. FIREBASE_CLIENT_EMAIL (Plain text)
4. FIREBASE_DATABASE_URL (Plain text)
5. KAKAO_REST_API_KEY (Encrypt 권장)

---

### Step 3: 재배포 (3분)

#### 방법 A: Cloudflare Dashboard
```
Workers & Pages → ur-live-working
→ Deployments 탭
→ 최신 deployment 우측 ··· 메뉴
→ "Retry deployment"
```

#### 방법 B: Git push (이미 완료)
```bash
# 이미 push됨, 자동 배포 중
git log -1 --oneline
# c7b1c791 docs: Add custom domain conflict resolution guide
```

---

### Step 4: Custom Domain 확인

```
Workers & Pages → ur-live-working
→ Custom domains 탭
→ live.ur-team.com이 연결되어 있는지 확인
```

---

## 🔍 FIREBASE_PRIVATE_KEY 확인 방법

### 옵션 A: ur-live에서 복사 (권장)

1. Workers & Pages → **ur-live**
2. Settings → Environment variables → Production
3. **FIREBASE_PRIVATE_KEY** 찾기
4. 우측 ··· 메뉴 → **Edit**
5. 값 표시 → 전체 선택 → 복사

**형식 확인**:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkq...
...
-----END PRIVATE KEY-----
```

---

### 옵션 B: Firebase Console에서 새로 다운로드

1. https://console.firebase.google.com/
2. **urteam-live-commerce-5b284** 프로젝트
3. ⚙️ Project settings → **Service accounts** 탭
4. **Generate new private key** 버튼
5. JSON 파일 다운로드
6. JSON 파일 열기 → `"private_key"` 값 복사

---

## ⚠️ 주의사항

### Private Key 복사 시
- ✅ `-----BEGIN PRIVATE KEY-----` 포함
- ✅ `-----END PRIVATE KEY-----` 포함
- ✅ `\n` (개행문자) 포함
- ❌ 따옴표(`"`) 제외

### Encrypted 변수
- FIREBASE_PRIVATE_KEY: Encrypt 권장
- KAKAO_REST_API_KEY: Encrypt 권장
- 나머지: Plain text

---

## 📊 환경변수 체크리스트

### ur-live-working에 추가할 변수 (총 20개)

| 카테고리 | 변수 수 | 상태 |
|---------|--------|------|
| VITE_FIREBASE_* | 8 | ⏳ 추가 필요 |
| VITE_KAKAO_* | 3 | ⏳ 추가 필요 |
| VITE_TOSS_* | 1 | ⏳ 추가 필요 |
| VITE_* (기타) | 3 | ⏳ 추가 필요 |
| FIREBASE_* (Worker) | 4 | 🔴 중요 |
| KAKAO_* (Worker) | 1 | 🔴 중요 |
| **합계** | **20** | |

---

## 🧪 검증 방법

### 1. 환경변수 개수 확인
```
ur-live-working → Settings → Environment variables
→ Production 탭
→ 변수 20개 있는지 확인
```

### 2. 배포 후 로그인 테스트
```
https://live.ur-team.com/login
→ 카카오 로그인 클릭
→ OAuth 인증
→ 프로필 페이지 이동 확인
```

### 3. 에러 확인
```
브라우저 콘솔 (F12)
→ Console 탭
→ Firebase 에러 없는지 확인
```

---

## 🎯 예상 결과

### Before
```
❌ ur-live-working: 환경변수 없음
❌ 로그인: 500 error
❌ 채팅: WebSocket blocked
```

### After
```
✅ ur-live-working: 환경변수 20개 설정
✅ 로그인: 정상 작동
✅ 채팅: WebSocket 연결 (VITE_FIREBASE_DATABASE_URL)
```

---

## 🔗 빠른 링크

- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **ur-live 프로젝트**: https://dash.cloudflare.com/ (Workers & Pages → ur-live)
- **ur-live-working 프로젝트**: https://dash.cloudflare.com/ (Workers & Pages → ur-live-working)
- **Firebase Console**: https://console.firebase.google.com/

---

**작성일**: 2026-03-17  
**예상 소요 시간**: 15분 (확인 5분 + 추가 10분)  
**우선순위**: 🔴 Critical (로그인 차단)
