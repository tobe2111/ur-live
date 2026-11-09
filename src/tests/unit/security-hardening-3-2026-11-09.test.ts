/**
 * 🔐 2026-11-09 보안 전수조사 3차 — 낮음 등급 묶음(대표 *"계속 진행"*). 1차 `security-hardening-2026-11-09`, 2차 `-2-`.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 이미 저장된 `javascript:` 값 — 화면 쪽 `safeHttpHref` 가 막지만 DB 는 그대로다.
 * - react-router 6.x 의 역슬래시 이동 취약점 — 수정은 7.x 에만 있다(큰 버전 업그레이드는 별도). `safeInternalPath` 가 막는다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '@/tests/helpers/source-text'

describe('① 공개 결제 점검 응답에 비밀키 글자가 없다', () => {
  it('비밀키는 종류·길이만', () => {
    const code = readCode('src/worker/routes/healthcheck.routes.ts')
    expect(code).not.toMatch(/masked: mask\(secretKey\)/)
    expect(code).toMatch(/secretKey\.split\('_'\)\.slice\(0, 2\)\.join\('_'\)/)
  })
})

describe('② 외부 이미지를 우리 저장소로 옮길 때 래스터만', () => {
  it("startsWith('image/') 판정이 남지 않았다(SVG 통과)", () => {
    const code = readCode('src/worker/utils/rehost-image.ts')
    expect(code).not.toMatch(/startsWith\('image\/'\)/)
    expect(code.match(/isRasterImageType\(/g)?.length).toBe(4)
  })
})

describe('③ 사용자가 넣은 링크는 http(s)·내부 경로만 저장하고 그린다', () => {
  it('safeHttpHref 판정', async () => {
    const { safeHttpHref } = await import('@/utils/safe-external-url')
    for (const bad of ['javascript:alert(1)', ' JavaScript:x', 'data:text/html,x', '//evil.com', '/\\evil', '']) expect(safeHttpHref(bad), bad).toBeUndefined()
    for (const ok of ['https://a.b/c.png', 'http://a.b', '/api/media/x.jpg']) expect(safeHttpHref(ok), ok).toBe(ok)
  })
  it('저장하는 곳', () => {
    expect(readCode('src/features/seller-prospects/api/seller-prospects.routes.ts')).toMatch(/safeHttpHref\(body\.proof_image_url\)/)
    const w = readCode('src/features/seller/api/product-field-writers.ts')
    expect(w).toMatch(/\['content_url', safeHttpHref\(body\.content_url\) \|\| null\]/)
    expect(w).toMatch(/\['preview_url', safeHttpHref\(body\.preview_url\) \|\| null\]/)
  })
  it('그리는 곳', () => {
    expect(readCode('src/pages/AdminProspectsPage.tsx')).toMatch(/href=\{safeHttpHref\(p\.proof_image_url\)\}/)
    expect(readCode('src/pages/AdminPendingSellersPage.tsx')).toMatch(/href=\{safeHttpHref\(s\.prospect_proof_url\)\}/)
    const lib = readCode('src/pages/MyDigitalLibraryPage.tsx')
    expect(lib).toMatch(/const url = safeHttpHref\(res\.data\.data\.url\) \|\| ''/)
    expect(lib).toMatch(/window\.open\(safeHttpHref\(it\.preview_url\)!/)
  })
  it('몰 공지 링크는 // 로 시작하는 외부 주소를 받지 않는다', () => {
    const re = /^(https?:\/\/|\/(?![/\\]))/i
    expect(re.test('//evil.com')).toBe(false)
    expect(re.test('/notice/1')).toBe(true)
    for (const f of ['src/features/mall/api/mall-admin.routes.ts', 'src/features/supply/api/wholesale-malls-admin.routes.ts']) {
      const code = readCode(f)
      expect(code, f).not.toMatch(/!\/\^\(https\?:\\\/\\\/\|\\\/\)\/i\.test\(link\)/)
    }
  })
})

describe('④ 첫 화면 시드 JSON 은 < 를 남기지 않는다', () => {
  it('escapeForScript — 파싱 결과는 같고 HTML 파서를 흔들 글자가 없다', async () => {
    const { escapeForScript } = await import('@/worker/utils/ssr-payload')
    const raw = JSON.stringify({ name: '<!--<script>alert(1)</script>', ok: '<b>' })
    const out = escapeForScript(raw)
    expect(out).not.toContain('<')
    expect(JSON.parse(out)).toEqual(JSON.parse(raw))
  })
})

describe('⑤ 로그인 없는 외부 API 호출에 횟수 제한', () => {
  it('ensure-geocode 에 rateLimit', () => {
    expect(readCode('src/features/group-buy/api/group-buy-public.routes.ts'))
      .toMatch(/router\.post\('\/products\/:id\/ensure-geocode', rateLimit\(\{ action: 'ensure_geocode'/)
  })
})
