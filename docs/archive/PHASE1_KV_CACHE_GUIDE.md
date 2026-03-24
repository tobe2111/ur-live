# Phase 1: KV Cache 구현 가이드 (라이브 메타데이터 캐싱)

## 🎯 목표
- 동시 시청자: 500명 → **100,000명 이상**
- 응답 시간: 200ms → **10ms**
- DB 부하: 100% → **1%** (99% 캐시 히트)

## 📊 구현 전후 비교

### Before (현재)
```
[10,000명 시청자]
    ↓ 10,000 requests/min
[GET /api/live-streams/:id]
    ↓ 10,000 DB queries/min ← 병목!
[D1 Database]
```
**DB 부하**: 10,000 reads/min  
**응답 시간**: 200ms (DB 조회 + 네트워크)

### After (KV Cache)
```
[10,000명 시청자]
    ↓ 10,000 requests/min
[GET /api/live-streams/:id]
    ↓ 9,900 KV hits (99%)
[KV Cache] ← 10ms 응답
    ↓ 100 DB queries/min (캐시 미스 1%)
[D1 Database]
```
**DB 부하**: 100 reads/min (99% 감소)  
**응답 시간**: 10ms (KV 조회)

---

## 🔧 Step 1: KV Namespace 생성

### 1-1. KV Namespace 생성 (Production)
```bash
cd /home/user/webapp
npx wrangler kv:namespace create LIVE_CACHE
```

**출력 예시**:
```
⛅️ wrangler 4.61.1
─────────────────────────────────────────────
🌀  Creating namespace with title "ur-live-LIVE_CACHE"
✨  Success!
Add the following to your wrangler.jsonc:

kv_namespaces = [
  { binding = "LIVE_CACHE", id = "abc123def456..." }
]
```

### 1-2. KV Namespace 생성 (Preview/Local Dev)
```bash
npx wrangler kv:namespace create LIVE_CACHE --preview
```

**출력 예시**:
```
✨  Success!
Add the following to your wrangler.jsonc:

kv_namespaces = [
  { binding = "LIVE_CACHE", preview_id = "xyz789abc123..." }
]
```

### 1-3. wrangler.jsonc 업데이트
```jsonc
{
  "name": "ur-live",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "toss-live-commerce-db",
      "database_id": "d9530ba6-7a26-4c02-9295-3ce5aef112a3"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "SESSION_KV",
      "id": "3b522e69651f4d4f84a0cdf9430eeb72"
    },
    {
      "binding": "CACHE_KV",
      "id": "d2bfa38f55fc4fcda1bd1c0b6ee8de31"
    },
    // ✅ NEW: 라이브 캐시 추가
    {
      "binding": "LIVE_CACHE",
      "id": "YOUR_PRODUCTION_KV_ID",      // 1-1 출력에서 복사
      "preview_id": "YOUR_PREVIEW_KV_ID"   // 1-2 출력에서 복사
    }
  ]
}
```

---

## 🔧 Step 2: TypeScript 타입 정의

### 2-1. src/types/bindings.ts 생성
```typescript
// src/types/bindings.ts
export type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  LIVE_CACHE: KVNamespace; // ✅ NEW
}
```

### 2-2. src/index.tsx 타입 업데이트
```typescript
// src/index.tsx 최상단
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './types/bindings';

const app = new Hono<{ Bindings: Bindings }>();
```

---

## 🔧 Step 3: 캐시 유틸리티 함수 작성

### 3-1. src/utils/cache.ts 생성
```typescript
// src/utils/cache.ts

/**
 * KV 캐시에서 데이터 조회 (TTL 체크)
 */
export async function getCached<T>(
  kv: KVNamespace,
  key: string,
  ttlSeconds: number = 30
): Promise<T | null> {
  try {
    const cached = await kv.get(key, 'json') as { data: T; timestamp: number } | null;
    
    if (!cached) {
      return null; // 캐시 미스
    }
    
    // TTL 체크
    const age = Date.now() - cached.timestamp;
    if (age > ttlSeconds * 1000) {
      return null; // 캐시 만료
    }
    
    return cached.data;
  } catch (error) {
    console.error('[Cache] Get error:', error);
    return null;
  }
}

/**
 * KV 캐시에 데이터 저장 (TTL 설정)
 */
export async function setCached<T>(
  kv: KVNamespace,
  key: string,
  data: T,
  ttlSeconds: number = 30
): Promise<void> {
  try {
    await kv.put(
      key,
      JSON.stringify({ data, timestamp: Date.now() }),
      { expirationTtl: ttlSeconds }
    );
  } catch (error) {
    console.error('[Cache] Set error:', error);
  }
}

/**
 * KV 캐시 무효화
 */
export async function invalidateCache(
  kv: KVNamespace,
  key: string
): Promise<void> {
  try {
    await kv.delete(key);
  } catch (error) {
    console.error('[Cache] Delete error:', error);
  }
}

/**
 * 캐시 키 생성
 */
export function getCacheKey(prefix: string, id: string | number): string {
  return `${prefix}:${id}`;
}
```

---

## 🔧 Step 4: 라이브 스트림 API에 캐시 적용

### 4-1. 현재 코드 확인
```bash
cd /home/user/webapp
grep -n "app.get.*'/api/live-streams/:id'" src/index.tsx
```

### 4-2. 라이브 스트림 상세 API 캐시 적용
```typescript
// src/index.tsx

import { getCached, setCached, invalidateCache, getCacheKey } from './utils/cache';

// ✅ 개선: KV Cache 적용
app.get('/api/live-streams/:id', async (c) => {
  const { DB, LIVE_CACHE } = c.env;
  const streamId = c.req.param('id');
  const cacheKey = getCacheKey('stream', streamId);
  
  try {
    // 1️⃣ KV 캐시 조회 (TTL 30초)
    const cached = await getCached(LIVE_CACHE, cacheKey, 30);
    if (cached) {
      console.log(`[Cache HIT] stream:${streamId}`);
      return c.json(cached);
    }
    
    console.log(`[Cache MISS] stream:${streamId}`);
    
    // 2️⃣ DB 조회 (캐시 미스 시에만)
    const stream = await DB.prepare(`
      SELECT * FROM live_streams WHERE id = ?
    `).bind(streamId).first();
    
    if (!stream) {
      return c.json({ success: false, error: '라이브 스트림을 찾을 수 없습니다' }, 404);
    }
    
    // 3️⃣ 관련 상품 조회
    const products = await DB.prepare(`
      SELECT p.*, lsp.display_order
      FROM products p
      LEFT JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ?
      ORDER BY lsp.display_order ASC
    `).bind(streamId).all();
    
    const result = {
      success: true,
      data: {
        ...stream,
        products: products.results || []
      }
    };
    
    // 4️⃣ KV 캐시 저장 (30초 TTL)
    await setCached(LIVE_CACHE, cacheKey, result, 30);
    
    return c.json(result);
    
  } catch (error) {
    console.error('[Live Stream Detail] Error:', error);
    return c.json({ 
      success: false, 
      error: '라이브 스트림 조회 중 오류가 발생했습니다' 
    }, 500);
  }
});
```

### 4-3. 라이브 스트림 목록 API 캐시 적용
```typescript
// ✅ 개선: 라이브 스트림 목록 캐시
app.get('/api/live-streams', async (c) => {
  const { DB, LIVE_CACHE } = c.env;
  const status = c.req.query('status') || 'all';
  const cacheKey = getCacheKey('streams', status);
  
  try {
    // 1️⃣ KV 캐시 조회 (TTL 10초 - 목록은 더 자주 갱신)
    const cached = await getCached(LIVE_CACHE, cacheKey, 10);
    if (cached) {
      console.log(`[Cache HIT] streams:${status}`);
      return c.json(cached);
    }
    
    console.log(`[Cache MISS] streams:${status}`);
    
    // 2️⃣ DB 조회
    let query = `
      SELECT 
        ls.*,
        s.name as seller_name,
        s.company_name as seller_company,
        COUNT(DISTINCT lsp.product_id) as product_count
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      LEFT JOIN live_stream_products lsp ON ls.id = lsp.live_stream_id
    `;
    
    if (status !== 'all') {
      query += ` WHERE ls.status = ?`;
    }
    
    query += `
      GROUP BY ls.id
      ORDER BY ls.created_at DESC
      LIMIT 50
    `;
    
    const streams = status !== 'all'
      ? await DB.prepare(query).bind(status).all()
      : await DB.prepare(query).all();
    
    const result = {
      success: true,
      data: streams.results || []
    };
    
    // 3️⃣ KV 캐시 저장 (10초 TTL)
    await setCached(LIVE_CACHE, cacheKey, result, 10);
    
    return c.json(result);
    
  } catch (error) {
    console.error('[Live Streams List] Error:', error);
    return c.json({ 
      success: false, 
      error: '라이브 스트림 목록 조회 중 오류가 발생했습니다' 
    }, 500);
  }
});
```

---

## 🔧 Step 5: 캐시 무효화 (라이브 업데이트 시)

### 5-1. 라이브 스트림 생성/수정/삭제 시 캐시 무효화
```typescript
// ✅ 라이브 스트림 생성 시 목록 캐시 무효화
app.post('/api/seller/live-streams', async (c) => {
  const { DB, LIVE_CACHE } = c.env;
  
  try {
    // ... 라이브 스트림 생성 로직 ...
    
    // ✅ 캐시 무효화 (목록)
    await invalidateCache(LIVE_CACHE, getCacheKey('streams', 'all'));
    await invalidateCache(LIVE_CACHE, getCacheKey('streams', 'scheduled'));
    await invalidateCache(LIVE_CACHE, getCacheKey('streams', 'live'));
    
    return c.json({ success: true, data: { id: streamId } });
  } catch (error) {
    // ...
  }
});

// ✅ 라이브 스트림 수정 시 상세 + 목록 캐시 무효화
app.put('/api/seller/live-streams/:id', async (c) => {
  const { DB, LIVE_CACHE } = c.env;
  const streamId = c.req.param('id');
  
  try {
    // ... 라이브 스트림 수정 로직 ...
    
    // ✅ 캐시 무효화 (상세 + 목록)
    await invalidateCache(LIVE_CACHE, getCacheKey('stream', streamId));
    await invalidateCache(LIVE_CACHE, getCacheKey('streams', 'all'));
    await invalidateCache(LIVE_CACHE, getCacheKey('streams', 'scheduled'));
    await invalidateCache(LIVE_CACHE, getCacheKey('streams', 'live'));
    
    return c.json({ success: true });
  } catch (error) {
    // ...
  }
});

// ✅ 라이브 스트림 삭제 시 캐시 무효화
app.delete('/api/seller/live-streams/:id', async (c) => {
  const { DB, LIVE_CACHE } = c.env;
  const streamId = c.req.param('id');
  
  try {
    // ... 라이브 스트림 삭제 로직 ...
    
    // ✅ 캐시 무효화
    await invalidateCache(LIVE_CACHE, getCacheKey('stream', streamId));
    await invalidateCache(LIVE_CACHE, getCacheKey('streams', 'all'));
    
    return c.json({ success: true });
  } catch (error) {
    // ...
  }
});
```

---

## 🧪 Step 6: 로컬 테스트

### 6-1. 빌드 및 로컬 실행
```bash
cd /home/user/webapp

# 빌드
npm run build

# 로컬 실행 (--local 플래그로 로컬 KV 사용)
npx wrangler pages dev dist --d1=toss-live-commerce-db --local --ip 0.0.0.0 --port 3000
```

### 6-2. 캐시 동작 확인
```bash
# 1️⃣ 첫 요청 (캐시 미스 - DB 조회)
curl http://localhost:3000/api/live-streams/1
# 로그: [Cache MISS] stream:1

# 2️⃣ 두 번째 요청 (캐시 히트 - 즉시 응답)
curl http://localhost:3000/api/live-streams/1
# 로그: [Cache HIT] stream:1

# 3️⃣ 30초 후 요청 (캐시 만료 - DB 조회)
sleep 31
curl http://localhost:3000/api/live-streams/1
# 로그: [Cache MISS] stream:1
```

### 6-3. 캐시 무효화 확인
```bash
# 1️⃣ 라이브 조회 (캐시됨)
curl http://localhost:3000/api/live-streams/1

# 2️⃣ 라이브 수정 (캐시 무효화)
curl -X PUT http://localhost:3000/api/seller/live-streams/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'

# 3️⃣ 다시 조회 (캐시 미스 - 새 데이터)
curl http://localhost:3000/api/live-streams/1
# 로그: [Cache MISS] stream:1 (캐시 무효화됨)
```

---

## 🚀 Step 7: Production 배포

### 7-1. 최종 빌드
```bash
cd /home/user/webapp
npm run build
```

### 7-2. Cloudflare Pages 배포
```bash
npx wrangler pages deploy dist --project-name ur-live
```

### 7-3. 배포 후 KV 상태 확인
```bash
# KV Namespace 목록 확인
npx wrangler kv:namespace list

# KV 데이터 확인 (캐시 확인)
npx wrangler kv:key list --namespace-id=YOUR_LIVE_CACHE_ID

# 특정 키 조회
npx wrangler kv:key get "stream:1" --namespace-id=YOUR_LIVE_CACHE_ID
```

---

## 📊 Step 8: 성능 모니터링

### 8-1. Cloudflare Analytics 확인
1. Cloudflare Dashboard → Workers & Pages → ur-live
2. Analytics 탭 → Request 확인
3. KV Operations 확인 (reads, writes)

### 8-2. 로그 모니터링
```bash
# 실시간 로그 확인 (캐시 히트율)
npx wrangler pages deployment tail

# 필터링: 캐시 관련 로그만
npx wrangler pages deployment tail --format=pretty | grep "Cache"
```

**예상 로그**:
```
[Cache HIT] stream:1 (99% of requests)
[Cache MISS] stream:1 (1% of requests)
[Cache HIT] streams:all
```

### 8-3. 성능 지표 확인
```bash
# 응답 시간 테스트 (100회 요청)
for i in {1..100}; do
  curl -w "%{time_total}\n" -o /dev/null -s http://live.ur-team.com/api/live-streams/1
done | awk '{sum+=$1; count++} END {print "평균:", sum/count, "초"}'
```

**예상 결과**:
- **Before** (캐시 없음): 평균 0.2초 (200ms)
- **After** (KV 캐시): 평균 0.01초 (10ms) ✅

---

## ✅ 검증 체크리스트

### 기능 검증
- [ ] KV Namespace 생성 완료 (Production + Preview)
- [ ] wrangler.jsonc에 LIVE_CACHE 바인딩 추가
- [ ] TypeScript 타입 정의 추가 (Bindings)
- [ ] cache.ts 유틸리티 함수 작성
- [ ] 라이브 상세 API 캐시 적용
- [ ] 라이브 목록 API 캐시 적용
- [ ] 캐시 무효화 로직 구현 (생성/수정/삭제)
- [ ] 로컬 테스트 완료 (캐시 히트/미스 확인)
- [ ] Production 배포 완료

### 성능 검증
- [ ] 캐시 히트율 >95% 확인
- [ ] 응답 시간 <50ms 확인
- [ ] DB 부하 99% 감소 확인
- [ ] 동시 1,000명 접속 테스트 통과

### 모니터링 설정
- [ ] Cloudflare Analytics 확인
- [ ] KV Operations 모니터링 설정
- [ ] 캐시 히트율 대시보드 확인
- [ ] 알림 설정 (캐시 히트율 <90% 시)

---

## 🎯 예상 결과

### 성능 개선
| 지표 | Before | After | 개선율 |
|---|---|---|---|
| **동시 접속** | 500명 | 100,000명+ | 200배 ✅ |
| **응답 시간** | 200ms | 10ms | 20배 빠름 ✅ |
| **DB 부하** | 100% | 1% | 99% 감소 ✅ |
| **월 비용** | $0 | +$10 | 저렴함 ✅ |

### 비즈니스 임팩트
- **동시 시청자 증가**: 500명 → 100,000명 (라이브 커머스 확장 가능)
- **서버 안정성**: DB 병목 제거 → 안정적 서비스
- **사용자 경험**: 빠른 응답 → 이탈률 감소
- **비용 효율성**: $10/월 추가 → ROI 1000% 이상

---

## 🚨 주의사항

### 1. TTL 설정
- **라이브 상세**: 30초 (실시간성 중요)
- **라이브 목록**: 10초 (빠른 갱신)
- **상품 정보**: 60초 (자주 변경 안 됨)

### 2. 캐시 무효화 타이밍
- **즉시 무효화**: 생성, 수정, 삭제
- **자동 만료**: TTL 도달 시

### 3. KV 전파 시간
- **글로벌 복제**: 최대 60초
- **해결책**: TTL을 60초 이하로 설정

### 4. KV 비용
- **Free 플랜**: 100,000 reads/day (무료)
- **Paid 플랜**: $0.50/million reads (매우 저렴)

---

**작성일**: 2026-02-21  
**작성자**: AI Developer  
**예상 구현 시간**: 1~2일  
**우선순위**: ⭐⭐⭐⭐⭐ (가장 높음)
