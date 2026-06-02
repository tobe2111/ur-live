import { describe, it, expect } from 'vitest'
import { youtubeLiveRoutes } from '@/features/youtube/api/youtube-live.routes'

/**
 * 🛡️ 2026-06-01 (c) God 파일 분해 안전망 2단계 — 라이브 라우트 인증 가드 행위 테스트.
 *
 * 계약 테스트(...contract.test)는 "라우트가 존재하는가"만 보장한다.
 * 이 테스트는 한 단계 위 — "각 핸들러가 미인증 요청을 실제로 401 로 거절하는가"를 검증한다.
 *   - 핸들러가 auth 검사를 **먼저** 수행함을 보장(DB 접근 전 → 네트워크/DB 없이 검증 가능)
 *   - 3369줄 분해 시 핸들러를 sub-router 로 옮기다 auth 미들웨어/토큰검사 배선이 빠지면
 *     라우트는 존재(계약 테스트 통과)하지만 인증이 뚫림 → 이 테스트가 그 회귀를 잡는다.
 *
 * DB 가 던지도록(env.DB.prepare → throw) 설정 → auth 검사보다 DB 접근이 앞서면 500/throw 로 드러남.
 */

// auth 검사가 DB 접근보다 먼저임을 강제: DB 사용 시 throw
const env = {
  JWT_SECRET: 'test-secret',
  DB: { prepare: () => { throw new Error('DB_ACCESSED_BEFORE_AUTH') } },
} as unknown as Parameters<typeof youtubeLiveRoutes.request>[2]

// 미인증 시 401 이어야 하는 인증 필수 엔드포인트 (방송 생명주기 + 민감 동작)
const AUTH_REQUIRED: [string, string][] = [
  ['POST', '/live/create'],
  ['POST', '/live/create-webcam'],
  ['POST', '/live/1/start'],
  ['GET', '/live/1/status'],
  ['POST', '/live/1/end'],
  ['PATCH', '/live/1/link-broadcast'],
  ['POST', '/streaming/whip-token'],
  ['POST', '/rotate-stream-key'],
  ['POST', '/live/1/notify-followers'],
]

describe('youtube-live 인증 가드 행위', () => {
  for (const [method, path] of AUTH_REQUIRED) {
    it(`${method} ${path} — 미인증 요청을 401 로 거절 (DB 접근 전)`, async () => {
      const res = await youtubeLiveRoutes.request(
        path,
        {
          method,
          headers: { 'content-type': 'application/json' },
          body: method === 'GET' ? undefined : '{}',
        },
        env,
      )
      // 401 = auth 가드가 DB 접근보다 먼저 동작했다는 증거 (DB 접근 시 throw → 500/throw)
      expect(res.status, `${method} ${path} 는 미인증 시 401 이어야 함`).toBe(401)
    })
  }
})
