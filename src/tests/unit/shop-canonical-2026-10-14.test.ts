/**
 * 🏪 2026-10-14 — 가게 유어샵의 정본 URL 이 **한 곳**에서 정해지는지.
 *
 * 근거·실측·위험 방향은 `src/shared/seo/shop-canonical.ts` 머리말.
 * 요약: `/s/{username}` 과 `/profile/{username}` 이 둘 다 200·같은 제목인데 **각자 자기자신을
 *       정본이라 말했다**. sitemap 은 `/s/` 만 제출하므로 `/profile/` 은 통합 안 된 중복이었다.
 *
 * ⚠️ **이 시험이 못 보는 것**
 *   - 그 handle 이 라이브에서 실제로 200 인지(DB 값을 믿는다 — 핸들이 지워지면 정본이 404 가 된다).
 *   - 구글이 통합을 적용하는지(색인 수일~수주 · 서치콘솔은 **대표만** 본다).
 *   - `/profile/` 을 301 로 보내는 쪽(더 센 신호지만 앱 내비가 그 경로를 쓴다 — 별건).
 */
import { describe, it, expect } from 'vitest'
import { canonicalShopPath } from '@/shared/seo/shop-canonical'
import { buildSellerSurfaceMeta } from '@/worker/utils/surface-ssr-meta'
import { readCode } from '../helpers/source-text'

const O = 'https://urdeal.kr'
const pay = (d: unknown) => JSON.stringify({ success: true, data: d })

describe('🏪 가게 유어샵 정본', () => {
  // ──────────────────────────────── ① 순수 함수
  it('①-1 핸들이 있으면 /u/{handle}', () => {
    expect(canonicalShopPath('jiwon1228', 'store_x', 14)).toBe('/u/jiwon1228')
  })

  it('①-2 핸들이 없으면 /s/{username} — 죽은 /u/ 를 가리키지 않는다', () => {
    for (const h of [null, undefined, '', '   ']) {
      // 🔴 이 방향이 훨씬 비싸다 — 핸들 없는 가게에 `/u/` 를 주면 제출한 URL 이 404 를 정본으로
      //    지목하고, 색인에서 통째로 빠진 뒤 복구는 수주다.
      expect(canonicalShopPath(h, 'store_x', 14), String(h)).toBe('/s/store_x')
    }
  })

  it('①-3 username 도 없으면 /s/{id}', () => {
    expect(canonicalShopPath(null, null, 99)).toBe('/s/99')
    expect(canonicalShopPath(null, '  ', '99')).toBe('/s/99')
  })

  it('①-4 셋 다 없으면 null — 정본을 지어내지 않는다', () => {
    expect(canonicalShopPath(null, null, null)).toBeNull()
    expect(canonicalShopPath('', '', '')).toBeNull()
  })

  // ──────────────────────────────── ② 빌더를 **돌려서** 판정
  const SHOP = { id: 26, username: 'store_muxlddtf74b', name: '달빛한스푼' }
  const SHOP_H = { id: 14, username: 'store_x', name: '가게', curator_handle: 'jiwon1228' }

  it('②-1 두 별칭이 **같은** 정본을 가리킨다 (핸들 없음)', () => {
    const a = buildSellerSurfaceMeta(pay(SHOP), O, '/s/store_muxlddtf74b')
    const b = buildSellerSurfaceMeta(pay(SHOP), O, '/profile/store_muxlddtf74b')
    expect(a?.canonical).toBe(`${O}/s/store_muxlddtf74b`)
    expect(b?.canonical, '/profile/ 이 자기자신을 정본이라 말한다').toBe(a?.canonical)
  })

  it('②-2 두 별칭이 **같은** 정본을 가리킨다 (핸들 있음 → /u/)', () => {
    const a = buildSellerSurfaceMeta(pay(SHOP_H), O, '/s/store_x')
    const b = buildSellerSurfaceMeta(pay(SHOP_H), O, '/profile/store_x')
    expect(a?.canonical).toBe(`${O}/u/jiwon1228`)
    expect(b?.canonical).toBe(a?.canonical)
  })

  it('②-3 정본을 못 고르면 자기 경로를 쓴다 (빈 canonical 금지)', () => {
    const m = buildSellerSurfaceMeta(pay({ name: '가게' }), O, '/profile/zzz')
    expect(m?.canonical).toBe(`${O}/profile/zzz`)
  })

  it('②-4 제목·설명은 종전과 같다 (이 변경은 canonical 만 건드린다)', () => {
    const m = buildSellerSurfaceMeta(pay(SHOP), O, '/s/store_muxlddtf74b')
    expect(m?.title).toBe('달빛한스푼 유어샵 - 유어딜')
    expect(m?.ogType).toBe('profile')
    expect(m?.description).toContain('달빛한스푼')
  })

  // ──────────────────────────────── ③ sitemap 과 **같은 함수**
  it('③-1 sitemap 이 규칙을 손으로 적지 않는다', () => {
    const c = readCode('src/worker/routes/sitemap.routes.ts')
    expect(c, 'sitemap 이 셀러 URL 규칙을 손으로 적는다').not.toMatch(
      /s\.handle \? `\/u\/\$\{s\.handle\}` : `\/s\//,
    )
    expect(c).toContain('canonicalShopPath(s.handle, s.username, s.id)')
  })

  it('③-2 메타 빌더가 요청 경로를 그대로 정본이라 말하지 않는다', () => {
    const c = readCode('src/worker/utils/surface-ssr-meta.ts')
    // 🔎 이 파일엔 목록·지역 빌더도 있어 `${origin}${pathname}` 자체는 정상으로 쓰인다 —
    //    그래서 **셀러 블록 안**만 잘라서 본다(전체에서 찾으면 영원히 빨간불이거나 늘 통과다).
    const from = c.indexOf('export function buildSellerSurfaceMeta')
    expect(from, '셀러 메타 빌더를 못 찾았다 — 이 단언이 아무것도 안 지킨다').toBeGreaterThan(-1)
    const block = c.slice(from, c.indexOf('\nexport ', from + 10))
    expect(block.length).toBeGreaterThan(200)
    expect(block).toContain('canonicalShopPath(')
    expect(block, '별칭을 그대로 정본으로 쓴다').not.toMatch(/canonical: `\$\{origin\}\$\{pathname\}`/)
  })

  it('③-3 두 별칭 라우트가 둘 다 같은 컴포넌트를 렌더한다 (전제 확인)', () => {
    // 이 처방의 전제 — 하나가 사라지면 통합할 중복도 없다(그때 이 시험이 알려 준다).
    // 2026-10-18: 두 라우트는 셀러 표에서 `seller-public.routes.tsx` 로 옮겨갔다(셀러 표가 lazy 가 되며).
    const r = readCode('src/routes/seller-public.routes.tsx')
    expect(r).toContain('path="/s/:sellerId"')
    expect(r).toContain('path="/profile/:sellerId"')
  })
})
