import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'

// @cloudflare/vite-plugin 미사용 — RR 빌드 산출물(build/server)을 workers/app.ts 가
// 정적 import 하고 wrangler 가 번들. 결합 없는 단순 구조 (파일럿 안정성 우선).
export default defineConfig({
  plugins: [reactRouter()],
})
