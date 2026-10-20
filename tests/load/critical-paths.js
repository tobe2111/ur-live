/**
 * k6 Load Test — 핵심 경로 성능 검증
 *
 * 실행:
 *   k6 run tests/load/critical-paths.js --env BASE_URL=https://live.ur-team.com
 *
 * 스테이징 대상:
 *   k6 run tests/load/critical-paths.js --env BASE_URL=https://ur-live-staging.pages.dev
 *
 * 설치: brew install k6  또는  https://k6.io/docs/get-started/installation/
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── 커스텀 메트릭 ────────────────────────────────────────────────────────────
const homeErrorRate      = new Rate('home_errors');
const productsErrorRate  = new Rate('products_errors');
const streamsErrorRate   = new Rate('streams_errors');
const healthErrorRate    = new Rate('health_errors');
const authGuardRate      = new Rate('auth_guard_401');

const homeDuration       = new Trend('home_duration',     true);
const productsDuration   = new Trend('products_duration', true);
const streamsDuration    = new Trend('streams_duration',  true);
const healthDuration     = new Trend('health_duration',   true);

// ─── 테스트 옵션 ─────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // 1. 홈페이지 — 100 VU, 30s
    homepage: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30s',
      exec: 'testHomepage',
    },
    // 2. 상품 목록 — 100 VU, 30s (KV 캐시 히트 기대)
    products: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30s',
      exec: 'testProducts',
    },
    // 3. 라이브 스트림 목록 — 50 VU, 30s
    streams: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      exec: 'testStreams',
    },
    // 4. 헬스 체크 — 10 VU, 30s
    health: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'testHealth',
    },
    // 5. 인증 가드 — 20 VU, 30s (인증 없이 → 401 검증)
    auth_guard: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30s',
      exec: 'testAuthGuard',
    },
  },

  thresholds: {
    // 전체 요청 기준
    http_req_duration:  ['p(95)<2000'],   // p95 < 2s
    http_req_failed:    ['rate<0.01'],    // 에러율 < 1%

    // 경로별 기준
    home_duration:      ['p(95)<500'],    // 홈: p95 < 500ms
    products_duration:  ['p(95)<200'],    // 상품 목록: p95 < 200ms (캐시)
    streams_duration:   ['p(95)<500'],    // 스트림: p95 < 500ms
    health_duration:    ['p(95)<50'],     // 헬스: p95 < 50ms

    // 에러율
    home_errors:        ['rate<0.01'],
    products_errors:    ['rate<0.01'],
    streams_errors:     ['rate<0.01'],
    health_errors:      ['rate<0.001'],   // 헬스 체크는 거의 0 에러

    // 인증 가드: 인증 없는 요청이 401 반환하는 비율 > 99%
    auth_guard_401:     ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://live.ur-team.com';

// ─── 시나리오 함수 ────────────────────────────────────────────────────────────

/** 1. 홈페이지 */
export function testHomepage() {
  const res = http.get(`${BASE_URL}/`, {
    tags: { name: 'homepage' },
  });

  const ok = check(res, {
    'homepage 200': (r) => r.status === 200,
    'homepage < 500ms': (r) => r.timings.duration < 500,
  });

  homeDuration.add(res.timings.duration);
  homeErrorRate.add(!ok);

  sleep(0.5 + Math.random() * 0.5);
}

/** 2. 상품 목록 API */
export function testProducts() {
  const res = http.get(`${BASE_URL}/api/products?limit=20`, {
    tags: { name: 'products' },
  });

  const ok = check(res, {
    'products 200': (r) => r.status === 200,
    'products body is JSON': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
    'products < 200ms': (r) => r.timings.duration < 200,
  });

  productsDuration.add(res.timings.duration);
  productsErrorRate.add(!ok);

  sleep(0.5);
}

/** 3. 라이브 스트림 목록 */
export function testStreams() {
  const res = http.get(`${BASE_URL}/api/streams/live`, {
    tags: { name: 'streams' },
  });

  // 스트림 없을 때 200 + 빈 배열도 정상
  const ok = check(res, {
    'streams 200': (r) => r.status === 200,
    'streams < 500ms': (r) => r.timings.duration < 500,
  });

  streamsDuration.add(res.timings.duration);
  streamsErrorRate.add(!ok);

  sleep(1);
}

/** 4. 헬스 체크 */
export function testHealth() {
  const res = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health' },
  });

  const ok = check(res, {
    'health 200': (r) => r.status === 200,
    'health < 50ms': (r) => r.timings.duration < 50,
  });

  healthDuration.add(res.timings.duration);
  healthErrorRate.add(!ok);

  sleep(1);
}

/** 5. 인증 가드 — 인증 없이 보호된 엔드포인트 호출 시 401 반환 확인 */
export function testAuthGuard() {
  const protectedEndpoints = [
    '/api/user/profile',
    '/api/user/orders',
    '/api/seller/dashboard',
    '/api/admin/users',
  ];

  const endpoint = protectedEndpoints[Math.floor(Math.random() * protectedEndpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, {
    tags: { name: 'auth_guard' },
    // 인증 헤더 없음 — 의도적
  });

  const is401 = check(res, {
    'unauthenticated → 401': (r) => r.status === 401,
    'no sensitive data leaked': (r) => {
      // 응답 본문에 비밀 데이터 패턴이 없어야 함
      const body = r.body || '';
      return !body.includes('password') && !body.includes('secret') && !body.includes('jwt');
    },
  });

  authGuardRate.add(res.status === 401);

  sleep(0.5);
}

// ─── 셋업 / 정리 ─────────────────────────────────────────────────────────────

export function setup() {
  console.log(`\n==> k6 핵심 경로 로드 테스트 시작`);
  console.log(`    대상: ${BASE_URL}`);

  // 사전 워밍업: 헬스 체크로 서버 상태 확인
  const warmup = http.get(`${BASE_URL}/api/health`);
  if (warmup.status !== 200) {
    console.log(`⚠️  헬스 체크 실패 (${warmup.status}) — 서버 상태 확인 필요`);
  } else {
    console.log(`    헬스 체크 OK (${warmup.timings.duration.toFixed(0)}ms)`);
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const elapsed = ((Date.now() - data.startTime) / 1000).toFixed(1);
  console.log(`\n==> 테스트 완료 (${elapsed}s)`);
  console.log(`    결과 해석:`);
  console.log(`      p95 < 2s, 에러율 < 1%  → 정상`);
  console.log(`      p95 > 2s 또는 에러율 > 1%  → 조사 필요`);
  console.log(`      auth_guard_401 < 99%  → 보안 구멍 (즉시 확인)`);
}
