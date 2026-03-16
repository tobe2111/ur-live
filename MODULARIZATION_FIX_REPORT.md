# 대규모 모듈화 후 DB 스키마 불일치 해결 보고서

## 🔴 문제 상황

프론트엔드에서 다음 에러들이 발생:

```
Failed to load live streams: AxiosError: Request failed with status code 500
Failed to load products: AxiosError: Request failed with status code 500
```

### 구체적 에러

1. **Products API**: `D1_ERROR: no such column: status at offset 29: SQLITE_ERROR`
2. **Streams API**: `D1_ERROR: no such column: s.shop_name at offset 338: SQLITE_ERROR`

## 🔍 원인 분석

### 1. Products 테이블 - status 컬럼 누락
- **문제**: `ProductRepository`에서 `status` 컬럼을 참조하지만 로컬 DB에 없음
- **코드 위치**: `src/features/products/repositories/ProductRepository.ts:16, 26, 40, 70, 84, 106, 166, 195, 214, 231`
- **원인**: 
  - `001_initial.sql`(글로벌 버전)에는 `status` 컬럼 있음
  - `0001_initial_schema.sql`(레거시)에는 `is_active` 컬럼만 있음
  - 로컬 DB가 구 버전 스키마로 초기화됨

### 2. Streams API - 컬럼 이름 불일치
- **문제**: `streams.routes.ts`에서 `shop_name`, `image_url` 참조
- **실제 스키마**: `001_initial.sql`에서는 `name`, `logo_url` 사용
- **코드 위치**: `src/worker/routes/streams.routes.ts:52-57, 139-144`

### 3. live_streams 테이블 미생성
- **문제**: `live_streams` 테이블이 로컬 DB에 생성되지 않음
- **원인**: `001_initial.sql`과 `0001_initial_schema.sql` 간 스키마 불일치

## ✅ 해결 방법

### 1. 로컬 DB 재구축

```bash
# 로컬 DB 삭제
rm -rf .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite*

# PRAGMA 제거한 초기 마이그레이션 생성
grep -v "^PRAGMA" migrations/001_initial.sql > migrations/001_initial_no_pragma.sql

# 마이그레이션 실행
npx wrangler d1 execute toss-live-commerce-db --local --file=migrations/001_initial_no_pragma.sql
npx wrangler d1 execute toss-live-commerce-db --local --file=migrations/002_seed.sql
```

### 2. live_streams 테이블 생성

```sql
-- 라이브 스트림 테이블
CREATE TABLE IF NOT EXISTS live_streams (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  seller_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  youtube_video_id TEXT,
  status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'live', 'ended')),
  current_product_id TEXT,
  thumbnail_url TEXT,
  stream_url TEXT,
  viewer_count INTEGER DEFAULT 0,
  scheduled_at TEXT,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- products 테이블에 live_stream_id 컬럼 추가
ALTER TABLE products ADD COLUMN live_stream_id TEXT;
```

### 3. streams.routes.ts 수정

```diff
- s.shop_name  AS seller_name,
- s.image_url  AS seller_image,
- cp.image_url AS current_product_image
+ s.name       AS seller_name,
+ s.logo_url   AS seller_image,
+ cp.thumbnail_url AS current_product_image
```

### 4. 빌드 및 재시작

```bash
# 빌드 캐시 삭제
rm -rf .wrangler/tmp

# 프로젝트 전체 빌드
npm run build

# PM2 재시작
pm2 delete ur-live
pm2 start ecosystem.config.cjs
```

## 📊 결과

### API 정상 동작 확인

```bash
# Products API
$ curl http://localhost:3000/api/products?limit=3
{
  "success": true,
  "data": [
    { "name": "프리미엄 티셔츠", ... }
  ]
}

# Streams API
$ curl http://localhost:3000/api/streams?status=live
{
  "success": true,
  "data": [],
  "pagination": { "total": 0, ... }
}
```

## 📝 생성된 파일

1. **migrations/001_initial_no_pragma.sql**
   - PRAGMA 제거한 초기 스키마
   - 로컬 개발용

2. **migrations/0109_add_status_to_products.sql**
   - products 테이블에 status 컬럼 추가
   - 프로덕션 마이그레이션용

3. **scripts/migrate-local.sh**
   - 로컬 마이그레이션 자동화 스크립트

## ⚠️ 주의사항

### 프로덕션 배포 시

1. **DB 마이그레이션 필수**:
   ```bash
   # 프로덕션 DB에 live_streams 테이블이 있는지 확인
   npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='live_streams'"
   
   # 없으면 마이그레이션 실행
   npx wrangler d1 execute toss-live-commerce-db --remote --file=<create_live_streams.sql>
   ```

2. **status 컬럼 확인**:
   ```bash
   # products 테이블에 status 컬럼이 있는지 확인
   npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT status FROM products LIMIT 1"
   
   # 없으면 0109 마이그레이션 실행 (ALTER TABLE은 조심해서)
   ```

3. **빌드 후 배포**:
   ```bash
   npm run build
   npm run deploy
   ```

## 🔄 로컬 개발 재현 방법

```bash
# 1. 로컬 DB 초기화
rm -rf .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite*

# 2. 마이그레이션 실행
./scripts/migrate-local.sh

# 3. 빌드 및 시작
npm run build
pm2 start ecosystem.config.cjs

# 4. API 테스트
curl http://localhost:3000/api/products?limit=3
curl http://localhost:3000/api/streams?status=live
```

## ✅ 체크리스트

- [x] 로컬 DB products 테이블에 status 컬럼 추가
- [x] 로컬 DB live_streams 테이블 생성
- [x] streams.routes.ts 컬럼 이름 수정
- [x] 빌드 캐시 삭제 및 재빌드
- [x] API 정상 동작 확인
- [x] Git 커밋 및 푸시
- [ ] 프로덕션 DB 마이그레이션 (배포 전 필수)
- [ ] 프로덕션 배포 후 API 확인

## 🎯 커밋 정보

```
commit: 94cb1fb1
branch: main
message: fix: 대규모 모듈화 후 DB 스키마 불일치 문제 해결
```

## 📚 관련 파일

- `src/worker/routes/streams.routes.ts` (수정)
- `src/features/products/repositories/ProductRepository.ts` (확인용)
- `migrations/001_initial.sql` (참조용)
- `migrations/0001_initial_schema.sql` (레거시, 참조용)
- `migrations/001_initial_no_pragma.sql` (신규)
- `migrations/0109_add_status_to_products.sql` (신규)
- `scripts/migrate-local.sh` (신규)

---

**작성일**: 2026-03-16  
**작성자**: AI Assistant  
**상태**: ✅ 로컬 해결 완료, ⚠️ 프로덕션 배포 대기
