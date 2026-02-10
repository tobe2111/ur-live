# 🔍 로그인 시스템 대규모 점검 리포트

## 발견된 문제점들

### ⚠️ CRITICAL 문제

#### 1. **Race Condition - 동시 가입 시 중복 생성**
**위치**: `src/index.tsx:959-996`
**문제**:
```typescript
// 현재 코드
const existingUser = await DB.prepare(
  'SELECT * FROM users WHERE kakao_id = ?'
).bind(kakaoId).first();

if (existingUser) {
  // UPDATE...
} else {
  // INSERT... (여기서 Race Condition 발생 가능!)
}
```

**시나리오**:
- 사용자 A가 2개의 브라우저에서 동시에 로그인
- 요청 1: SELECT (없음) → INSERT 시도
- 요청 2: SELECT (없음) → INSERT 시도
- 결과: UNIQUE constraint 위반 또는 중복 계정 생성

**해결**: `INSERT OR IGNORE` 또는 `UPSERT` 사용

---

#### 2. **약한 세션 토큰 보안**
**위치**: `src/index.tsx:999`
**문제**:
```typescript
const sessionToken = `user_${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
```

**취약점**:
- 예측 가능한 패턴 (user_ID_TIMESTAMP_RANDOM)
- 짧은 랜덤 문자열 (7자리)
- 무제한 유효기간
- 세션 검증 로직 없음

**공격 시나리오**:
```
user_123_1707551234567_abc1234
     ^^^  ^^^^^^^^^^^^^^  ^^^^^^
     쉽게     추측 가능      짧음
     추출
```

**해결**: JWT 또는 crypto.randomUUID() 사용

---

#### 3. **NULL 이메일 처리 불일치**
**위치**: `src/index.tsx:955, 977, 992`
**문제**:
```typescript
// 카카오에서 이메일 안 줄 수도 있음
const email = userData.kakao_account?.email || '';

// DB에는 null로 저장
.bind(nickname, email || null, profileImage || null, kakaoId)

// 하지만 응답에는 빈 문자열
email: email || existingUser.email  // '' 또는 null 혼재
```

**결과**: 프론트엔드에서 `userEmail === ''` vs `userEmail === null` 혼란

---

#### 4. **DB 인덱스 부족**
**위치**: `migrations/0031_final_remove_toss.sql`
**문제**:
```sql
CREATE INDEX idx_users_kakao_id ON users(kakao_id);
CREATE INDEX idx_users_email ON users(email);
```

**빠진 인덱스**:
- `last_login_at` - 활성 사용자 조회 시 필요
- 복합 인덱스 없음 - 통계 쿼리 시 느림

---

### ⚠️ HIGH 문제

#### 5. **에러 핸들링 불충분**
**위치**: `src/index.tsx:1013-1019`
**문제**:
```typescript
} catch (error) {
  console.error('[Kakao Callback] Error:', error);
  return c.json({
    success: false,
    error: (error as Error).message || 'Internal server error',
  }, 500);
}
```

**문제점**:
- 모든 에러를 500으로 처리 (DB 에러, 네트워크 에러 구분 없음)
- 에러 원인 추적 어려움
- Sentry 등 모니터링 연동 없음

---

#### 6. **중복 코드 (DRY 위반)**
**위치**: `/api/auth/kakao/callback` vs `/api/auth/kakao/sync`
**문제**: 거의 동일한 로직이 2곳에 존재 (100줄 이상)

```typescript
// callback 엔드포인트 (884-1020줄)
// sync 엔드포인트 (1023-1118줄)
// → 95% 중복!
```

---

#### 7. **API Key 하드코딩**
**위치**: `src/index.tsx:909`
**문제**:
```typescript
client_id: c.env.KAKAO_REST_API_KEY || '5dd74bccb797640b0efd070467f3bafd',
```

**위험**:
- 실제 API Key가 코드에 노출
- GitHub에 커밋됨
- 환경변수 실패 시 하드코딩된 값 사용

---

#### 8. **updated_at 자동 갱신 없음**
**위치**: `migrations/0031_final_remove_toss.sql:19`
**문제**:
```sql
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
```

**문제점**:
- 수동으로 `SET updated_at = datetime('now')` 해야 함
- 깜빡하면 갱신 안 됨
- SQLite는 ON UPDATE CURRENT_TIMESTAMP 미지원

---

### ⚠️ MEDIUM 문제

#### 9. **비효율적인 SQL**
**위치**: `src/index.tsx:959-961`
**문제**:
```typescript
const existingUser = await DB.prepare(
  'SELECT * FROM users WHERE kakao_id = ?'
).bind(kakaoId).first();
```

**개선점**:
- `SELECT *` 대신 필요한 컬럼만 조회
- `first()` 사용 시 이미 1개만 가져오지만 명시적으로 LIMIT 1 추가

---

#### 10. **프론트엔드 localStorage 키 불일치**
**위치**: 
- `src/pages/KakaoCallbackPage.tsx`
- `src/pages/HomePage.tsx`
- `src/pages/LivePage.tsx`

**문제**:
```typescript
// 여러 곳에서 다른 키 사용
localStorage.setItem('accessToken', ...)
localStorage.setItem('access_token', ...)
localStorage.setItem('userId', ...)
localStorage.setItem('user_id', ...)
```

**결과**: 로그인 상태 확인 시 혼란

---

## 📊 대규모 트래픽 시 예상 문제

### 시나리오 1: 동시 가입 1000명
```
❌ UNIQUE constraint failed (kakao_id 충돌)
❌ 일부 사용자는 로그인 실패
❌ 500 에러 폭증
```

### 시나리오 2: 하루 10만 로그인
```
❌ 세션 토큰 예측/탈취 위험 증가
❌ 로그 파일 급증 (디버깅 어려움)
❌ DB 조회 성능 저하 (인덱스 부족)
```

### 시나리오 3: API Key 노출
```
❌ 악의적 사용자가 하드코딩된 Key 사용
❌ 카카오 API Rate Limit 초과
❌ 서비스 전체 로그인 불가
```

---

## ✅ 권장 수정 사항 (우선순위별)

### 🔴 P0 (즉시)
1. **Race Condition 해결** - UPSERT 패턴 적용
2. **API Key 제거** - 하드코딩된 값 삭제
3. **세션 토큰 보안 강화** - crypto.randomUUID() 사용

### 🟠 P1 (이번 주)
4. **에러 처리 개선** - 상태 코드 세분화, 모니터링 추가
5. **중복 코드 제거** - 공통 함수로 추출
6. **NULL 처리 표준화** - 이메일 빈 문자열 vs null 통일

### 🟡 P2 (다음 주)
7. **DB 인덱스 추가** - 성능 개선
8. **SQL 최적화** - SELECT * 제거
9. **localStorage 키 통일** - auth.ts에서 관리

### 🟢 P3 (추후)
10. **JWT 도입** - 세션 검증 로직 추가
11. **Rate Limiting** - 로그인 시도 제한
12. **감사 로그** - 보안 이벤트 기록

---

## 🚀 다음 단계

즉시 수정이 필요한 **P0 이슈 3개**를 먼저 해결하겠습니까?
아니면 전체 리팩토링을 원하시나요?
