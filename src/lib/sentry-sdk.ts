/**
 * 📦 Sentry 진입점 — 우리가 실제로 쓰는 함수만 (2026-10-11).
 *
 * 왜 이 파일이 있나: `import('@sentry/react')` 처럼 **패키지 통째로 동적 import** 하고 그 모듈 객체를
 *   변수에 담아 쓰면, 번들러는 어떤 함수가 쓰일지 몰라 **패키지 전부**를 청크에 넣는다(실측 sentry 청크 431 KB raw).
 *   여기서 쓰는 이름만 정적으로 다시 내보내고, 동적 import 는 이 파일을 가리키게 하면 나머지가 빠진다.
 *
 * ⚠️ 새 Sentry 함수가 필요하면 **여기에 이름을 더한다**(`Sentry.xxx` 를 쓰는 곳이 이 목록 밖이면 타입 에러가 난다).
 * ⚠️ 이 파일은 반드시 `sentry` 청크에 있어야 한다(vite.config.ts manualChunks) — 첫 페인트 청크로 새면
 *   Sentry 가 통째로 첫 화면에 실린다.
 */
export {
  init,
  browserTracingIntegration,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
} from '@sentry/react'
