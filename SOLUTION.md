# 🔥 근본 원인 분석 및 해결 방안

## 📊 문제 1: 무한 로그인 루프 (반복 발생)

### 근본 원인
1. **CheckoutPage만 URL 파라미터 처리**
   - ✅ CheckoutPage: URL 파라미터 읽고 localStorage 저장
   - ❌ SellerPage: URL 파라미터 처리 없음
   - ❌ AdminPage: URL 파라미터 처리 없음
   - ❌ HomePage: URL 파라미터 처리 있지만 실행 순서 문제 가능

2. **실행 순서 문제**
   ```typescript
   // ❌ 문제: URL 파라미터 읽기 전에 로그인 체크
   useEffect(() => {
     // URL 파라미터 읽기 (느림)
   }, [searchParams])
   
   useEffect(() => {
     // 로그인 체크 (빠름) ← 먼저 실행됨!
     if (!isLoggedIn()) redirect('/login')
   }, [])
   ```

3. **세션 만료 후 루프**
   ```
   Day 30: 세션 만료
   → 로그인 시도
   → URL에 ?login=success&session=...&userId=3
   → 페이지가 URL 파라미터 읽기 전에 로그인 체크
   → userId = null
   → 다시 /login으로 리다이렉트
   → 무한 반복 🔄
   ```

### 해결 방안
- **모든 페이지에 URL 파라미터 처리 추가**:
  - HomePage ✅ (이미 있지만 실행 순서 보장 필요)
  - CheckoutPage ✅ (수정 완료)
  - SellerPage ❌ → 추가 필요
  - AdminPage ❌ → 추가 필요
  - MyPage, MyOrdersPage, AddressManagementPage 등 → 추가 필요

---

## ⏱️ 문제 2: 카카오 로그인 속도 느림

### 근본 원인
**upsertUser 함수가 3개의 연속된 DB 쿼리 실행:**
```typescript
// src/auth-utils.ts
async function upsertUser() {
  // 1. INSERT OR IGNORE
  await DB.prepare(`INSERT OR IGNORE INTO users ...`).run()
  
  // 2. UPDATE
  await DB.prepare(`UPDATE users SET ...`).run()
  
  // 3. SELECT
  const user = await DB.prepare(`SELECT ... WHERE ...`).first()
}
```

**실행 시간:**
- INSERT OR IGNORE: ~50-100ms
- UPDATE: ~50-100ms
- SELECT: ~50-100ms
- **총합: ~150-300ms** ← 느린 원인!

### 해결 방안
**단일 쿼리로 통합 (INSERT ... ON CONFLICT DO UPDATE):**
```sql
INSERT INTO users (kakao_id, name, email, profile_image, created_at, last_login_at)
VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
ON CONFLICT(kakao_id) DO UPDATE SET
  name = excluded.name,
  email = excluded.email,
  profile_image = excluded.profile_image,
  last_login_at = datetime('now'),
  updated_at = datetime('now')
RETURNING id, kakao_id, name, email, profile_image
```

**예상 개선:**
- 3개 쿼리 → 1개 쿼리
- ~150-300ms → ~50-100ms
- **2~3배 속도 향상** 🚀

---

## 🔧 문제 3: GitHub Actions 실패

### 확인 필요
- Secrets 설정 확인
- 빌드 로그 확인
- Wrangler 버전 문제

---

## ✅ 구현 순서

1. **upsertUser 최적화** (카카오 로그인 속도 개선)
2. **모든 페이지에 URL 파라미터 처리 추가** (무한 루프 해결)
3. **공통 유틸리티 함수 생성** (코드 중복 방지)
4. **테스트 및 검증**
5. **GitHub Actions 수정**

---
