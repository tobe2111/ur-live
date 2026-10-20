# Worker Bundle Size Audit

작성: 2026-05-18

## 현재 상태 (minify 적용 후)

- **`_worker.js`**: 2,128,815 bytes ≈ **2.0 MB** (gzip 후 ≈ 500KB)
- **한도**: 4 MB (`main.yml` line 84)
- **여유**: 약 2 MB (50%)

## Top Contributors (minify 전 분석, 참고용)

| 순위 | 크기 (KB) | 파일 | 노트 |
|---|---|---|---|
| 1 | 156.3 | `src/features/youtube/api/youtube-live.routes.ts` | YouTube live stream — 핵심 기능 |
| 2 | 128.1 | `node_modules/zod/v3/types.js` | 외부 lib — 7 파일에서 사용 |
| 3 | 87.4 | `src/features/guides/api/guide-seed.ts` | ✅ dynamic import 적용 |
| 4 | 81.1 | `src/worker/index.ts` | 라우트 mount 본체 |
| 5 | 55.6 | `node_modules/bcryptjs/dist/bcrypt.js` | password hashing |
| 6 | 48.9 | `src/worker/cron/scheduled-cleanup.ts` | ✅ dynamic import 적용 |
| 7 | 48.4 | `src/worker/openapi.ts` | ✅ dynamic import 적용 |
| 8 | 45.1 | `src/features/seller/api/seller-orders.routes.ts` | 핵심 — 정적 유지 |
| 9 | 43.4 | `src/features/agency/api/agency.routes.ts` | 에이전시 핵심 |
| 10 | 41.6 | `src/features/group-buy/api/group-buy.routes.ts` | 공구 핵심 |

## 적용된 최적화

### 1. esbuild minify 활성화 (2026-05-18) — **-33% (1.0MB 절감)**

`scripts/build-worker.js`:
- `minify: false` → `minify: true`
- 결과: 3.0 MB → 2.0 MB

### 2. Dynamic import (효과 미미 — single bundle 제약)

Cloudflare Workers 는 single bundle 만 지원 → esbuild splitting 활성화 불가.
dynamic import 는 코드 안 합쳐지나 esbuild 가 모두 inline → 실제 크기 감소 X.

그러나 **첫 호출까지 지연 로딩** 은 가능 (런타임 메모리 효율):
- `guide-seed.ts` (87KB) — admin guide 첫 진입 시
- `openapi.ts` (48KB) — `/api/openapi.json` 첫 호출 시
- `scheduled-cleanup.ts` (49KB) — cron 5분마다

## 향후 추가 최적화 옵션

### 🟡 외부 lib 교체

| Lib | 현재 | 대안 | 절감 예상 |
|---|---|---|---|
| **zod** (128KB) | 7개 파일에서 사용 | `valibot` (~10KB), 또는 inline validation | ~100KB |
| **bcryptjs** (56KB) | password hashing | Workers Crypto API (SubtleCrypto.digest) + custom salt | ~50KB |
| `swagger-ui` (사용 빈도 낮음) | dynamic import 적용 안 됨 | 별도 정적 파일로 | ~20KB |

### 🟢 코드 분할 (사용 빈도 낮은 routes)

이미 dynamic import 한 항목 외 추가 후보:
- `blog.routes.ts` (33KB) — 블로그 페이지 적게 호출
- `repair-schema.routes.ts` (32KB) — 응급용
- `internal-admin-tools.routes.ts` (35KB) — 어드민 응급용

**단**: Hono 의 `app.route()` 는 정적 mount 필요 → routes 자체는 dynamic 불가.
→ routes 내부 핸들러에서 무거운 의존성을 dynamic import 로 분리.

### ⚪ 장기 (구조 개선)

- Worker 를 multiple Service Bindings 으로 분리 (admin / public / cron 각각)
- 사용 안 하는 endpoint deprecation
- features/ 디렉토리 audit (사용 안 하는 routes)

## 검증 명령

```bash
# 빌드 후 크기 확인
npm run build && stat -c%s dist/client/_worker.js

# Top contributors 분석 (minify 전, esbuild metafile)
node ./scripts/analyze-worker-bundle.cjs  # (별도 구현 시)
```

## 한도 관련

- **현재 4MB** (main.yml line 84)
- **Cloudflare Workers Free plan**: 1MB compressed (≈4MB uncompressed)
- **Paid plan**: 10MB uncompressed
- 현재 2MB uncompressed → 압축 시 ≈500KB → Free 한도 안전

## 모니터링

- 각 PR 마다 빌드 결과 자동 보고 (main.yml line 78-94)
- 4MB 초과 시 deploy 차단
- 80% 도달 시 (3.2MB) 경고 추가 권장 (TODO)
