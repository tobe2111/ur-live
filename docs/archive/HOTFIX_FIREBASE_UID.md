# 🚨 긴급 핫픽스: firebase_uid 컬럼 누락 문제

**날짜**: 2026-03-01  
**심각도**: HIGH  
**영향**: 로그인 실패, 데이터베이스 에러

---

## 🔍 문제 상황

### 에러 메시지
```
D1_ERROR: no such column: firebase_uid: SQLITE_ERROR
https://live.ur-team.com/product/20?error=database_error&detail=D1_ERROR%3A%20no%20such%20column%3A%20firebase_uid%3A%20SQLITE_ERROR
```

### 원인
- Firebase Auth 마이그레이션 중 `firebase_uid` 컬럼이 프로덕션 D1 데이터베이스에 추가되지 않음
- 마이그레이션 파일(`add_firebase_uid.sql`)이 번호 없이 생성되어 wrangler가 자동 적용하지 못함

### 영향 범위
- ✅ 로그인 자체는 작동 (Firebase Auth)
- ❌ `firebase_uid` 저장 실패 → 사용자 매핑 불가
- ❌ 데이터베이스 에러로 인한 페이지 리다이렉트

---

## ✅ 임시 수정 완료 (핫픽스)

### 수정 내용
**파일**: `/home/user/webapp/src/index.tsx`

```typescript
// Before (에러 발생)
await DB.prepare(`
  UPDATE users SET firebase_uid = ? WHERE id = ?
`).bind(firebaseUID, userId).run();

// After (에러 무시)
try {
  await DB.prepare(`
    UPDATE users SET firebase_uid = ? WHERE id = ?
  `).bind(firebaseUID, userId).run();
} catch (colErr) {
  console.warn('[Kakao Sync] firebase_uid column not found, skipping update:', colErr);
}
```

### 효과
- ✅ 데이터베이스 에러 방지
- ✅ 로그인 정상 작동
- ⚠️ `firebase_uid`는 여전히 저장되지 않음 (마이그레이션 필요)

### 배포 상태
- **커밋**: `b1cff92` - hotfix: Wrap firebase_uid UPDATE in try-catch
- **푸시**: ✅ GitHub에 푸시 완료
- **GitHub Actions**: 자동 빌드/배포 진행 중
- **예상 배포 시간**: 5-10분

---

## 🔧 영구 해결 방법 (D1 마이그레이션 적용)

### 방법 1: Cloudflare Dashboard (권장 - 즉시 적용)

1. **Cloudflare Dashboard 로그인**:
   ```
   https://dash.cloudflare.com
   ```

2. **D1 데이터베이스 선택**:
   - Workers & Pages → D1 SQL Database
   - 데이터베이스 이름: `toss-live-commerce-db`
   - Database ID: `d9530ba6-7a26-4c02-9295-3ce5aef112a3`

3. **Console 탭 클릭**

4. **SQL 실행** (복사-붙여넣기):
   ```sql
   -- Add firebase_uid column to users table
   ALTER TABLE users ADD COLUMN firebase_uid TEXT;

   -- Create index for fast lookup
   CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
   ```

5. **"Execute" 버튼 클릭**

6. **결과 확인**:
   ```sql
   -- 컬럼이 추가되었는지 확인
   PRAGMA table_info(users);
   ```

   **Expected Output** (firebase_uid가 있어야 함):
   ```
   cid | name         | type    | notnull | dflt_value | pk
   ----|--------------|---------|---------|------------|---
   ... | firebase_uid | TEXT    | 0       | NULL       | 0
   ```

---

### 방법 2: Wrangler CLI (API 토큰 권한 필요)

**현재 문제**: API 토큰에 D1 write 권한 없음

**해결**:

1. **Cloudflare API Token 업데이트**:
   - https://dash.cloudflare.com/profile/api-tokens
   - 기존 토큰 클릭 → Edit
   - 권한 추가:
     * `Account | D1 | Edit`
     * `Account | Cloudflare Pages | Edit`
   - Save

2. **Wrangler 명령 실행**:
   ```bash
   cd /home/user/webapp
   export CLOUDFLARE_API_TOKEN="your-new-token"
   npx wrangler d1 migrations apply toss-live-commerce-db --remote
   ```

3. **결과 확인**:
   ```bash
   npx wrangler d1 execute toss-live-commerce-db --remote --command "PRAGMA table_info(users);"
   ```

---

## 📋 마이그레이션 파일 정보

**파일 위치**: `/home/user/webapp/migrations/0030_add_firebase_uid.sql`

**내용**:
```sql
-- Add firebase_uid column to users table
ALTER TABLE users ADD COLUMN firebase_uid TEXT;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Migration note:
-- firebase_uid will be populated on next login
-- Format: 
--   - Email users: "email_{email}"
--   - Kakao users: "kakao_{kakao_id}"
--   - Admin/Seller: "admin_{id}" or "seller_{id}"
```

---

## ✅ 마이그레이션 적용 후 확인

### 1. 데이터베이스 확인
```sql
-- Cloudflare Dashboard → D1 Console에서 실행
SELECT name, firebase_uid FROM users LIMIT 5;
```

**Expected**: `firebase_uid` 컬럼이 표시됨 (값은 NULL 또는 데이터 존재)

### 2. 로그인 테스트
1. https://live.ur-team.com 접속
2. 카카오 로그인 시도
3. 에러 없이 로그인 성공 확인

### 3. 콘솔 로그 확인
브라우저 개발자 도구 → Console:
```
✅ [Kakao Sync] Firebase Custom Token 발급 완료 for user: 123
```

에러가 없어야 함 (기존: `firebase_uid column not found, skipping update`)

---

## 🚨 추가 문제: GitHub Credentials 무한 로딩

### 문제
```
setting up github credentials (무한 로딩)
```

### 원인
- GitHub App 또는 OAuth 인증 토큰 만료
- setup_github_environment 함수 호출 시 권한 부족

### 해결 방법

#### 옵션 A: GitHub 인증 재설정

1. **GenSpark GitHub 탭 열기**:
   - 좌측 사이드바 → GitHub 탭

2. **기존 인증 제거**:
   - "Disconnect GitHub" 또는 "Remove Authorization"

3. **재인증**:
   - "Connect GitHub" 클릭
   - GitHub App 설치 및 OAuth 승인
   - `tobe2111/ur-live` 저장소 선택

#### 옵션 B: Git 수동 푸시 (임시)

```bash
cd /home/user/webapp
git config --global user.name "tobe2111"
git config --global user.email "your-email@example.com"
git push origin main
```

**Note**: Personal Access Token이 필요할 수 있음

---

## 📊 현재 상태 요약

| 항목 | 상태 | 조치 필요 |
|------|------|-----------|
| **firebase_uid 에러** | ✅ 임시 수정 (try-catch) | ⚠️ D1 마이그레이션 적용 |
| **로그인 작동** | ✅ 정상 | - |
| **GitHub Actions** | ✅ 빌드 진행 중 | 5-10분 대기 |
| **D1 마이그레이션** | ❌ 미적용 | 🔴 Cloudflare Dashboard에서 수동 적용 |
| **GitHub Credentials** | ❌ 무한 로딩 | 🔴 GitHub 탭에서 재인증 |

---

## 🎯 다음 단계 (우선순위)

### 1️⃣ D1 마이그레이션 적용 (HIGH - 즉시)
- Cloudflare Dashboard → D1 Console
- SQL 실행: `ALTER TABLE users ADD COLUMN firebase_uid TEXT;`

### 2️⃣ GitHub Actions 배포 확인 (MEDIUM - 10분 후)
- https://github.com/tobe2111/ur-live/actions
- 녹색 ✅ 확인

### 3️⃣ 프로덕션 테스트 (MEDIUM - 배포 후)
- https://live.ur-team.com 접속
- 카카오 로그인 테스트
- 에러 없음 확인

### 4️⃣ GitHub 인증 재설정 (LOW - 필요 시)
- GenSpark GitHub 탭
- Disconnect → Reconnect

---

## 📞 문의

**문제가 지속되면**:
1. GitHub Actions 로그 전체 복사
2. 브라우저 콘솔 에러 캡처
3. Cloudflare Dashboard → D1 Console에서 `PRAGMA table_info(users);` 실행 결과 공유

**현재 상태**:
- ✅ 핫픽스 푸시 완료
- ⏳ GitHub Actions 배포 진행 중
- 🔴 D1 마이그레이션 사용자 수동 적용 필요

---

**작성일**: 2026-03-01  
**문서 위치**: `/home/user/webapp/HOTFIX_FIREBASE_UID.md`
