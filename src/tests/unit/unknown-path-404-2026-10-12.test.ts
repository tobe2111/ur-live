/**
 * 🗺️ 등록 안 된 경로는 **404 + noindex** (2026-10-12, 대표 "응 모두 해줘") — 가드.
 *
 * ## 무엇이 결함이었나 (라이브 실측, Googlebot UA)
 *     /zzz-nonexistent-abc   200 · index, follow · 본문 6자
 *     /이런페이지는없다        200 · index, follow · 본문 6자
 *     /products              200 · index, follow · 본문 6자   ← 라우트 자체가 없다
 * 무한하다 — 오타·외부 스팸 링크·봇이 찍는 아무 URL 이 전부 색인 후보가 된다.
 *
 * ## 이 가드의 핵심은 **반대 방향**이다
 * 허용목록이 낡으면 **멀쩡한 페이지가 404** 가 되고 색인은 돌아오는 데 수주다. 그래서 ②가
 * **네 라우트 파일을 다시 읽어** 모든 실제 라우트가 통과하는지 전수로 확인한다 —
 * 🩸 처음에 App.tsx 하나만 읽고 목록을 만들려 했고, 그러면 대시보드 ~180개를 404 로 만들었다.
 *
 * ## 못 보는 것
 * - 최상위는 맞는데 그 아래가 없는 경로(`/vouchers/nonexistent-xyz`) — 엔티티 슬롯의 일이고
 *   그 API 가 404 대신 **400** 을 주는 자리가 남아 있다(별건).
 * - HTTP 상태를 실제로 내는지는 워커 런타임 — 판정은 배포 후 라이브 실측이다.
 */
import { describe, it, expect } from 'vitest'
import { HOME_SERVICE_CATEGORIES } from '@/shared/home-service-categories'
import { readFileSync } from 'fs'
import { isKnownAppPath, KNOWN_PARENT_SEGMENTS, KNOWN_SINGLE_ROUTES } from '@/shared/seo/known-routes'
import { stripComments } from '../helpers/source-text'

const ROUTE_FILES = [
  'src/App.tsx',
  'src/routes/admin.routes.tsx',
  'src/routes/seller.routes.tsx',
  'src/routes/seller-public.routes.tsx', // ⚡ 2026-10-18 공개 가게 두 줄이 표 밖으로 옮겨졌다
  'src/routes/agency-console.routes.tsx',
]

/**
 * 라우트 표에서 `path="..."` 를 전부 뽑는다 — **주석 제거는 SSOT 를 쓴다**.
 * 🩸 첫 판은 JSX 주석용 정규식을 손으로 썼고 pre-push 게이트가 22초에 잡았다 — 문자열 안의
 *    주석 시작 토큰에 물려 소스가 통째로 증발하는 클래스다(이 레포가 네 번 밟았다).
 *    🔴 그 정규식을 **여기 인용하지 말 것** — 가드는 원문을 보므로 설명 주석이 곧 위반이 된다
 *       (실제로 그래서 두 번째 빨간불이 났다).
 */
function allRoutePaths(): string[] {
  const out: string[] = []
  for (const f of ROUTE_FILES) {
    const s = stripComments(readFileSync(f, 'utf-8'))
    for (const m of s.matchAll(/<Route\s[^>]*?path="([^"]+)"/g)) out.push(m[1])
  }
  return out.filter(p => p !== '*')
}

/** `/u/:handle` → `/u/probe` 처럼 파라미터를 채운 **실제로 방문 가능한** 경로. */
// 🏠 2026-10-31 — `/life/request/:category` 는 닫힌 목록이라 아무 값('probe')은 404 다(의도).
//   그 자리에는 **실재 업종 키**를 넣어 "실제 라우트는 통과" 를 잰다(나머지 파라미터는 종전 그대로).
const concrete = (p: string) => p.startsWith('/life/request/')
  ? p.replace(':category', HOME_SERVICE_CATEGORIES[0].key)
  : p.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, 'probe')

describe('🗺️ 등록 안 된 경로 404', () => {
  it('① 측정 대상이 비어 있지 않다 (0건이면 통과가 아니라 고장)', () => {
    const ps = allRoutePaths()
    expect(ps.length).toBeGreaterThan(250)
    // 🔁 2026-10-14 — `KNOWN_TOP_SEGMENTS` 가 삭제돼(프로덕션 미사용 → 주입이 헛돌았다)
    //   2세그먼트 판정이 실제로 읽는 집합으로 바꿨다. 지키는 것은 같다: *측정 대상이 비지 않았다*.
    expect(KNOWN_PARENT_SEGMENTS.size).toBeGreaterThan(20)
    expect(KNOWN_SINGLE_ROUTES.size).toBeGreaterThan(40)
  })

  it('② 반대 방향 — 실제 라우트는 전부 통과한다 (네 파일 전수)', () => {
    const bad: string[] = []
    for (const p of allRoutePaths()) {
      if (!p.startsWith('/')) continue          // 상대경로 라우트는 이 판정의 대상이 아니다
      if (p.startsWith('/:')) continue          // 몰 슬러그 — 워커가 MALL 슬롯에 맡긴다
      if (!isKnownAppPath(concrete(p))) bad.push(p)
    }
    expect(bad, `멀쩡한 라우트를 404 로 만든다: ${bad.join(' | ')}`).toEqual([])
  })

  it('②-2 몰 상품 귀속 경로(`/:mallSlug/p/:id`)는 통과한다', () => {
    expect(isKnownAppPath('/some-mall/p/123')).toBe(true)
  })

  it('③ 실측했던 쓰레기 경로는 전부 막힌다', () => {
    for (const p of ['/zzz-nonexistent-abc', '/products', '/vouchers-typo', '/%EC%9D%B4%EB%9F%B0']) {
      expect(isKnownAppPath(p), p).toBe(false)
    }
  })

  it('③-2 홈과 대표 소비자 경로는 통과한다', () => {
    for (const p of ['/', '/vouchers', '/browse', '/pass/2919', '/stays/2887', '/u/jiwon1228',
                     '/blog/what-is-urdeal', '/region/%EC%84%9C%EC%9A%B8', '/seller/orders', '/admin/users']) {
      expect(isKnownAppPath(p), p).toBe(true)
    }
  })

  it('③-3 깊은 경로는 최상위만 본다 (라우트 표에 없는 하위를 자르지 않는다)', () => {
    expect(isKnownAppPath('/seller/orders/does/not/exist')).toBe(true)
  })

  it('④ 워커 배선 — 판정이 계산만 되고 안 쓰이는 것을 막는다', () => {
    const c = stripComments(readFileSync('src/worker/index.ts', 'utf-8'))
    expect(c).toMatch(/const unknownPath = ssrSlot !== 'MALL' && !isKnownAppPath\(url\.pathname\)/)
    // noindex 와 404 **둘 다** 그 값을 읽어야 한다(하나만이면 반쪽이다)
    expect(c).toMatch(/if \(entityGone \|\| unknownPath \|\| retiredSurface\) \{/)
    expect(c).toMatch(/goneStatus = retiredSurface \? 410 : \(\(entityGone \|\| unknownPath\) \? 404 : 0\)/)
  })

  it('⑤ 없는 몰은 엔티티 부재로 404 — MALL 이 엔티티 슬롯에 있다', () => {
    const c = stripComments(readFileSync('src/worker/utils/surface-ssr-meta.ts', 'utf-8'))
    expect(c).toMatch(/ENTITY_SLOTS = new Set\(\[[^\]]*'MALL'/)
  })

  it('⑥ 철거 표면은 여전히 410 (404 와 섞이지 않는다)', () => {
    const c = stripComments(readFileSync('src/worker/index.ts', 'utf-8'))
    expect(c).toContain('retiredSurface ? 410')
  })
})
