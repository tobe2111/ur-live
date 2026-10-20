import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m',  target: 200 },  // Stay at 200 users
    { duration: '30s', target: 500 },  // Spike to 500
    { duration: '1m',  target: 500 },  // Stay at 500 (this is the stress test)
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // 95% under 2s
    http_req_failed: ['rate<0.05'],      // less than 5% errors
  },
}

const BASE = __ENV.BASE_URL || 'https://ur-live.pages.dev'

export default function () {
  // Simulate typical user browsing
  let res = http.get(`${BASE}/api/products?limit=20`)
  check(res, {
    'products 200': (r) => r.status === 200,
  })
  sleep(1)

  res = http.get(`${BASE}/api/streams?status=live`)
  check(res, {
    'streams 200': (r) => r.status === 200,
  })
  sleep(1)

  res = http.get(`${BASE}/api/health`)
  check(res, {
    'health 200': (r) => r.status === 200,
  })
  sleep(2)
}
