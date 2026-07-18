/**
 * API Documentation routes (OpenAPI / Swagger UI)
 *
 * GET /api/openapi.json — OpenAPI spec JSON
 * GET /docs            — Swagger UI
 * GET /api/docs        — Swagger UI (alternative path)
 *
 * 🛡️ 2026-04-27: TD-006 partial split — worker/index.ts 인라인 핸들러 제거.
 * 🥗 2026-07-16: 개발자용 API 문서(openapi.ts ~48KB + @hono/swagger-ui)를 __INCLUDE_DOCS__ 게이트로
 *    감싼다. 프로덕션(소비자/도매) 워커 빌드는 이 define 이 false → esbuild DCE 로 openapi.ts +
 *    swagger-ui 를 번들에서 제거(gzip ~10~15KB↓). 문서가 필요하면 DOCS_BUNDLE=1 빌드.
 *    (기존 "동적 import" 는 esbuild 단일파일 번들에선 인라인이라 크기 절감 0 이었음 — 실제 제외엔 DCE 필요.)
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';

// build-worker.js 의 esbuild define 로 치환(기본 false). tsc 용 전역 선언.
declare const __INCLUDE_DOCS__: boolean;

const docsRoutes = new Hono<{ Bindings: Env }>();

if (__INCLUDE_DOCS__) {
  // ⚠️ openapi.ts(~48KB) + @hono/swagger-ui 둘 다 게이트 블록 안에서만 참조 →
  //    프로덕션 빌드(__INCLUDE_DOCS__=false)에선 이 블록 전체가 DCE 되어 번들에서 사라진다.
  //    (top-level import 로 두면 tree-shaking 이 side-effect 판단에 따라 남을 수 있어 동적 import 로 강제 제외.)
  const { openApiSpec } = await import('../openapi');
  const { swaggerUI } = await import('@hono/swagger-ui');
  docsRoutes.get('/api/openapi.json', (c) => c.json(openApiSpec));
  docsRoutes.get('/docs', swaggerUI({ url: '/api/openapi.json' }));
  docsRoutes.get('/api/docs', swaggerUI({ url: '/api/openapi.json' }));
}

export { docsRoutes };
