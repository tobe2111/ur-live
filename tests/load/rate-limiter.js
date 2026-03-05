/**
 * k6 Load Test: Rate Limiter Stress Test
 * 
 * Purpose: Verify rate limiter blocks excessive requests
 * 
 * Scenarios:
 * 1. Normal load (within limits)
 * 2. Burst traffic (exceeds limits)
 * 3. Sustained high traffic (DDoS simulation)
 * 
 * Run: k6 run tests/load/rate-limiter.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const rateLimitErrors = new Rate('rate_limit_errors');

// Configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 200 },  // Spike to 200 users (exceed limits)
    { duration: '1m', target: 200 },   // Stay at 200 users
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be < 500ms
    http_req_failed: ['rate<0.1'],    // Less than 10% of requests should fail (excluding rate limits)
    rate_limit_errors: ['rate<0.5'],  // Less than 50% should be rate limited at peak
  },
};

// Base URL (override with environment variable)
const BASE_URL = __ENV.BASE_URL || 'https://ur-team.com';

/**
 * Main test function
 */
export default function () {
  const endpoints = [
    '/api/products',
    '/api/products/1',
    '/health',
  ];

  // Pick a random endpoint
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const url = `${BASE_URL}${endpoint}`;

  // Make request
  const response = http.get(url, {
    headers: {
      'User-Agent': 'k6-load-test',
    },
  });

  // Check response
  const isSuccess = check(response, {
    'status is 200': (r) => r.status === 200,
    'status is not 500': (r) => r.status !== 500,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Track rate limit errors
  const isRateLimited = response.status === 429;
  rateLimitErrors.add(isRateLimited);

  if (isRateLimited) {
    console.log(`⚠️ Rate limited: ${endpoint}`);
    
    // Check rate limit headers
    check(response, {
      'has X-RateLimit-Limit header': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
      'has X-RateLimit-Remaining header': (r) => r.headers['X-Ratelimit-Remaining'] !== undefined,
      'has X-RateLimit-Reset header': (r) => r.headers['X-Ratelimit-Reset'] !== undefined,
    });
  }

  // Small delay between requests (simulate real user behavior)
  sleep(0.5);
}

/**
 * Setup function (runs once before test)
 */
export function setup() {
  console.log('🚀 Starting rate limiter load test');
  console.log(`📍 Target: ${BASE_URL}`);
  return { startTime: Date.now() };
}

/**
 * Teardown function (runs once after test)
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Load test completed in ${duration.toFixed(2)}s`);
}
