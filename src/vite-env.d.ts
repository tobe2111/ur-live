/// <reference types="vite/client" />

declare const __BUILD_VERSION__: string
declare const __APP_VERSION__: string

// Google Analytics gtag global
declare function gtag(...args: unknown[]): void

// 🌐 2026-10-11: 번역 파일을 손님용/대시보드용으로 나눠 받는 쿼리(빌드 플러그인 `scripts/i18n-split.mjs`).
declare module '*.json?i18n-core' {
  const value: Record<string, unknown>
  export default value
}
declare module '*.json?i18n-dash' {
  const value: Record<string, unknown>
  export default value
}
