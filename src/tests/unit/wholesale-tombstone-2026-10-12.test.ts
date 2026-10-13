/**
 * 🪦 **ur-wholesale 은 묘비만 배포한다** (2026-10-12 대표 *"남은 것도 다 해줘"*)
 *
 * ## 왜
 * 도매몰은 2026-10-11 코드에서 철거됐고 빌드 분기(`INCLUDE_WHOLESALE`)도 false 로 고정됐다.
 * 그런데 `deploy-wholesale.yml` 은 매 push 마다 `dist/client` 를 ur-wholesale 프로젝트에 올리고
 * 있었다 — 즉 **운영 D1·KV 가 연결된 소비자 앱의 사본**이 `ur-wholesale.pages.dev` 에 떠 있었다
 * (실측 2026-10-12: 바인딩 DB·CACHE_KV·RATE_LIMIT_KV·SESSION_KV, 쓰는 곳 0).
 * ⇒ 앱 대신 모든 요청에 410 을 주는 `_worker.js` 하나만 올린다.
 *
 * 함께: `prod-smoke.yml` 이 그 사본에 도매 API 를 두드려 **매 회차 실패**하고 있었다
 * (빨간불이 상시라 진짜 소비자 회귀가 나도 새 신호가 안 났다).
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 프로젝트 자체의 존재 — 삭제는 대시보드에서 대표가 한다(세션 CF 토큰은 읽기 전용).
 * - 묘비가 실제로 올라갔는지 — 배포 후 `ur-wholesale.pages.dev` 가 410 인지로 판정(이 환경은
 *   `*.pages.dev` 가 막혀 있어 Actions 로그로 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// @ts-expect-error — .mjs 빌드 스크립트(타입 없음)
import { isWholesaleProjectBuild } from '../../../scripts/pages-tombstone-gate.mjs'

const WF = '.github/workflows/deploy-wholesale.yml'
const TOMB = 'deploy/ur-wholesale-tombstone/_worker.js'
const SMOKE = '.github/workflows/prod-smoke.yml'
const code = (p: string) => readFileSync(p, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

describe('🪦 ur-wholesale 묘비', () => {
  it('워크플로는 앱(dist/client)이 아니라 묘비 폴더를 배포한다', () => {
    const w = code(WF)
    expect(w, '앱을 빌드해 올리면 운영 DB 가 붙은 사본이 다시 뜬다').not.toMatch(/dist\/client/)
    expect(w).not.toMatch(/npm run build|npm ci/)
    expect(w).toMatch(/pages deploy deploy\/ur-wholesale-tombstone/)
  })

  it('앱 변경마다 돌지 않는다 — 묘비 자신이 바뀔 때만', () => {
    const w = code(WF)
    const block = w.slice(w.indexOf('push:'), w.indexOf('concurrency:'))
    expect(block, 'paths 가 없으면 매 push 마다 같은 묘비를 다시 올린다').toMatch(/paths:/)
    expect(block).toContain('deploy/ur-wholesale-tombstone/**')
    expect(block, '자기 자신이 없으면 이 워크플로의 수리가 배포되지 않는다').toContain(WF)
  })

  it('묘비는 모든 요청에 410 + noindex 이고 바인딩을 건드리지 않는다', () => {
    const t = readFileSync(TOMB, 'utf8')
    expect(t).toMatch(/status:\s*410/)
    expect(t).toMatch(/x-robots-tag/i)
    expect(t, '묘비가 env 를 읽기 시작하면 운영 DB 에 닿는 코드가 된다').not.toMatch(/\benv\b\s*[.[]/)
    expect(t).not.toMatch(/\.DB\b|prepare\(/)
  })

  it('prod-smoke 가 철거된 도매를 두드리지 않고, 대신 철거 유지(410)를 본다', () => {
    const s = code(SMOKE)
    expect(s, '죽은 사본을 두드리면 매 회차 빨간불이 된다').not.toMatch(/ur-wholesale|\/api\/wholesale/)
    expect(s).toMatch(/for p in \/wholesale \/supplier/)
    expect(s).toMatch(/"\$code" = "410"/)
  })

  /**
   * 🩸 2026-10-13 PR 봇 댓글로 드러났다 — ur-wholesale 은 GitHub 에 **직접 연결**돼 있어
   *   Cloudflare 가 main push 마다 `npm run build` 로 앱 전체를 production 에 올린다. 워크플로 묘비는
   *   다음 main push 에 덮인다. ⇒ 빌드 마지막에 게이트가 그 프로젝트의 빌드만 묘비로 바꾼다.
   */
  it('빌드 게이트 — ur-wholesale 빌더에서만 묘비로 바꾼다', () => {
    expect(isWholesaleProjectBuild({ CF_PAGES: '1', CF_PAGES_URL: 'https://db7b5b04.ur-wholesale.pages.dev' })).toBe(true)
    expect(isWholesaleProjectBuild({ CF_PAGES: '1', CF_PAGES_URL: 'https://x.ur-live.pages.dev', WHOLESALE_BUNDLE: '1' })).toBe(true)
    expect(isWholesaleProjectBuild({ CF_PAGES: '1', CF_PAGES_URL: 'https://abc.ur-live.pages.dev' }), 'ur-live 빌드가 묘비가 되면 소비자 사이트가 410 이 된다').toBe(false)
    expect(isWholesaleProjectBuild({}), 'GitHub Actions·로컬 빌드는 건드리지 않는다').toBe(false)
    expect(isWholesaleProjectBuild({ CF_PAGES_URL: 'https://a.ur-wholesale.pages.dev' }), 'Pages 빌더가 아니면 무시').toBe(false)
  })

  it('빌드 게이트가 build-prepare 끝에 배선돼 있다 (build 체인의 마지막 단계)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts.build).toMatch(/npm run build:prepare$/)
    const prep = readFileSync('scripts/build-prepare.mjs', 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
    expect(prep, '배선이 빠지면 GitHub 연결 빌드가 main push 마다 앱 사본을 다시 올린다').toMatch(/^runTombstoneGate\(\)\s*$/m)
  })
})
