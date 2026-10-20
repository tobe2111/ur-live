# 🎯 프로덕션 D1 바인딩 문제 해결 완료

**날짜**: 2026-03-16  
**작업자**: Claude AI  
**심각도**: 🔴 CRITICAL → ✅ RESOLVED  
**문제**: 모든 API가 `env.DB is undefined` 에러로 500 응답

---

## 📊 **문제 상황**

### 증상
```json
{
  "success": false,
  "error": "Cannot read properties of undefined (reading 'prepare')"
}
```

- 모든 `/api/products` 및 `/api/streams` 엔드포인트가 500 오류
- 프론트엔드에서 무한 로딩
- 브라우저 콘솔에 반복적인 "AxiosError: Request failed with status code 500"

### 근본 원인
**Cloudflare Pages Workers에서 D1 바인딩이 런타임에 전달되지 않음**

```typescript
const { DB } = c.env;  // undefined! ❌
const service = new ProductService(DB);  // TypeError!
```

---

## 🔍 **문제 진단 과정**

### 1단계: Cloudflare 프로젝트 조사
```bash
curl "https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects" | jq
```

**발견**:
- `ur-live-working` 프로젝트가 `live.ur-team.com` 도메인에 연결됨
- Cloudflare API로 D1 바인딩 추가했지만 여전히 작동하지 않음

### 2단계: 디버그 엔드포인트 추가
```typescript
app.get('/api/debug/bindings', (c) => {
  const env = c.env as Env;
  return c.json({
    hasDB: !!env.DB,  // false ❌
    envKeys: Object.keys(env || {}),
  });
});
```

**결과**: `hasDB: false` — D1이 런타임에 없음!

### 3단계: wrangler.toml 검토
```toml
# Top level (개발 환경용)
[[d1_databases]]
binding = "DB"
database_id = "d9530ba6-7a26-4c02-9295-3ce5aef112a3"

# [env.production] — ❌ D1 바인딩 없음!
[env.production]
name = "global-marketplace"
vars = { ENVIRONMENT = "production", ... }
```

**Wrangler Warning**:
```
"d1_databases" exists at the top level, but not on "env.production".
This is not what you probably want, since "d1_databases" is not inherited by environments.
Please add "d1_databases" to "env.production".
```

**핵심 이슈**: Cloudflare Workers 환경 설정은 상위 레벨에서 상속되지 않음! 각 환경마다 명시적으로 정의해야 함.

---

## ✅ **해결 방법**

### 수정: `wrangler.toml`

```toml
# ============================================================
# [env.production] — override vars for production
# ============================================================
[env.production]
name = "global-marketplace"
vars = { ENVIRONMENT = "production", FRONTEND_URL = "https://live.ur-team.com", REGION = "KR" }

# D1 Database binding for production
[[env.production.d1_databases]]
binding = "DB"
database_name = "toss-live-commerce-db"
database_id = "d9530ba6-7a26-4c02-9295-3ce5aef112a3"
```

### 재배포
```bash
npx wrangler pages deploy dist/client --project-name=ur-live-working --branch=main
```

### 검증
```bash
curl https://live.ur-team.com/api/debug/bindings | jq
```

**결과**:
```json
{
  "hasDB": true,  ✅
  "envKeys": [..., "DB", ...]
}
```

---

## 🎉 **최종 결과**

### API 테스트 성공 ✅

#### 1. Products API
```bash
curl https://live.ur-team.com/api/products?limit=2
```

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": 22,
      "name": "프리미엄 무선 이어폰",
      "price": 30000,
      "status": "ACTIVE",
      ...
    },
    ...
  ],
  "pagination": {
    "total": 11,
    "totalPages": 6
  }
}
```

✅ **200 OK**  
✅ 상품 데이터 정상 반환  
✅ `env.DB` 정상 작동

#### 2. Health Check
```bash
curl https://live.ur-team.com/api/health
```

**응답**:
```json
{
  "status": "ok",
  "timestamp": "2026-03-16T08:15:00.000Z",
  "version": "2.0.0",
  "environment": "production"
}
```

---

## 📝 **교훈 및 Best Practices**

### 1. Cloudflare Workers 환경 설정
- **환경별 바인딩은 상속되지 않음**
- 각 `[env.*]` 섹션에 명시적으로 정의해야 함
- Top-level 설정은 기본 개발 환경에만 적용됨

### 2. 디버깅 전략
- 런타임 환경 정보를 확인하는 디버그 엔드포인트 추가
- `Object.keys(env)` 로 실제 전달된 바인딩 확인
- Wrangler warning 메시지를 신중히 검토

### 3. Cloudflare Pages vs Workers
- **Pages**: `wrangler.toml` 설정이 **중요**
- **Dashboard 바인딩**: Pages에서는 제한적, `wrangler.toml`이 우선
- **배포 시**: `--project-name` 정확히 지정 (ur-live-working)

### 4. 프로덕션 배포 체크리스트
- [ ] `wrangler.toml`에서 `[env.production]` 섹션 확인
- [ ] 모든 필요한 바인딩 (D1, KV, DO 등) 명시
- [ ] Wrangler warning 확인 및 해결
- [ ] 디버그 엔드포인트로 런타임 검증
- [ ] 실제 API 테스트

---

## 🔗 **관련 파일**

- `wrangler.toml` — D1 바인딩 설정 추가
- `src/worker/index.ts` — 디버그 엔드포인트 추가
- `src/features/products/repositories/ProductRepository.ts` — D1 사용
- `scripts/build-worker.js` — Worker 빌드 스크립트

---

## 🚀 **다음 단계**

1. ✅ Products API 복구 완료
2. 🔄 Streams API 문제 조사 (`Failed to fetch streams`)
3. 🔄 KV 바인딩 추가 검토 (SESSION_KV, CACHE_KV)
4. 📝 프로덕션 환경 변수 검증 (모든 secret_text 채워졌는지 확인)
5. 🧪 전체 API 엔드포인트 테스트

---

## 📚 **참고 문서**

- [Cloudflare Workers Configuration](https://developers.cloudflare.com/workers/configuration/)
- [D1 Bindings Documentation](https://developers.cloudflare.com/d1/platform/bindings/)
- [Pages Functions Environment Variables](https://developers.cloudflare.com/pages/functions/bindings/)

---

**문제 해결 완료!** 🎉  
이제 `live.ur-team.com`에서 Products API가 정상 작동합니다!
