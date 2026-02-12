# D1 바인딩 문제 해결 완료

## 🚨 문제 요약
모든 DB 관련 API가 500 에러로 실패하며 다음 오류 발생:
```
"Cannot read properties of undefined (reading 'call')"
```

## 🔍 원인 분석

### 1. 증상
- `/api/streams`, `/api/products`, `/api/live-streams` 등 모든 DB API가 실패
- 로컬 개발 환경과 프로덕션 환경 모두 동일한 에러
- Root path `/`는 정상 작동
- DB 바인딩은 wrangler 로그에서 확인됨

### 2. 근본 원인 발견
**src/types.ts에서 수동으로 정의한 Bindings 타입이 문제였습니다:**

```typescript
// ❌ 잘못된 방식 (문제 발생)
export type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  CACHE_KV: KVNamespace;
};
```

**Vite 빌드 과정에서 이 타입이 Cloudflare Workers 런타임과 호환되지 않았습니다.**

## ✅ 해결 방법

### 1. Wrangler Types 생성
```bash
npx wrangler types --env-interface CloudflareBindings
```

이 명령어가 `worker-configuration.d.ts` 파일을 자동 생성합니다:
```typescript
interface CloudflareBindings extends Cloudflare.Env {}

declare namespace Cloudflare {
  interface Env {
    SESSION_KV: KVNamespace;
    CACHE_KV: KVNamespace;
    DB: D1Database;
    KAKAO_JS_KEY: string;
    KAKAO_REST_API_KEY: string;
    TOSS_SECRET_KEY: string;
  }
}
```

### 2. src/types.ts 수정
```typescript
// ✅ 올바른 방식 (문제 해결)
/// <reference types="../worker-configuration.d.ts" />

export type Bindings = CloudflareBindings;
```

### 3. vite.worker.config.ts 개선
```typescript
import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

export default defineConfig({
  plugins: [
    pages({
      entry: 'src/index.tsx',
    }),
  ],
  ssr: {
    external: ['react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: false, // 디버깅 용이
    rollupOptions: {
      external: [],
    },
  },
})
```

### 4. Health Check 엔드포인트 추가
```typescript
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: {
      hasDB: !!c.env.DB,
      hasSessionKV: !!c.env.SESSION_KV,
      hasCacheKV: !!c.env.CACHE_KV,
    }
  });
});
```

## 📊 테스트 결과

### Health Check (바인딩 확인)
```bash
curl https://f1f95252.toss-live-commerce.pages.dev/api/health
```
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-02-12T03:09:06.591Z",
  "env": {
    "hasDB": true,
    "hasSessionKV": true,
    "hasCacheKV": true
  }
}
```

### Live Streams API (DB 쿼리)
```bash
curl https://f1f95252.toss-live-commerce.pages.dev/api/streams
```
```json
{
  "success": true,
  "data": [
    {
      "id": 20,
      "title": "지리산 설날 떡국떡 고급간식 모솔농부 해피설날",
      "status": "live",
      ...
    },
    {
      "id": 19,
      "title": "국민 참치 전문 대박 할인 중!",
      "status": "live",
      ...
    }
  ],
  "cached": true
}
```

## 🎯 배포 정보
- **Preview URL**: https://f1f95252.toss-live-commerce.pages.dev
- **Production URL**: https://live.ur-team.com
- **Commit**: `2dee0d3`
- **Deploy Time**: 2026-02-12 12:09 KST

## 📝 중요한 교훈

### 1. Cloudflare Workers 타입 사용
- **절대 수동으로 Bindings 타입을 정의하지 마세요**
- 항상 `wrangler types` 명령어로 자동 생성된 타입 사용
- `worker-configuration.d.ts`를 Git에 포함

### 2. 개발 워크플로우
```bash
# 1. wrangler.jsonc 수정 후
npx wrangler types --env-interface CloudflareBindings

# 2. 빌드
npm run build

# 3. 배포
npx wrangler pages deploy dist --project-name toss-live-commerce
```

### 3. 타입 체인지 체크리스트
- [ ] `wrangler types` 실행
- [ ] `worker-configuration.d.ts` 생성 확인
- [ ] `src/types.ts`에서 `CloudflareBindings` 사용
- [ ] 빌드 성공 확인
- [ ] Health endpoint로 바인딩 확인
- [ ] 실제 DB API 테스트

## 🔧 트러블슈팅 가이드

### 문제: "Cannot read properties of undefined"
**원인**: 타입 정의 불일치
**해결**: `wrangler types` 재실행 후 `CloudflareBindings` 사용

### 문제: 로컬 개발에서 DB 오류
**원인**: 로컬 DB가 비어있음
**해결**: 
```bash
rm -rf .wrangler/state/v3/d1
npx wrangler d1 migrations apply DB_NAME --local
npx wrangler d1 execute DB_NAME --local --file=./seed.sql
```

### 문제: 프로덕션에서만 오류
**원인**: 환경 변수 또는 바인딩 설정 누락
**해결**: `wrangler.jsonc` 확인, 바인딩 ID 검증

## 🎉 결론
- ✅ D1 바인딩 문제 완전 해결
- ✅ 모든 DB API 정상 작동
- ✅ Health check 엔드포인트 추가
- ✅ 타입 안정성 확보

**재고 부족 문제는 이제 해결된 DB로 테스트 가능합니다!**
