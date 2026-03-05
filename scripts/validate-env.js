#!/usr/bin/env node

/**
 * ✅ 환경 변수 검증 스크립트
 * 
 * Week 5 Day 2 - 환경 변수 검증 레이어
 * 
 * 사용:
 * npm run validate:env
 * npm run validate:env:kr
 * npm run validate:env:world
 */

const { z } = require('zod');
const path = require('path');
const fs = require('fs');

// ============================================
// .env 파일 로드
// ============================================
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  .env 파일을 찾을 수 없습니다: ${filePath}`);
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};

  content.split('\n').forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    env[key.trim()] = value.replace(/^["']|["']$/g, '');
  });

  return env;
}

// ============================================
// 환경 변수 스키마 (간단한 버전)
// ============================================
const commonEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
});

const krEnvSchema = commonEnvSchema.extend({
  VITE_KAKAO_REST_API_KEY: z.string().min(1),
  VITE_KAKAO_JAVASCRIPT_KEY: z.string().min(1),
  VITE_TOSS_CLIENT_KEY: z.string().min(1),
});

const worldEnvSchema = commonEnvSchema.extend({
  VITE_GOOGLE_CLIENT_ID: z.string().min(1),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
});

// ============================================
// 검증 실행
// ============================================
function validateEnv(region) {
  console.log(`\n🔍 환경 변수 검증 시작 (Region: ${region})\n`);

  // .env 파일 로드
  const envPath = path.resolve(process.cwd(), '.env');
  const env = { ...process.env, ...loadEnv(envPath) };

  // 스키마 선택
  const schema = region === 'KR' ? krEnvSchema : worldEnvSchema;

  try {
    schema.parse(env);
    console.log(`✅ ${region} 환경 변수 검증 성공!\n`);
    process.exit(0);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`❌ ${region} 환경 변수 검증 실패:\n`);
      error.errors.forEach((err) => {
        console.error(`  • ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\n');
      process.exit(1);
    }
    throw error;
  }
}

// ============================================
// CLI 실행
// ============================================
const args = process.argv.slice(2);
const region = args[0] === 'world' ? 'GLOBAL' : 'KR';

validateEnv(region);
