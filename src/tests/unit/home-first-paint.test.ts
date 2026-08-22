import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * 🏠 홈 첫 화면 순서 (2026-08-19 대표 신고 — "첫 접속하면 지금 인기 이용권이 먼저 안뜨고
 * 가까운 동네딜이 먼저 보여. 시간 지나면 … 인기 이용권과 주말에 떠나는 숙소가 보여.
 * 히어로에 있는 사진 이미지도 마찬가지고").
 *
 * 실측으로 규명한 원인 세 가지를 각각 고정한다.
 * ⚠️ 못 막는 것: 실제 체감 속도. 라이브 실측(응답시간·cf-cache-status)이 최종 판정이다.
 */
describe('홈 첫 화면 — 섹션이 늦게 끼어들지 않는다', () => {
  it('🔴 /api/sections 가 엣지 캐시를 탄다', () => {
    // 실측 `cf-cache-status: DYNAMIC` · 0.6~1.2s — 미들웨어가 아예 안 붙어 있었다.
    // (소스 주석은 "on top of edge cache" 라고 적혀 있었지만 사실이 아니었다 — 낡은 주석.)
    const s = code('src/features/sections/api/sections.routes.ts')
    expect(s).toMatch(/sectionsRoutes\.get\('\/',\s*edgeCache\(\d+\)/)
  })

  it('cron 이 섹션을 미리 데운다 (첫 방문자도 캐시 히트)', () => {
    // 캐시만 붙이면 **콜드 콜로의 첫 방문자**는 그 0.6~1.2초를 그대로 맞는다.
    expect(code('src/worker/cron/cache-prewarm.ts')).toMatch(/'\/api\/sections'/)
  })

  it('응답 전에는 섹션 자리를 잡아 둔다 (늦게 와도 화면이 안 밀린다)', () => {
    const s = code('src/components/home/HomeSections.tsx')
    expect(s).toMatch(/isLoading && visible\.length === 0/)
  })

  it('로딩이 끝나고 0건이면 자리를 남기지 않는다 (대표 확정: 안 올리면 아예 안 보이게)', () => {
    const s = code('src/components/home/HomeSections.tsx')
    // 스켈레톤 분기 **뒤에** 0건 → midBanner 만 반환하는 분기가 그대로 있어야 한다.
    const skel = s.indexOf('isLoading && visible.length === 0')
    const empty = s.indexOf('if (visible.length === 0) return', skel)
    expect(skel).toBeGreaterThan(-1)
    expect(empty).toBeGreaterThan(skel)
  })

  it('🔴 히어로 사진은 즉시 받는다 (lazy 금지 — 첫 화면 최상단)', () => {
    const s = code('src/components/home/HomeHeroDefault.tsx')
    expect(s).toMatch(/loading="eager"[\s\S]{0,80}fetchPriority="high"/)
    expect(s).not.toMatch(/loading="lazy"/)
  })
})

describe('홈 섹션 0-RTT — 피드와 섹션이 같은 화면이면 시드도 같이 와야 한다', () => {
  const read = (p: string) => readFileSync(p, 'utf-8')
  const WORKER = 'src/worker/index.ts'
  const SECTIONS = 'src/components/home/HomeSections.tsx'

  it('워커가 홈에서 SECTIONS 보조 슬롯을 잡는다', () => {
    const lines = read(WORKER).split('\n').map((l) => l.trim()).filter((l) => !l.startsWith('//'))
    expect(
      lines.some((l) => l.includes("ssrExtra = { slot: 'SECTIONS'") && l.includes("'/api/sections'")),
      '홈 보조 슬롯이 사라졌다 — 섹션만 브라우저가 따로 받아 늦게 끼어든다',
    ).toBe(true)
  })

  it('두 시드를 병렬로 받는다 (직렬이면 그만큼 TTFB 가 늘어난다)', () => {
    const s = read(WORKER)
    expect(s).toMatch(/Promise\.all\(\[\s*\n?\s*fetchSsrPayload\(ssrTarget/)
  })

  it('보조 시드는 fail-soft — 없으면 주입만 건너뛴다', () => {
    const s = read(WORKER)
    expect(s).toContain('if (ssrExtraPayload) {')
    expect(s).toContain('__SSR_INITIAL_SECTIONS__')
  })

  it('클라가 첫 render 에서 동기로 읽는다 (useEffect 면 한 프레임 늦다)', () => {
    const s = read(SECTIONS)
    expect(s).toMatch(/useMemo<HomeSection\[\] \| undefined>/)
    expect(s).toContain("getElementById('__SSR_INITIAL_SECTIONS__')")
    expect(s).toContain('initialData: ssrSections')
    // initialData 는 기본이 "신선함" — 보호가 없으면 시드가 낡아도 갱신이 안 된다.
    expect(s).toContain("refetchOnMount: 'always'")
  })

  it('깨진 시드가 홈을 못 열게 하지 않는다', () => {
    const s = read(SECTIONS)
    const seed = s.slice(s.indexOf('const ssrSections'), s.indexOf('const { data: sections'))
    expect(seed).toContain('catch')
  })

  it('/api/sections 가 예열·엣지캐시와 한 세트다 (self-fetch 가 콜드 D1 을 타면 의미 없다)', () => {
    expect(read('src/worker/cron/cache-prewarm.ts')).toContain("'/api/sections'")
    expect(read('src/features/sections/api/sections.routes.ts')).toContain("sectionsRoutes.get('/', edgeCache(120)")
  })
})
