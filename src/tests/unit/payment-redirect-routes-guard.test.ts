/**
 * 🧾 **가드 자신이 실패할 수 있는가** — `check-payment-redirect-routes.mjs` (2026-09-13)
 *
 * 이 레포가 반복해 당한 것은 "검사가 실패한다"가 아니라 **"검사가 실패할 수 없다"** 이다.
 * 그리고 이 가드는 첫 판에서 **거짓 빨간불**까지 냈다 — `src/App.tsx` 하나만 읽어서, 멀쩡히
 * 살아 있는 셀러 페이지 3개(`/seller/alimtalk`·`/seller/youtube-growth`…)를 "라우트 없음"으로
 * 신고했다(실제 라우트는 `src/routes/seller.routes.tsx`). 양쪽을 다 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
// @ts-expect-error — 가드 스크립트(.mjs)에는 타입 선언이 없다. 판정 본체만 가져온다.
import { destPath } from '../../../scripts/check-payment-redirect-routes.mjs'

function run(cwd = process.cwd()): { code: number; out: string } {
  try {
    const out = execFileSync('node', [join(process.cwd(), 'scripts/check-payment-redirect-routes.mjs')], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: (err.stdout ?? '') + (err.stderr ?? '') }
  }
}

describe('🎯 목적지 해석', () => {
  it('origin 접두사를 떼고 쿼리를 버린다', () => {
    expect(destPath('`${window.location.origin}/payment/success`')).toBe('/payment/success')
    expect(destPath("'/seller/alimtalk?charge=success&orderId=1'")).toBe('/seller/alimtalk')
  })
  it('보간 세그먼트는 파라미터로 본다', () => {
    expect(destPath('`/group-buy/${productId}?fail=1`')).toBe('/group-buy/:x')
  })
  it('🔴 해석 불가는 건너뛴다 — 변수·런타임 주소·외부 URL', () => {
    expect(destPath('successPath')).toBeNull()                              // 변수
    expect(destPath('`${window.location.pathname}?tab=x`')).toBeNull()      // 런타임
    expect(destPath("'https://example.com/x'")).toBeNull()                  // 외부
  })
})

describe('🧪 가드가 실제로 실패하는가', () => {
  it('현재 레포는 통과한다', () => {
    const r = run()
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/전부 실재 라우트/)
  })

  it('🔴 목적지 라우트를 지우면 빨간불', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prr-'))
    mkdirSync(join(dir, 'src/routes'), { recursive: true })
    mkdirSync(join(dir, 'src/pages'), { recursive: true })
    cpSync('src/App.tsx', join(dir, 'src/App.tsx'))
    cpSync('src/routes', join(dir, 'src/routes'), { recursive: true })
    const page = join(dir, 'src/pages/X.tsx')
    writeFileSync(page, "const a = { successUrl: '/nowhere-at-all/success', failUrl: '/payment/fail' }\n".repeat(3))
    const r = run(dir)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/nowhere-at-all/)
  })

  it('🔴 라우트 파일을 App.tsx 하나로 좁히면 살아 있는 페이지를 오탐한다 — 그래서 전부 모은다', () => {
    // 실제로 저지른 실수. 셀러 라우트는 src/routes/seller.routes.tsx 에 있다.
    const seller = readFileSync('src/routes/seller.routes.tsx', 'utf8')
    expect(seller).toMatch(/<Route path="\/seller\/alimtalk"/)
    expect(seller).toMatch(/<Route path="\/seller\/youtube-growth"/)
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(app).not.toMatch(/<Route path="\/seller\/alimtalk"/)
    // 가드는 `<Route path=` 를 가진 파일을 전부 스캔해야 한다.
    const src = readFileSync('scripts/check-payment-redirect-routes.mjs', 'utf8')
    expect(src).toMatch(/routeFiles[\s\S]{0,200}includes\('<Route path='\)/)
  })

  it('🔴 측정 대상이 0건이면 통과가 아니라 실패다', () => {
    const src = readFileSync('scripts/check-payment-redirect-routes.mjs', 'utf8')
    expect(src).toMatch(/checked < MIN/)
    expect(src).toMatch(/routeShapes\.size < 50/)
  })
})
