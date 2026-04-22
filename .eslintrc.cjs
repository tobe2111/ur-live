module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', '.wrangler'],
  parser: '@typescript-eslint/parser',
  plugins: ['unused-imports', 'import'],
  rules: {
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'off', // Use unused-imports plugin instead

    // ═══ 🛡️ 런타임 에러 방지 규칙 (2026-04 webhook.routes 500 재발 방지) ═══
    //
    // 이 규칙들은 "TypeScript는 통과하는데 런타임에 터지는" 부류의 에러를 catch.
    // 추가 이유: webhook.routes.ts 파일 중간 import 문 때문에 셀러/어드민/에이전시
    // 로그인 전체가 500 났던 사고(커밋 a9c1316)를 재발 방지.

    // import 문은 반드시 파일 최상단에 있어야 함 (ES module 표준)
    'import/first': 'error',

    // 같은 모듈을 여러 import 구문으로 import하는 것 금지 (혼란 방지)
    'import/no-duplicates': 'error',

    // top-level export가 아닌 곳에서의 export 금지
    'import/no-mutable-exports': 'error',

    // await 없는 async 함수 경고 (asynchronous logic 실수 방지)
    'require-await': 'off',
    '@typescript-eslint/require-await': 'warn',

    // Promise 에러 처리 누락 감지
    'no-async-promise-executor': 'error',
  },
  overrides: [
    {
      // 테스트 파일은 일부 규칙 완화
      files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**/*'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
