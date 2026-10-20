/**
 * k6 Load Test: Authentication Flow
 * 
 * Purpose: Test authentication endpoints under load
 * 
 * Scenarios:
 * 1. User login (email + password for KR)
 * 2. Token validation
 * 3. Session management
 * 
 * Run: k6 run tests/load/auth-flow.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginSuccessRate = new Rate('login_success_rate');
const loginDuration = new Trend('login_duration');

// Configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 concurrent logins
    { duration: '2m', target: 20 },   // Maintain 20 concurrent logins
    { duration: '1m', target: 50 },   // Spike to 50 concurrent logins
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],     // 95% of requests should be < 2s
    login_success_rate: ['rate>0.95'],     // 95% login success rate
    login_duration: ['p(95)<1500'],        // 95% of logins should be < 1.5s
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://ur-team.com';

/**
 * Generate random test user credentials
 */
function generateTestUser() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    email: `test+${timestamp}${random}@example.com`,
    password: 'TestPassword123!',
    name: `Test User ${random}`,
  };
}

/**
 * Test: User Registration Flow
 */
function testRegistration(user) {
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const duration = Date.now() - startTime;
  
  const success = check(response, {
    'registration status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'registration has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined || body.user !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  return { success, duration, response };
}

/**
 * Test: User Login Flow
 */
function testLogin(user) {
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const duration = Date.now() - startTime;
  loginDuration.add(duration);
  
  const success = check(response, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined || body.user !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  loginSuccessRate.add(success);

  let token = null;
  if (success && response.body) {
    try {
      const body = JSON.parse(response.body);
      token = body.token || body.accessToken;
    } catch (e) {
      console.error('Failed to parse login response:', e);
    }
  }

  return { success, duration, token, response };
}

/**
 * Test: Token Validation
 */
function testTokenValidation(token) {
  if (!token) {
    console.log('⚠️ No token provided for validation');
    return { success: false };
  }

  const response = http.get(`${BASE_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const success = check(response, {
    'token validation status is 200': (r) => r.status === 200,
    'token validation has user data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.user !== undefined || body.email !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  return { success, response };
}

/**
 * Main test function
 */
export default function () {
  const user = generateTestUser();

  // Scenario 1: New user registration
  if (Math.random() < 0.3) {
    console.log('📝 Testing registration flow...');
    const regResult = testRegistration(user);
    
    if (!regResult.success) {
      console.log('❌ Registration failed:', regResult.response.status);
    }
    
    sleep(1);
  }

  // Scenario 2: Existing user login
  console.log('🔐 Testing login flow...');
  const loginResult = testLogin(user);
  
  if (loginResult.success && loginResult.token) {
    console.log('✅ Login successful');
    
    // Wait a bit before validating token
    sleep(0.5);
    
    // Scenario 3: Token validation
    console.log('🔍 Testing token validation...');
    const validationResult = testTokenValidation(loginResult.token);
    
    if (validationResult.success) {
      console.log('✅ Token validation successful');
    } else {
      console.log('❌ Token validation failed');
    }
  } else {
    console.log('❌ Login failed:', loginResult.response.status);
  }

  // Simulate user think time
  sleep(1 + Math.random() * 2);
}

/**
 * Setup function
 */
export function setup() {
  console.log('🚀 Starting authentication flow load test');
  console.log(`📍 Target: ${BASE_URL}`);
  
  // Warm up: Test health endpoint
  const healthResponse = http.get(`${BASE_URL}/health`);
  console.log(`🏥 Health check: ${healthResponse.status}`);
  
  return { startTime: Date.now() };
}

/**
 * Teardown function
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Authentication flow test completed in ${duration.toFixed(2)}s`);
}
