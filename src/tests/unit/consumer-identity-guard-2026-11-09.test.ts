/**
 * 🔐 2026-11-09 — **로그인만 확인하고 토큰 종류를 안 보는 경로가 `user.id` 를 쓰면 안 된다.**
 *
 * `requireAuth()` 는 소비자·셀러·에이전시·어드민 토큰을 다 받는다. 셀러 토큰의 `sub` 는 `sellers.id` 라,
 * 핸들러가 종류를 안 보고 `user.id` 를 `users.id` 로 쓰면 **셀러 #N 이 유저 #N 으로 통한다**
 * (2026-11-09 보안 전수조사 — 딜 결제·이용권·장바구니·쿠폰·추천 출금 등 72곳).
 * 소비자 전용 경로는 `requireUser()`, 셀러 전용은 `requireUserType('seller', …)` 를 쓴다.
 *
 * 아래 `ALLOWED` 는 셀러·에이전시도 일부러 쓰는 경로(또는 신원 혼동이 해가 없는 것)다 — **늘리지 말 것.**
 * 새 경로를 넣어야 하면 그 핸들러가 `user.type` 을 확인하게 고치는 쪽이 맞다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 휴리스틱이다: 라우트 선언 뒤 1,500자 안의 `user.id` 와 `user.type` 문자열만 본다(헬퍼로 빼낸 판정은 못 본다).
 * - `requireAuth` 를 미들웨어(`app.use`)로 건 경로, `optionalAuth` 경로.
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const ALLOWED = new Set([
  'src/features/group-buy/api/owner-viewer.routes.ts GET /viewer/:id',
  'src/features/group-buy/api/owner-viewer.routes.ts POST /viewer/:id/active',
  'src/features/kakao-social/api/kakao-social.routes.ts POST /message/broadcast',
  'src/features/kakao-social/api/kakao-social.routes.ts POST /calendar/add',
  'src/features/push/api/push.routes.ts POST /api/push/unsubscribe',
  'src/features/seller-prospects/api/seller-prospects.routes.ts POST /',
  'src/features/seller-prospects/api/seller-prospects.routes.ts GET /mine',
  'src/features/seller-prospects/api/seller-prospects.routes.ts POST /:id/invite-link',
  'src/features/seller-prospects/api/seller-prospects.routes.ts DELETE /:id',
  'src/features/seller-tiers/api/seller-tiers.routes.ts GET /my',
  'src/features/youtube-growth/api/youtube-growth.routes.ts POST /request',
  'src/features/youtube-growth/api/youtube-growth.routes.ts POST /confirm',
  'src/worker/routes/region.routes.ts GET /region',
  'src/worker/routes/terms.routes.ts GET /status',
  'src/worker/routes/terms.routes.ts POST /agree',
])

function scan(): string[] {
  const files = execSync("git ls-files 'src/features' 'src/worker/routes'", { encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.ts') && !f.includes('/tests/'))
  const hits: string[] = []
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    const re = /\.(get|post|put|patch|delete)\(\s*'([^']+)'[^\n]*requireAuth\(\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) {
      const body = s.slice(m.index + m[0].length, m.index + m[0].length + 1500)
      if (/(String\(user\.id\)|resolveUserIdString\(user\.id\)|user\.id\b)/.test(body)
        && !/user\.type|requireUserType|isSeller|type ===|type !==/.test(body)) {
        hits.push(`${f} ${m[1].toUpperCase()} ${m[2]}`)
      }
    }
  }
  return hits
}

describe('종류를 안 보는 로그인 경로가 user.id 를 쓰지 않는다', () => {
  const hits = scan()
  it('측정이 돈다 — 허용 목록의 경로가 실제로 잡힌다', () => {
    expect(hits.filter((h) => ALLOWED.has(h)).length, '스캐너가 아무것도 못 잡는다 — 검사가 헛돈다').toBeGreaterThanOrEqual(10)
  })
  it('허용 목록 밖에서 새로 생기지 않았다', () => {
    expect(hits.filter((h) => !ALLOWED.has(h)), '소비자 전용이면 requireUser(), 셀러용이면 user.type 을 확인할 것').toEqual([])
  })
  it('허용 목록은 줄기만 한다(낡은 항목이 남지 않는다)', () => {
    expect([...ALLOWED].filter((a) => !hits.includes(a)), '고쳐진 항목은 ALLOWED 에서 지울 것').toEqual([])
  })
})
