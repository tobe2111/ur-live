/**
 * 🛡️ 2026-05-03: Worker / shared 코드의 import.meta.env 타입 선언.
 *
 * 배경:
 *   - Frontend (Vite): import.meta.env 는 vite/client.d.ts 에서 제공.
 *   - Worker (esbuild + tsconfig.worker.json): vite/client 미참조 → import.meta.env 타입 에러.
 *
 * 런타임 처리:
 *   - scripts/build-worker.js 의 esbuild `define` 으로 import.meta.env.* 가
 *     production 상수 ('false', '"production"' 등) 로 치환됨 → 런타임 안전.
 *   - 이 .d.ts 는 TS 컴파일 시 IntelliSense / 타입체크용.
 */

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
  readonly SSR: boolean
  readonly BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
