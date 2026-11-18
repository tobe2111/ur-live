/**
 * 🎬 2026-11-18 메타 검수 시연 — 지켜야 할 것 두 가지.
 *  ① 로그인 state 는 서명·만료·provider 가 맞아야만 통과한다(남의 콜백 위조 방지).
 *  ② 바깥으로 나가는 행동(스레드 답글·인스타 댓글 답글·DM)은 approved:true 없이 나가지 않는다.
 *  이 시험이 못 막는 것: 메타 쪽 실제 응답 형식(라이브 녹화로만 확인된다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { signState, verifyState } from '@/features/meta-review/api/meta-review.routes'

describe('meta-review state', () => {
  it('맞는 provider·기한 안이면 통과', async () => {
    const t = await signState('secret-x', 'threads')
    expect(await verifyState('secret-x', 'threads', t)).toBe(true)
  })
  it('다른 provider·다른 비밀·만료·변조는 거절', async () => {
    const t = await signState('secret-x', 'threads')
    expect(await verifyState('secret-x', 'facebook', t)).toBe(false)
    expect(await verifyState('secret-y', 'threads', t)).toBe(false)
    expect(await verifyState('secret-x', 'threads', t, Date.now() + 11 * 60_000)).toBe(false)
    expect(await verifyState('secret-x', 'threads', t.slice(0, -2) + 'aa')).toBe(false)
    expect(await verifyState('secret-x', 'threads', undefined)).toBe(false)
  })
})

describe('meta-review 발송은 사람 승인 필수', () => {
  const src = readFileSync('src/features/meta-review/api/meta-review.routes.ts', 'utf8')
  for (const path of ['/threads/reply', '/ig/comment-reply', '/ig/message']) {
    it(`${path} 은 approved !== true 를 거절한다`, () => {
      const i = src.indexOf(`metaReviewAdminRoutes.post('${path}'`)
      expect(i).toBeGreaterThan(-1)
      const block = src.slice(i, src.indexOf('\n})', i))
      expect(block).toMatch(/b\.approved !== true\) return fail/)
    })
  }
})
