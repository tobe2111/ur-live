import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // 환경 변수 설정
    env: {
      // Firebase (테스트 환경)
      VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || 'test-project',
      
      // Kakao (테스트 환경)
      VITE_KAKAO_REST_API_KEY: process.env.VITE_KAKAO_REST_API_KEY || 'test-kakao-key',
      
      // Test User Credentials
      TEST_USER_EMAIL: 'test@example.com',
      TEST_USER_PASSWORD: 'testpassword123',
      TEST_SELLER_EMAIL: 'seller@test.com',
      TEST_SELLER_PASSWORD: 'sellerpass123',
      TEST_ADMIN_EMAIL: 'admin@test.com',
      TEST_ADMIN_PASSWORD: 'adminpass123',
    },
    
    // 브라우저 설정
    retries: {
      runMode: 2,
      openMode: 0,
    },
  },
  
  // 컴포넌트 테스트 설정 (향후 사용)
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'src/**/*.cy.{ts,tsx}',
  },
})
