import { createRequestHandler } from 'react-router'
// react-router build 산출물 — wrangler 가 함께 번들.
// @ts-expect-error 빌드 산출물 (타입 선언 없음)
import * as build from '../build/server/index.js'

const handler = createRequestHandler(build)

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    return handler(request, { cloudflare: { env, ctx } })
  },
}
