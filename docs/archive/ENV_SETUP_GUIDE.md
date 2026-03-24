# 환경 변수 설정 가이드 (Environment Variables Setup Guide)

**프로젝트**: ur-live  
**최종 업데이트**: 2026-02-20  
**중요도**: 🔒 배포 전 필수 체크

---

## 목차
1. [필수 환경 변수 목록](#1-필수-환경-변수-목록)
2. [로컬 개발 환경 설정](#2-로컬-개발-환경-설정)
3. [Cloudflare Pages 프로덕션 설정](#3-cloudflare-pages-프로덕션-설정)
4. [환경 변수 검증](#4-환경-변수-검증)
5. [문제 해결](#5-문제-해결)

---

## 1. 필수 환경 변수 목록

### Toss Payments 관련

| 변수명 | 설명 | 예시 | 필수 여부 |
|--------|------|------|----------|
| `TOSS_SECRET_KEY` | Toss Payments API 시크릿 키 (결제 승인용) | `test_gsk_yL0qZ4...` | ✅ 필수 |
| `TOSS_CLIENT_KEY` | Toss Payments 클라이언트 키 (프론트엔드용) | `test_gck_docs_Ovk5...` | ✅ 필수 |

### Cloudflare 리소스 (자동 바인딩)

| 바인딩 이름 | 타입 | 설명 | 필수 여부 |
|-------------|------|------|----------|
| `DB` | D1 Database | 메인 데이터베이스 | ✅ 필수 |
| `SESSION_KV` | KV Namespace | 세션 저장소 | ✅ 필수 |
| `CACHE_KV` | KV Namespace | 캐시 저장소 | ✅ 필수 |

---

## 2. 로컬 개발 환경 설정

### 2.1. `.dev.vars` 파일 생성

프로젝트 루트에 `.dev.vars` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# Toss Payments (테스트 키)
TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm

# 프로덕션에서는 실제 키로 교체 필요
```

### 2.2. `.dev.vars`를 `.gitignore`에 추가

```bash
# .gitignore에 다음 라인 추가
.dev.vars
.env
```

### 2.3. D1 로컬 데이터베이스 설정

```bash
# 마이그레이션 적용
npx wrangler d1 migrations apply toss-live-commerce-db --local

# 데이터베이스 확인
npx wrangler d1 execute toss-live-commerce-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### 2.4. 로컬 서버 시작

```bash
# 빌드
npm run build

# PM2로 로컬 서버 시작
pm2 start ecosystem.config.cjs

# 로그 확인
pm2 logs --nostream
```

---

## 3. Cloudflare Pages 프로덕션 설정

### 3.1. Wrangler 로그인

```bash
npx wrangler login
```

### 3.2. 시크릿 추가

**중요**: 각 시크릿은 프로젝트마다 한 번씩 설정해야 합니다.

```bash
# Toss Payments Secret Key (프로덕션 키로 교체 필요)
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
# 프롬프트에서 실제 프로덕션 키 입력

# Toss Payments Client Key (프로덕션 키로 교체 필요)
npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live
# 프롬프트에서 실제 프로덕션 키 입력
```

### 3.3. 시크릿 목록 확인

```bash
npx wrangler pages secret list --project-name ur-live
```

**예상 출력:**
```
┌───────────────────┬──────────────────────────┐
│ Secret            │ Created                  │
├───────────────────┼──────────────────────────┤
│ TOSS_SECRET_KEY   │ 2026-02-20T10:30:00.000Z │
│ TOSS_CLIENT_KEY   │ 2026-02-20T10:31:00.000Z │
└───────────────────┴──────────────────────────┘
```

### 3.4. D1 프로덕션 데이터베이스 마이그레이션

```bash
# 마이그레이션 적용
npx wrangler d1 migrations apply toss-live-commerce-db

# 확인
npx wrangler d1 execute toss-live-commerce-db --command="SELECT COUNT(*) FROM users"
```

---

## 4. 환경 변수 검증

### 4.1. 자동 검증 스크립트 사용

```bash
# 배포 전 자동 검증
./deploy.sh
```

스크립트가 다음을 자동으로 체크합니다:
- ✅ Cloudflare 인증 상태
- ✅ 필수 시크릿 존재 여부
- ✅ 로컬 `.dev.vars` 파일 존재
- ✅ D1 마이그레이션 상태

### 4.2. 수동 검증

#### 로컬 환경 검증

```bash
# .dev.vars 파일 존재 확인
ls -la .dev.vars

# 내용 확인 (민감 정보 주의)
cat .dev.vars | grep TOSS_SECRET_KEY
```

#### 프로덕션 환경 검증

```bash
# Cloudflare Pages 시크릿 확인
npx wrangler pages secret list --project-name ur-live

# 배포 후 API 테스트
curl -X GET https://live.ur-team.com/api/health
```

---

## 5. 문제 해결

### 문제 1: "TOSS_SECRET_KEY is not configured" 에러

**원인**: Cloudflare Pages에 시크릿이 설정되지 않음

**해결**:
```bash
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
```

### 문제 2: "Unauthorized" 에러 (401)

**원인**: 잘못된 API 키 또는 시크릿 누락

**해결**:
1. 시크릿 목록 확인:
   ```bash
   npx wrangler pages secret list --project-name ur-live
   ```
2. 시크릿 재설정:
   ```bash
   npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
   ```

### 문제 3: 로컬에서는 되지만 프로덕션에서 실패

**원인**: `.dev.vars`와 Cloudflare Pages 시크릿이 동기화되지 않음

**해결**:
1. `.dev.vars` 내용 확인
2. Cloudflare Pages 시크릿 재설정
3. 배포 후 테스트

### 문제 4: "D1 database not found" 에러

**원인**: D1 데이터베이스가 바인딩되지 않음

**해결**:
1. `wrangler.jsonc` 파일 확인:
   ```jsonc
   {
     "d1_databases": [
       {
         "binding": "DB",
         "database_name": "toss-live-commerce-db",
         "database_id": "d9530ba6-7a26-4c02-9295-3ce5aef112a3"
       }
     ]
   }
   ```
2. 데이터베이스 ID 확인:
   ```bash
   npx wrangler d1 list
   ```

---

## 배포 전 체크리스트

배포하기 전에 다음 사항을 확인하세요:

- [ ] `.dev.vars` 파일 존재 및 설정 완료
- [ ] `.dev.vars`가 `.gitignore`에 포함됨
- [ ] Cloudflare 인증 완료 (`npx wrangler whoami`)
- [ ] 모든 필수 시크릿 설정 완료 (`npx wrangler pages secret list`)
- [ ] D1 로컬 마이그레이션 적용 완료
- [ ] D1 프로덕션 마이그레이션 적용 완료 (필요 시)
- [ ] 로컬 빌드 성공 (`npm run build`)
- [ ] 배포 스크립트 실행 가능 (`chmod +x deploy.sh`)

---

## 추가 리소스

- [Cloudflare Pages 문서](https://developers.cloudflare.com/pages/)
- [Wrangler CLI 문서](https://developers.cloudflare.com/workers/wrangler/)
- [D1 데이터베이스 문서](https://developers.cloudflare.com/d1/)
- [Toss Payments 문서](https://docs.tosspayments.com/)

---

**문제가 계속 발생하면 다음 정보를 수집하여 보고하세요:**
1. 에러 메시지 전체
2. `npx wrangler pages secret list` 출력
3. `npx wrangler whoami` 출력
4. 브라우저 콘솔 에러 로그
