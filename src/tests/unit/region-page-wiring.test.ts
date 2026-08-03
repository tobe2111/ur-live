/**
 * 🗺️ 도시별 색인 페이지 **배선** 불변식 〔2026-08-03〕
 *
 * 앞 파일(`region-slugs.test.ts`)이 주소 파싱을 지킨다면, 이 파일은 **연결**을 지킨다.
 * 이 기능은 조각 다섯이 전부 살아 있어야 성립하고, 하나만 빠져도 **에러 없이** 무력화된다:
 *
 *   ① 라우트가 App.tsx 에 있다            → 없으면 링크가 404
 *   ② 내부 링크가 존재한다(푸터·그리드)   → 없으면 크롤러가 페이지를 발견 못 함(가장 조용한 실패)
 *   ③ sitemap 이 지역 URL 을 발행한다     → 없으면 색인 요청 자체가 안 감
 *   ④ 서버 메타가 지역별로 갈린다         → 없으면 Yeti 에겐 전부 홈 메타(=중복)
 *   ⑤ 지역 페이지는 전국 폴백을 안 한다   → 하면 모든 도시 페이지가 같은 콘텐츠(중복 색인)
 *
 * ②가 특히 위험하다 — 링크가 없어도 페이지는 정상으로 보이고, 테스트도 배포도 전부 초록이다.
 * 모바일 우선 색인에서 홈은 풀스크린 지도(RestaurantMapPage)라 지역 링크가 **없고**, 그래서
 * 푸터의 `/region` 한 줄이 사실상 유일한 진입로다. 그 줄이 지워지면 이 기능 전체가 무음으로 죽는다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 실제 색인 여부. 우리가 index 를 내보내는 것과 구글이 색인하는 것은 다른 일이다.
 *   - HTMLRewriter 실배선(Workers 런타임 전용) — 배포 후 `curl`로만 판정 가능.
 *   - 라이브 데이터. 여기선 소스 텍스트와 순수 함수만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import { resolveRegionSeo } from '@/worker/utils/surface-ssr-meta'
import { REGION_INDEX_MIN_DEALS } from '@/shared/constants/region-slugs'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 라우트 배선', () => {
  const app = read('src/App.tsx')

  it('/region 3종 라우트가 App.tsx 에 있다', () => {
    expect(app).toMatch(/path="\/region"/)
    expect(app).toMatch(/path="\/region\/:sido"/)
    expect(app).toMatch(/path="\/region\/:sido\/:sigungu"/)
  })

  it('라우트는 기능 플래그로 감싸지 않는다 — 색인된 URL 을 404 로 만들면 회수에 수 주가 걸린다', () => {
    // 플래그는 '노출·색인'만 끈다. 라우트 자체가 사라지면 이미 나간 링크가 전부 죽는다.
    const routeBlock = app.slice(app.indexOf('path="/region"') - 400, app.indexOf('path="/region/:sido/:sigungu"') + 120)
    expect(routeBlock).not.toMatch(/REGION_PAGES_ENABLED\s*&&/)
  })
})

describe('② 내부 링크 — 크롤러가 지역 페이지에 도달하는 경로', () => {
  it('푸터에 /region 링크가 있다 (모바일 우선 색인의 유일한 진입로)', () => {
    expect(read('src/components/main/SiteFooter.tsx')).toMatch(/href="\/region"/)
  })

  it('지역 링크 그리드는 딜이 충분한 지역만 링크한다 — 빈 페이지로 보내면 soft-404', () => {
    const grid = read('src/components/main/RegionLinkGrid.tsx')
    expect(grid).toMatch(/filter\(\s*s\s*=>\s*s\.indexable\s*\)/)
  })

  it('PC 홈이 그리드를 렌더한다', () => {
    expect(read('src/pages/pc-home/PcHomePage.tsx')).toMatch(/<RegionLinkGrid\b/)
  })
})

describe('③ sitemap 발행', () => {
  const sm = read('src/worker/routes/sitemap.routes.ts')

  it('지역 URL 을 발행한다', () => {
    expect(sm).toMatch(/computeRegionStats/)
    expect(sm).toMatch(/loc:\s*'\/region'/)
  })

  it('indexable 하지 않은 지역은 건너뛴다 — 문턱을 지우면 빈 URL 이 대량 제출된다', () => {
    // `if (!r.indexable) continue` / `if (!s.indexable) continue` 두 겹이 다 있어야 한다.
    const guards = sm.match(/if\s*\(!\w+\.indexable\)\s*continue/g) ?? []
    expect(guards.length).toBeGreaterThanOrEqual(2)
  })

  it('sitemap 과 페이지가 같은 집계 함수를 쓴다 — 따로 세면 제출한 URL 을 페이지가 noindex 로 막는다', () => {
    expect(sm).toMatch(/from '\.\.\/\.\.\/features\/group-buy\/api\/regions\.routes'/)
  })
})

describe('④ 서버 메타 — Yeti 는 JS 를 돌리지 않는다', () => {
  const origin = 'https://urdeal.kr'

  it('시/도·시군구마다 제목이 갈린다', () => {
    const seoul = resolveRegionSeo('/region/서울', origin)
    const jung = resolveRegionSeo('/region/서울/중구', origin)
    expect(seoul?.pageTitle).toContain('서울')
    expect(jung?.pageTitle).toContain('서울 중구')
    expect(seoul?.pageTitle).not.toBe(jung?.pageTitle)
  })

  it('canonical 이 자기 경로를 가리킨다', () => {
    const r = resolveRegionSeo('/region/서울/중구', origin)
    expect(r?.canonical).toBe(`${origin}/region/${encodeURIComponent('서울')}/${encodeURIComponent('중구')}`)
  })

  it('전체형 주소 표기로 들어와도 정규화된 시/도로 처리', () => {
    expect(resolveRegionSeo('/region/강원특별자치도', origin)?.pageTitle).toContain('강원')
  })

  it('지어낸 지역은 noindex — 크롤러가 URL 을 만들어내는 공간을 없앤다', () => {
    expect(resolveRegionSeo('/region/아틀란티스', origin)?.noindex).toBe(true)
    expect(resolveRegionSeo('/region/서울/없는동네', origin)?.noindex).toBe(true)
  })

  it('/region 허브도 메타를 갖는다', () => {
    const hub = resolveRegionSeo('/region', origin)
    expect(hub?.canonical).toBe(`${origin}/region`)
    expect(hub?.noindex).toBeUndefined()
  })

  it('워커가 실제로 호출한다 — 이 배선이 빠지면 단위 테스트는 다 통과하는데 라이브엔 홈 메타가 나간다', () => {
    const w = read('src/worker/index.ts')
    expect(w).toMatch(/resolveRegionSeo/)
    // 표에 없는 경로일 때 폴백으로 붙어야 한다(?? 체인). 그냥 import 만 돼 있으면 안 된다.
    expect(w).toMatch(/resolveConsumerSurfaceSeo\([^)]*\)\s*\?\?\s*resolveRegionSeo\(/)
  })

  it('문구 SSOT(consumer-surfaces)는 지역 표를 import 하지 않는다 — 크리티컬 청크 회귀 방지', () => {
    // 🔴 2026-08-03 실제 사고: 여기서 region-slugs 를 import 했더니 `app-constants` 청크가
    //    첫 페인트로 딸려왔다(check-critical-chunks 가 CI 에서 잡음). 워커 전용 모듈로 옮겨 해결.
    expect(read('src/shared/seo/consumer-surfaces.ts')).not.toMatch(/region-slugs/)
  })

  it('기존 표면(/vouchers)·area-report 는 영향 없음', () => {
    expect(resolveConsumerSurfaceSeo('/vouchers', '', origin)?.canonical).toBe(`${origin}/vouchers`)
    expect(resolveConsumerSurfaceSeo('/area-report/강남구', '', origin)?.pageTitle).toContain('강남구')
  })
})

describe('⑤ 지역 페이지는 전국 폴백을 하지 않는다', () => {
  it('GroupBuyFeed 의 빈-결과 폴백이 regionRef 에는 걸리지 않는다', () => {
    const feed = read('src/pages/main-home/GroupBuyFeed.tsx')
    // 폴백 조건 줄에 regionRef 가 끼어들면 모든 도시 페이지가 '전국 목록'이라는 동일 콘텐츠가 된다.
    const line = feed.split('\n').find(l => l.includes('out.length === 0') && l.includes('fb = true'))
    expect(line, '폴백 조건 줄을 찾지 못했다 — 코드가 옮겨졌으면 이 가드를 갱신할 것').toBeTruthy()
    expect(line).not.toMatch(/regionRef/)
  })

  it('regionRef 가 오면 행정구역 매칭으로 거른다', () => {
    const feed = read('src/pages/main-home/GroupBuyFeed.tsx')
    expect(feed).toMatch(/if\s*\(regionRef\)\s*return\s+addressInRegion\(/)
  })
})

describe('색인 문턱', () => {
  it('1보다 크다 — 1이면 상품 하나짜리 빈 페이지가 색인된다', () => {
    expect(REGION_INDEX_MIN_DEALS).toBeGreaterThan(1)
  })
})
