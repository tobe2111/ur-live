/**
 * 🖥️ 어드민 화면을 라이브에서 전부 열어 보고 나온 것 (2026-11-25 — 81개 화면 · 폭 1440)
 *
 *   ① 홈 섹션 관리 · KV 모니터링 · 맛집 수요: 데이터 요청이 401. 주소가 공개 목록에 가리거나 어느 토큰 규칙에도 안 걸려
 *      토큰 없이 나갔다. 서버는 어드민 쿠키를 `/api/admin/*` 안에서만 받는다(쿠키만으로 실측: 그 밖은 401).
 *   ② 리뷰 검수: 서버는 `avg_rating` 을 주는데 화면이 `average_rating.toFixed` 를 불러 화면 전체가 오류 화면.
 *   ③ 대외 소개서: 미리보기(blob 주소 iframe)가 보안 헤더 `frame-src` 에 막혀 빈 화면.
 *
 * 전수 검사(아래 "어드민 화면이 부르는 주소")가 ①의 종류를 지킨다 — 새 어드민 화면이 토큰 규칙 밖의 주소를 부르면 빨간불.
 * 못 보는 것: 주소를 변수로 조립해 부르는 호출 · 서버가 그 주소에서 실제로 무엇을 요구하는지 · 화면 모양.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isAdminOnlyOutsidePatterns } from '@/lib/api-admin-paths'
import { stripComments } from '../helpers/source-text'

describe('어드민 전용인데 패턴 밖에 있는 주소', () => {
  it('세 화면의 주소와 홈 섹션의 쓰기는 어드민 토큰을 붙인다', () => {
    expect(isAdminOnlyOutsidePatterns('/api/sections/admin', 'GET')).toBe(true)
    expect(isAdminOnlyOutsidePatterns('/api/sections/admin?x=1', 'get')).toBe(true)
    expect(isAdminOnlyOutsidePatterns('/api/sections', 'POST')).toBe(true)
    expect(isAdminOnlyOutsidePatterns('/api/sections/7', 'put')).toBe(true)
    expect(isAdminOnlyOutsidePatterns('/api/sections/7/products', 'POST')).toBe(true)
    expect(isAdminOnlyOutsidePatterns('/api/sections/reorder', 'POST')).toBe(true)
    expect(isAdminOnlyOutsidePatterns('/api/sections/7', 'DELETE')).toBe(true)
    expect(isAdminOnlyOutsidePatterns('/api/debug/kv-usage', 'GET')).toBe(true)
    expect(isAdminOnlyOutsidePatterns('/api/restaurant-suggestions/stats', 'GET')).toBe(true)
  })
  it('손님이 보는 공개 목록에는 붙이지 않는다(캐시가 깨지고 손님 요청에 어드민 토큰이 실린다)', () => {
    expect(isAdminOnlyOutsidePatterns('/api/sections', 'GET')).toBe(false)
    expect(isAdminOnlyOutsidePatterns('/api/sections?slot=home', 'GET')).toBe(false)
    expect(isAdminOnlyOutsidePatterns('/api/sections/administrator', 'GET')).toBe(false)
    expect(isAdminOnlyOutsidePatterns('/api/restaurant-suggestions', 'POST')).toBe(false)
    expect(isAdminOnlyOutsidePatterns('/api/products', 'GET')).toBe(false)
  })
  it('인터셉터가 공개 판정보다 먼저 이 판정을 본다', () => {
    const src = stripComments(readFileSync('src/lib/api.ts', 'utf8'))
    const mine = src.indexOf('if (isAdminOnlyOutsidePatterns(url, method))')
    const pub = src.indexOf('if (isPublicAPI(url)) return config')
    expect(mine).toBeGreaterThan(0)
    expect(pub).toBeGreaterThan(mine)
  })
})

describe('어드민 화면이 부르는 주소 — 전부 어드민 토큰 규칙 안에 있다', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []
  })
  const isAdminFile = (f: string) => /\/pages\/(Admin[A-Z]|admin[-/]|admin\/)/.test(f) || f.includes('/components/admin/')
  const files = [...walk('src/pages'), ...walk('src/components/admin')].filter(isAdminFile)
  const apiSrc = readFileSync('src/lib/api.ts', 'utf8')
  const publicPaths = [...(apiSrc.match(/PUBLIC_API_PATHS = \[([\s\S]*?)\];/)?.[1] ?? '').matchAll(/'(\/api\/[^']+)'/g)].map((m) => m[1])
  const covered = (u: string, method: string) =>
    /^\/api\/admin[-/]/.test(u)
    || (/^\/api\/[a-z0-9-]+\/admin(\/|\?|$)/.test(u) && !publicPaths.some((p) => u.startsWith(p)))
    || u.startsWith('/api/_errors/recent') || u.startsWith('/api/_internal/')
    || u.startsWith('/api/guides/') || u.startsWith('/api/notifications') || u.startsWith('/api/dashboard-notifications') || u.startsWith('/api/prospects')
    || isAdminOnlyOutsidePatterns(u, method)
  /** 토큰 규칙 밖이어도 되는 주소 — 공개이거나, 부르는 쪽이 어드민 토큰을 손으로 싣는다. 늘릴 때는 그 근거를 옆에 적는다. */
  const ALLOWED: Record<string, string> = {
    '/api/fcfs/': '공개 조회(추첨 상품 정보)',
    '/api/kakao/place/search': '공개 프록시(횟수 제한)',
    '/api/naver/image/search': '공개 프록시(횟수 제한)',
    '/api/version': '공개',
    '/api/returns/': '부르는 쪽이 어드민 토큰을 헤더로 싣는다(AdminReturnsPage · RefundAmountEditor)',
    '/api/push/test': '부르는 쪽이 어드민 토큰을 헤더로 싣는다(AdminSystemMonitoringPage)',
  }
  it('측정 대상이 있다(0 이면 이 검사가 헛돈다)', () => { expect(files.length).toBeGreaterThan(100) })
  it('규칙 밖 주소는 허용 목록에 있는 것뿐이다', () => {
    const bad: string[] = []
    let calls = 0
    for (const f of files) {
      const s = readFileSync(f, 'utf8')
      const hits = [
        ...[...s.matchAll(/api\.(get|post|put|patch|delete)\(\s*[`'"](\/api\/[^`'"$?]*)/g)].map((m) => [m[1].toUpperCase(), m[2]] as const),
        ...[...s.matchAll(/useApiQuery[^(]*\(\s*\[[^\]]*\]\s*,\s*[`'"](\/api\/[^`'"$?]*)/g)].map((m) => ['GET', m[1]] as const),
      ]
      for (const [method, u] of hits) {
        calls++
        if (!covered(u, method) && !(u in ALLOWED)) bad.push(`${method} ${u} — ${f}`)
      }
    }
    expect(calls).toBeGreaterThan(300)
    expect(bad, `어드민 화면이 토큰이 안 붙는 주소를 부른다. api.ts 의 규칙이나 api-admin-paths.ts 에 넣거나, 공개 주소면 이 시험의 ALLOWED 에 근거와 함께 적을 것:\n${bad.join('\n')}`).toEqual([])
  })
})

describe('대외 소개서 미리보기', () => {
  it('보안 헤더가 blob 주소의 프레임을 허용한다', () => {
    const src = readFileSync('src/worker/index.ts', 'utf8')
    expect(src).toMatch(/"frame-src 'self' blob: "/)
    expect(readFileSync('src/pages/admin/proposals/useAutoProposal.ts', 'utf8')).toContain('URL.createObjectURL')
  })
})

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('@/components/AdminLayout', () => ({ default: ({ children }: { children: unknown }) => <div>{children as never}</div> }))

describe('리뷰 검수 화면', () => {
  it('서버가 평균을 avg_rating 으로 줘도 화면이 떨어지지 않고 4.6 을 그린다', async () => {
    localStorage.setItem('admin_token', 'x')
    get.mockImplementation(async (url: string) => url.includes('/stats')
      ? { data: { success: true, data: { total: 118596, avg_rating: 4.5605, hidden_count: 0, rating_1: 0, rating_2: 0, rating_3: 0, rating_4: 52119, rating_5: 66477 } } }
      : { data: { success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } } })
    const { default: Page } = await import('@/pages/AdminReviewModerationPage')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><MemoryRouter><Page /></MemoryRouter></QueryClientProvider>)
    await waitFor(() => expect(screen.getByText('4.6')).toBeTruthy())
    expect(screen.getByText('118,596')).toBeTruthy()
  })
})
