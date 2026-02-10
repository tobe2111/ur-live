# 카카오 로그인 문제 완전 해결 보고서

## ✅ 해결 완료 (2026-02-10)

### 📊 문제 발생 원인 분석

#### 1. **근본 원인: DB 스키마와 코드 불일치**
- **발생 시점**: 2026-02-09 (어제)
- **원인**: Service Terms 기능 추가 시도 중 DB 마이그레이션 없이 코드만 수정
- **결과**: 존재하지 않는 컬럼(`access_token`, `service_terms_agreed`, `terms_agreed_at`) UPDATE 시도 → SQLite 에러 → 500 Internal Server Error

#### 2. **문제 타임라인**

| 날짜 | 커밋 | 코드 상태 | DB 상태 | 결과 |
|------|------|----------|---------|------|
| 2026-02-06 | e681393 | 간단한 UPDATE (name, email, profile_image) | 기본 컬럼만 | ✅ 정상 작동 |
| 2026-02-09 | 41e62ed^ | 새 컬럼 추가 (access_token, service_terms_agreed) | 기본 컬럼만 | ❌ 500 에러 발생 |
| 2026-02-10 09:07 | 41e62ed | /auth/* 라우팅 추가 | 기본 컬럼만 | ❌ 404 해결, but 500 여전 |
| 2026-02-10 09:20 | 0694542 | 존재하지 않는 컬럼 제거 | 기본 컬럼만 | ✅ 500 해결 |
| 2026-02-10 09:32 | 741cfdb | 에러 로그 강화 + cart 체크 개선 | 기본 컬럼만 | ✅ 완전 해결 |

---

### 🔧 적용된 수정 사항

#### **Fix 1: 라우팅 문제 (41e62ed)**
```javascript
// _routes.json
{
  "version": 1,
  "include": [
    "/api/*",
    "/auth/*"  // ← 추가: Kakao callback 라우팅
  ],
  "exclude": ["/static/*"]
}
```

#### **Fix 2: DB 컬럼 문제 (0694542)**
```typescript
// Before (❌ 에러 발생)
await DB.prepare(`
  UPDATE users 
  SET name = ?, email = ?, profile_image = ?,
      access_token = ?,              // ❌ 존재하지 않는 컬럼
      service_terms_agreed = ?,      // ❌ 존재하지 않는 컬럼
      terms_agreed_at = CURRENT_TIMESTAMP  // ❌ 존재하지 않는 컬럼
  WHERE id = ?
`).bind(nickname, email, profileImage, token, terms, userId).run();

// After (✅ 정상 작동)
await DB.prepare(`
  UPDATE users 
  SET name = ?, 
      email = ?, 
      profile_image = ?,
      updated_at = CURRENT_TIMESTAMP,
      last_login_at = CURRENT_TIMESTAMP
  WHERE id = ?
`).bind(nickname, email, profileImage, userId).run();
```

#### **Fix 3: Cart 검증 개선 (741cfdb)**
```typescript
// Before (❌ 잘못된 체크)
if (!response.data || response.data.length === 0) {
  // response.data = {success: true, data: []}
  // response.data.length === undefined
  // 조건 실패 → 빈 장바구니도 cart 페이지로 이동
}

// After (✅ 올바른 체크)
const cartData = response.data?.data || response.data
if (!cartData || !Array.isArray(cartData) || cartData.length === 0) {
  alert('장바구니가 비어있습니다.')
  localStorage.removeItem('hasCartItems')
  return
}
```

#### **Fix 4: 에러 로깅 강화 (741cfdb)**
```typescript
// Token request 실패 시 상세 로그
console.log('[Kakao Sync] Token request details:', {
  client_id: KAKAO_REST_API_KEY,
  redirect_uri: KAKAO_REDIRECT_URI,
  code_length: code.length,
  code_prefix: code.substring(0, 20)
});

if (!tokenResponse.ok) {
  const errorText = await tokenResponse.text();
  console.error('[Kakao Sync] Token request failed:', errorText);
  return c.redirect(`${state}?error=token_request_failed&detail=${errorText}`);
}
```

---

### 🎯 재발 방지 대책

#### **1. DB 스키마 변경 프로세스**
```bash
# ✅ 올바른 순서:
1. migrations/XXXX_feature_name.sql 작성
2. npx wrangler d1 migrations apply DB --local   # 로컬 테스트
3. npx wrangler d1 migrations apply DB --remote  # 프로덕션 적용
4. 코드 수정 (새 컬럼 사용)
5. 로컬 테스트
6. Git commit & push
7. 배포

# ❌ 절대 안 되는 것:
- 코드 먼저 수정하고 DB 마이그레이션 나중에
- 로컬에만 컬럼 추가하고 프로덕션 안 함
- 마이그레이션 없이 직접 SQL 실행
```

#### **2. 프로덕션 DB 스키마 정기 확인**
```bash
# 매주 또는 배포 전 실행:
npx wrangler d1 execute toss-live-commerce-db --remote \
  --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
```

#### **3. 환경별 DB 동기화 체크**
```bash
# 로컬과 프로덕션 스키마 비교
diff <(npx wrangler d1 execute DB --local --command="PRAGMA table_info(users)") \
     <(npx wrangler d1 execute DB --remote --command="PRAGMA table_info(users)")
```

#### **4. 에러 핸들링 강화**
- SQL 에러 시 자세한 로그 출력
- 컬럼 존재 여부 사전 확인 (필요 시)
- Graceful degradation (일부 기능 실패해도 전체 로그인은 성공)

#### **5. 테스트 시나리오 체크리스트**
- [ ] 로그인 없이 결제 버튼 클릭 → alert
- [ ] 로그인 + 빈 장바구니로 결제 → alert
- [ ] 로그인 + 상품 담기 후 결제 → cart 페이지 이동
- [ ] Kakao 인증 완료 후 원래 페이지로 복귀
- [ ] 로그아웃 후 재로그인
- [ ] 여러 브라우저/기기에서 로그인

---

### 📋 현재 안정화된 코드 (741cfdb)

#### **Kakao 로그인 플로우**
```typescript
// 1. Frontend: 카카오 로그인 시작
Kakao.Auth.authorize({
  redirectUri: 'https://live.ur-team.com/auth/kakao/sync/callback',
  state: currentPath,
  throughTalk: false
});

// 2. Backend: Token 교환
const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: KAKAO_REDIRECT_URI,
    code: authCode
  })
});

// 3. User info 조회
const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

// 4. DB 저장/업데이트 (안전한 컬럼만)
await DB.prepare(`
  UPDATE users 
  SET name = ?, email = ?, profile_image = ?,
      updated_at = CURRENT_TIMESTAMP,
      last_login_at = CURRENT_TIMESTAMP
  WHERE id = ?
`).bind(nickname, email, profileImage, userId).run();

// 5. 세션 생성 & 리다이렉트
const sessionToken = crypto.randomUUID();
await DB.prepare(
  'INSERT INTO admin_sessions (session_token, user_type, expires_at) VALUES (?, ?, ?)'
).bind(sessionToken, 'user', expiresAt).run();

return c.redirect(`${state}?login=success&session=${sessionToken}&userId=${userId}`);
```

#### **Cart 검증 플로우**
```typescript
async function handleCheckout() {
  // 1. 로그인 체크 (최우선)
  if (!isLoggedIn) {
    alert('로그인이 필요합니다!');
    handleKakaoLogin();
    return;
  }
  
  // 2. localStorage 체크
  const hasCartItems = localStorage.getItem('hasCartItems');
  if (!hasCartItems || hasCartItems !== 'true') {
    alert('상품을 먼저 담아주세요!');
    return;
  }
  
  // 3. 서버 검증 (올바른 배열 체크)
  const userId = localStorage.getItem('user_id');
  const response = await axios.get(`/api/cart/${userId}`);
  const cartData = response.data?.data || response.data;
  
  if (!cartData || !Array.isArray(cartData) || cartData.length === 0) {
    alert('장바구니가 비어있습니다.');
    localStorage.removeItem('hasCartItems');
    return;
  }
  
  // 4. Cart 페이지 이동
  navigate('/cart');
}
```

---

### ✅ 검증 완료

**테스트 결과 (2026-02-10 09:40)**
```
✅ 로그인 성공: {userId: '3', userName: '정지원'}
✅ Session 저장: 3124ea9d-18bc-4f99-a11b-be5007bb5dd5
✅ Firebase 초기화 완료
✅ YouTube Player 정상 작동
```

**배포 정보**
- Commit: 741cfdb
- Deployment: 542c1c39 → e19f9100
- Production: https://live.ur-team.com
- Status: ✅ 정상 작동

---

### 🎓 교훈

1. **DB 스키마 변경은 항상 마이그레이션과 함께**
2. **로컬과 프로덕션 DB 스키마는 항상 동기화**
3. **API 응답 구조를 정확히 파싱** (nested data 구조 주의)
4. **에러 로깅을 충분히** (디버깅 시간 단축)
5. **배포 전 전체 플로우 테스트** (단위 테스트만으로 부족)

---

**이제 카카오 로그인이 안정적으로 작동합니다!** ✅
