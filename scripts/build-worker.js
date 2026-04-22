#!/usr/bin/env node

const esbuild = require('esbuild');
const path = require('path');

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
      minify: false,  // Disable for debugging
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
      },
      logLevel: 'info',
      metafile: true,
    });

    console.log('✅ Worker bundle created successfully at dist/_worker.js');
  } catch (error) {
    console.error('❌ Worker build failed:', error);
    process.exit(1);
  }
}

buildWorker();
