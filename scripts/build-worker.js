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
