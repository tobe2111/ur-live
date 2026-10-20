/**
 * 환경 변수 누락 통합 테스트
 * 
 * 이 테스트는 다음을 검증합니다:
 * 1. 필수 환경 변수가 모두 설정되었는지
 * 2. Cloudflare 바인딩이 올바르게 연결되었는지
 * 3. 환경 변수 값이 유효한지
 * 
 * 사용법:
 * ```bash
 * # 로컬 환경 테스트
 * npm run test:env:local
 * 
 * # 프로덕션 환경 테스트 (API 호출)
 * npm run test:env:prod
 * ```
 */

import type { CloudflareBindings } from '../types/env';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

/**
 * 환경 변수 테스트 실행
 */
export async function runEnvTests(env: CloudflareBindings): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // ========================================
  // 1. D1 Database 테스트
  // ========================================
  try {
    if (!env.DB) {
      results.push({
        name: 'D1 Database Binding',
        status: 'fail',
        message: 'DB binding not found',
        details: 'Check wrangler.jsonc d1_databases configuration'
      });
    } else {
      // 간단한 쿼리로 연결 테스트
      await env.DB.prepare('SELECT 1').first();
      results.push({
        name: 'D1 Database Binding',
        status: 'pass',
        message: 'DB connected successfully'
      });
    }
  } catch (error) {
    results.push({
      name: 'D1 Database Binding',
      status: 'fail',
      message: 'DB query failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
  
  // ========================================
  // 2. SESSION_KV 테스트
  // ========================================
  try {
    if (!env.SESSION_KV) {
      results.push({
        name: 'SESSION_KV Binding',
        status: 'fail',
        message: 'SESSION_KV binding not found',
        details: 'Check wrangler.jsonc kv_namespaces configuration'
      });
    } else {
      // 테스트 키로 읽기/쓰기 검증 (TTL 최소 60초)
      const testKey = 'test:env:check';
      await env.SESSION_KV.put(testKey, 'ok', { expirationTtl: 60 });
      const value = await env.SESSION_KV.get(testKey);
      
      if (value === 'ok') {
        results.push({
          name: 'SESSION_KV Binding',
          status: 'pass',
          message: 'SESSION_KV read/write successful'
        });
      } else {
        results.push({
          name: 'SESSION_KV Binding',
          status: 'warn',
          message: 'SESSION_KV write succeeded but read failed'
        });
      }
    }
  } catch (error) {
    results.push({
      name: 'SESSION_KV Binding',
      status: 'fail',
      message: 'SESSION_KV operation failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
  
  // ========================================
  // 3. CACHE_KV 테스트
  // ========================================
  try {
    if (!env.CACHE_KV) {
      results.push({
        name: 'CACHE_KV Binding',
        status: 'fail',
        message: 'CACHE_KV binding not found',
        details: 'Check wrangler.jsonc kv_namespaces configuration'
      });
    } else {
      // 테스트 키로 읽기/쓰기 검증 (TTL 최소 60초)
      const testKey = 'test:cache:check';
      await env.CACHE_KV.put(testKey, 'ok', { expirationTtl: 60 });
      const value = await env.CACHE_KV.get(testKey);
      
      if (value === 'ok') {
        results.push({
          name: 'CACHE_KV Binding',
          status: 'pass',
          message: 'CACHE_KV read/write successful'
        });
      } else {
        results.push({
          name: 'CACHE_KV Binding',
          status: 'warn',
          message: 'CACHE_KV write succeeded but read failed'
        });
      }
    }
  } catch (error) {
    results.push({
      name: 'CACHE_KV Binding',
      status: 'fail',
      message: 'CACHE_KV operation failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
  
  // ========================================
  // 4. TOSS_SECRET_KEY 테스트
  // ========================================
  if (!env.TOSS_SECRET_KEY) {
    results.push({
      name: 'TOSS_SECRET_KEY',
      status: 'fail',
      message: 'TOSS_SECRET_KEY not configured',
      details: 'Run: npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live'
    });
  } else if (!env.TOSS_SECRET_KEY.startsWith('test_gsk_') && !env.TOSS_SECRET_KEY.startsWith('live_gsk_')) {
    results.push({
      name: 'TOSS_SECRET_KEY',
      status: 'warn',
      message: 'TOSS_SECRET_KEY format may be invalid',
      details: 'Expected format: test_gsk_* or live_gsk_*'
    });
  } else {
    results.push({
      name: 'TOSS_SECRET_KEY',
      status: 'pass',
      message: `TOSS_SECRET_KEY configured (${env.TOSS_SECRET_KEY.substring(0, 12)}...)`
    });
  }
  
  // ========================================
  // 5. TOSS_CLIENT_KEY 테스트
  // ========================================
  if (!env.TOSS_CLIENT_KEY) {
    results.push({
      name: 'TOSS_CLIENT_KEY',
      status: 'fail',
      message: 'TOSS_CLIENT_KEY not configured',
      details: 'Run: npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live'
    });
  } else if (!env.TOSS_CLIENT_KEY.startsWith('test_gck_') && !env.TOSS_CLIENT_KEY.startsWith('live_gck_')) {
    results.push({
      name: 'TOSS_CLIENT_KEY',
      status: 'warn',
      message: 'TOSS_CLIENT_KEY format may be invalid',
      details: 'Expected format: test_gck_* or live_gck_*'
    });
  } else {
    results.push({
      name: 'TOSS_CLIENT_KEY',
      status: 'pass',
      message: `TOSS_CLIENT_KEY configured (${env.TOSS_CLIENT_KEY.substring(0, 12)}...)`
    });
  }
  
  // ========================================
  // 6. FIREBASE_PRIVATE_KEY 테스트 🔥
  // ========================================
  if (!env.FIREBASE_PRIVATE_KEY) {
    results.push({
      name: 'FIREBASE_PRIVATE_KEY',
      status: 'fail',
      message: 'FIREBASE_PRIVATE_KEY not configured',
      details: 'Add FIREBASE_PRIVATE_KEY in Cloudflare Dashboard → ur-live → Settings → Environment variables'
    });
  } else if (!env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
    results.push({
      name: 'FIREBASE_PRIVATE_KEY',
      status: 'warn',
      message: 'FIREBASE_PRIVATE_KEY format may be invalid',
      details: 'Expected format: -----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n'
    });
  } else {
    results.push({
      name: 'FIREBASE_PRIVATE_KEY',
      status: 'pass',
      message: `FIREBASE_PRIVATE_KEY configured (${env.FIREBASE_PRIVATE_KEY.length} chars)`
    });
  }
  
  // ========================================
  // 7. FIREBASE_CLIENT_EMAIL 테스트 🔥
  // ========================================
  if (!env.FIREBASE_CLIENT_EMAIL) {
    results.push({
      name: 'FIREBASE_CLIENT_EMAIL',
      status: 'fail',
      message: 'FIREBASE_CLIENT_EMAIL not configured',
      details: 'Add FIREBASE_CLIENT_EMAIL in Cloudflare Dashboard → ur-live → Settings → Environment variables'
    });
  } else if (!env.FIREBASE_CLIENT_EMAIL.includes('@') || !env.FIREBASE_CLIENT_EMAIL.includes('iam.gserviceaccount.com')) {
    results.push({
      name: 'FIREBASE_CLIENT_EMAIL',
      status: 'warn',
      message: 'FIREBASE_CLIENT_EMAIL format may be invalid',
      details: 'Expected format: *@*.iam.gserviceaccount.com'
    });
  } else {
    results.push({
      name: 'FIREBASE_CLIENT_EMAIL',
      status: 'pass',
      message: `FIREBASE_CLIENT_EMAIL configured: ${env.FIREBASE_CLIENT_EMAIL}`
    });
  }
  
  // ========================================
  // 8. FIREBASE_PROJECT_ID 테스트 🔥
  // ========================================
  if (!env.FIREBASE_PROJECT_ID) {
    results.push({
      name: 'FIREBASE_PROJECT_ID',
      status: 'fail',
      message: 'FIREBASE_PROJECT_ID not configured',
      details: 'Add FIREBASE_PROJECT_ID in Cloudflare Dashboard → ur-live → Settings → Environment variables'
    });
  } else {
    results.push({
      name: 'FIREBASE_PROJECT_ID',
      status: 'pass',
      message: `FIREBASE_PROJECT_ID configured: ${env.FIREBASE_PROJECT_ID}`
    });
  }
  
  // ========================================
  // 9. FIREBASE_DATABASE_URL 테스트 🔥
  // ========================================
  if (!env.FIREBASE_DATABASE_URL) {
    results.push({
      name: 'FIREBASE_DATABASE_URL',
      status: 'fail',
      message: 'FIREBASE_DATABASE_URL not configured',
      details: 'Add FIREBASE_DATABASE_URL in Cloudflare Dashboard → ur-live → Settings → Environment variables'
    });
  } else if (!env.FIREBASE_DATABASE_URL.startsWith('https://') || !env.FIREBASE_DATABASE_URL.includes('firebaseio.com')) {
    results.push({
      name: 'FIREBASE_DATABASE_URL',
      status: 'warn',
      message: 'FIREBASE_DATABASE_URL format may be invalid',
      details: 'Expected format: https://*.firebaseio.com'
    });
  } else {
    results.push({
      name: 'FIREBASE_DATABASE_URL',
      status: 'pass',
      message: `FIREBASE_DATABASE_URL configured: ${env.FIREBASE_DATABASE_URL}`
    });
  }
  
  return results;
}

/**
 * 테스트 결과 포맷팅
 */
export function formatTestResults(results: TestResult[]): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('========================================');
  lines.push('환경 변수 테스트 결과');
  lines.push('========================================');
  lines.push('');
  
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
    lines.push(`${icon} ${result.name}: ${result.message}`);
    
    if (result.details) {
      lines.push(`   → ${result.details}`);
    }
    
    if (result.status === 'pass') passCount++;
    if (result.status === 'warn') warnCount++;
    if (result.status === 'fail') failCount++;
  }
  
  lines.push('');
  lines.push('========================================');
  lines.push(`총 ${results.length}개 테스트:`);
  lines.push(`  ✅ 성공: ${passCount}`);
  if (warnCount > 0) lines.push(`  ⚠️  경고: ${warnCount}`);
  if (failCount > 0) lines.push(`  ❌ 실패: ${failCount}`);
  lines.push('========================================');
  lines.push('');
  
  if (failCount > 0) {
    lines.push('❌ 환경 변수 설정이 완료되지 않았습니다.');
    lines.push('자세한 내용은 ENV_SETUP_GUIDE.md를 참고하세요.');
  } else if (warnCount > 0) {
    lines.push('⚠️  일부 경고가 있지만 배포는 가능합니다.');
  } else {
    lines.push('✅ 모든 환경 변수가 올바르게 설정되었습니다!');
  }
  
  return lines.join('\n');
}

/**
 * API 엔드포인트: /api/test/env
 * 
 * 환경 변수 테스트 결과를 JSON으로 반환
 */
export async function handleEnvTestRequest(env: CloudflareBindings) {
  const results = await runEnvTests(env);
  
  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  
  return {
    success: failCount === 0,
    summary: {
      total: results.length,
      pass: passCount,
      warn: warnCount,
      fail: failCount
    },
    results,
    formatted: formatTestResults(results)
  };
}
