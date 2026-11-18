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
 * - 휴리스틱이다: 라우트 선언부터 다음 선언까지에서 신원을 읽는 글자와 종류를 보는 글자만 본다(다른 파일의 헬퍼로 빼낸 판정은 못 본다).
 * - `optionalAuth` 경로 · 여러 줄에 걸쳐 선언한 미들웨어 · `use('/prefix/*', requireAuth())` 처럼 범위가 좁은 미들웨어.
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
  'src/features/youtube-growth/api/youtube-growth.routes.ts POST /request',
  'src/features/youtube-growth/api/youtube-growth.routes.ts POST /confirm',
  'src/features/youtube-growth/api/youtube-growth.routes.ts GET /my',
  'src/worker/routes/terms.routes.ts GET /status',
  'src/worker/routes/terms.routes.ts POST /agree',
])

/**
 * 🩸 2026-11-17 — 첫 판 스캐너는 `user.id` 라는 **글자**만 봤다. 그래서 같은 일을 다른 글자로 하는 경로를 통째로 놓쳤다:
 *   `getCurrentUser(c)?.id` · `c.get('user').id` · `authUser.id` · `uid(c)`, 그리고 `router.use('*', requireAuth())` 로 건 경로.
 *   그 틈에 주문(`/api/orders` — 수령인 이름·전화·주소)·알림·찜·선물·견적 요청·시딩 등 58곳이 남아 있었고,
 *   라이브에서 관리자 토큰으로 `/api/orders` 가 200 이었다(같은 날 `/api/cart` 는 403).
 *   ⇒ 신원을 읽는 **모든 형태**를 보고, 본문은 다음 라우트 선언까지 통째로 본다.
 */
const ID = /getCurrentUser\(c\)|c\.get\('user'( as never)?\)|\buid\(c\)|\bauthUser\b|\buser\.id\b|\bme\.id\b/
// 🩸 `\.type` 를 아무 데서나 인정하면 본문 어딘가의 `tx.type`·`row.type` 만으로 통과한다(주입이 그걸 잡았다) — **신원 객체의** 종류만 인정한다.
const TYPE = /\b(user|authUser|userAsAny|me|u|auth)\??\.type\b|c\.get\('user'\)\??\.type\b|getCurrentUser\(c\)\??\.type\b|requireUserType|requireUser\(|requireSeller|requireAdmin|isSeller\(|isAdmin\(/

function scan(): string[] {
  const files = execSync("git ls-files 'src/features' 'src/worker/routes'", { encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.ts') && !f.includes('/tests/'))
  const hits: string[] = []
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    const routerAuth = /\.use\(\s*'\*'\s*,\s*requireAuth\(\)/.test(s)
    const decl: Array<{ i: number; meth: string; path: string }> = []
    const re = /\.(get|post|put|patch|delete)\(\s*'([^']+)'/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) decl.push({ i: m.index, meth: m[1].toUpperCase(), path: m[2] })
    decl.forEach((d, k) => {
      const seg = s.slice(d.i, decl[k + 1]?.i ?? s.length)
      const inline = /requireAuth\(\)/.test(seg.split('\n')[0])
      if (!inline && !routerAuth) return
      if (ID.test(seg) && !TYPE.test(seg)) hits.push(`${f} ${d.meth} ${d.path}`)
    })
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
