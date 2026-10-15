#!/usr/bin/env node

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// 🧊 2026-10-15 상세 서버 렌더 — `virtual:pass-ssr` 를 실제 번들(있으면) 또는 스텁으로 푼다.
//   번들은 `npm run build:ssr-pass`(vite.ssr-pass.config.ts) 가 만든다. 없으면 스텁 → 워커는 종전 손그림 첫 화면.
const PASS_SSR_BUNDLE = path.resolve(__dirname, '../dist/ssr-pass/pass-detail-entry.js');
const passSsrPlugin = {
  name: 'pass-ssr',
  setup(b) {
    b.onResolve({ filter: /^virtual:pass-ssr$/ }, () => ({
      path: fs.existsSync(PASS_SSR_BUNDLE) ? PASS_SSR_BUNDLE : path.resolve(__dirname, '../src/worker/ssr/pass-ssr-stub.ts'),
    }));
  },
};

// 🏭 [wholesale-split 2026-07-16] 도매(features/supply) 라우트 포함 여부 — esbuild define 로 index.ts 에 주입.
// 🧨 2026-10-11 도매몰 철거(대표 "도매몰 잔해들은 아예 다 삭제해줘"): 도매 번들이 없어졌으므로 **항상 false**.
//   ⚠️ define 자체는 **남긴다** — `worker/index.ts` 가 `declare const __INCLUDE_WHOLESALE__` 로 쓰고 있고,
//   define 을 빼면 esbuild 가 그 식별자를 그대로 남겨 **런타임 ReferenceError** 가 된다. 그리고 그 식별자가
//   cron no-op 게이트의 항이라 극성이 걸려 있다("=== true 만 no-op, 느슨하면 소비자 cron 사망").
//   ⇒ 게이트는 건드리지 않고 입력만 상수 false 로 고정한다(종전 소비자 빌드와 byte-동일한 결과).
const INCLUDE_WHOLESALE = false;

// 🥗 [docs-split 2026-07-16] 개발자용 API 문서(OpenAPI spec ~48KB + @hono/swagger-ui) 포함 여부.
//   - 프로덕션(소비자/도매): DOCS_BUNDLE 미설정 → false → docs.routes.ts 의 if(__INCLUDE_DOCS__) 블록 DCE
//     → openapi.ts + swagger-ui 번들 제외(gzip ~10~15KB↓). /docs·/api/openapi.json 은 프로덕션 미노출.
//   - 문서 필요 시: DOCS_BUNDLE=1 npm run build.
const INCLUDE_DOCS = process.env.DOCS_BUNDLE === '1';

async function buildWorker() {
  try {
    console.log('🔧 Building Worker bundle...');

    await esbuild.build({
      entryPoints: ['src/worker/index.ts'],
      bundle: true,
      outfile: 'dist/_worker.js',
      format: 'esm',
      platform: 'neutral', // Changed from 'browser' to 'neutral' for Workers
      target: 'es2022',
      // 🛡️ 2026-05-18: minify 활성화 — _worker.js 크기 ~40% 감소 (3.0MB → 1.8MB 예상).
      //   debugging 필요 시: minify: false + sourcemap: true.
      minify: true,
      sourcemap: false,
      // Exclude Node.js built-ins and packages that use them
      external: [
        'node:*',
        'cloudflare:*',
        'firebase-admin',
        'google-auth-library',
        '@google-cloud/*',
        '@fastify/busboy',
        'node-fetch'
      ],
      conditions: ['worker', 'browser'],
      mainFields: ['browser', 'module', 'main'],
      define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'globalThis',
        // 2026-04-22: Vite의 import.meta.env.* 상수를 Worker esbuild 번들에서 치환.
        // 미치환 시 런타임에 undefined 접근으로 crash (admin/seller/user/agency 로그인 500 사고).
        // 22개 파일에 분산된 import.meta.env.DEV 를 일괄 해결.
        'import.meta.env.DEV': 'false',
        'import.meta.env.PROD': 'true',
        'import.meta.env.MODE': '"production"',
        'import.meta.env.SSR': 'true',
        // 🏭 [wholesale-split] 도매 라우트 트리셰이킹 스위치 (index.ts 의 __INCLUDE_WHOLESALE__).
        '__INCLUDE_WHOLESALE__': INCLUDE_WHOLESALE ? 'true' : 'false',
        // 🥗 [docs-split] OpenAPI/Swagger 문서 트리셰이킹 스위치 (docs.routes.ts 의 __INCLUDE_DOCS__).
        '__INCLUDE_DOCS__': INCLUDE_DOCS ? 'true' : 'false',
        // 📦 2026-10-11 [cron-split] 이 산출물(_worker.js)은 **Pages** 에만 올라간다 — Pages 는 cron 을 부르지 않는다
        //   (cron 은 `wrangler deploy` 로 올리는 별도 워커가 wrangler.toml 로 직접 번들한다). 그래서 scheduled 를
        //   no-op 으로 묶어 크론 전용 코드 그래프를 통째로 DCE — 워커 gzip 약 56KB↓(무료 1MB 압축 게이트 여유).
        //   극성: index.ts 는 `=== true` 일 때만 no-op, 미정의는 실제 핸들러(cron 워커가 조용히 죽지 않게).
        '__PAGES_BUNDLE__': 'true',
        // 🧊 상세 서버 렌더 캐시 키 — 배포마다 바뀐다(옛 번들이 그린 HTML 을 새 앱에 주지 않는다).
        '__SSR_BUILD__': JSON.stringify(String(Date.now())),
      },
      logLevel: 'info',
      metafile: true,
      plugins: [passSsrPlugin],
    });

    console.log('✅ Worker bundle created successfully at dist/_worker.js');
  } catch (error) {
    console.error('❌ Worker build failed:', error);
    process.exit(1);
  }
}

buildWorker();
