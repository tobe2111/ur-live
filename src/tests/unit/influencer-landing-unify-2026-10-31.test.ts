/**
 * 📣 소개 파트너 모집 랜딩은 `/influencer` 하나다 (2026-10-31 대표 *"인플루언서용은 하나로 통일하자. /influencer 이걸로"*).
 *
 * ## 무엇이 문제였나
 * 같은 사람(남의 딜을 소개해 수익을 내려는 사람)에게 같은 말을 하는 랜딩이 **둘**이었다.
 *   - `/creators` — `CreatorsPage`(PC 판 · 실제 화면 캡처 · 신청서 연결). 푸터가 여기로 왔다.
 *   - `/influencer` — `InfluencerLandingPage`(짧은 판). 앱 안 링크 0, sitemap 에만 있었다.
 * 둘 다 sitemap 에 올라가 검색에서 서로 경쟁했고, 어느 쪽이 정식인지 아무도 모른 채 따로 고쳐지고 있었다
 * (2026-08-26 에 한쪽만 "없는 혜택 광고" 를 걷어냈다). `/business`↔`/partners`(2026-09-16)와 같은 클래스다.
 *
 * ## 처방
 * 내용은 `CreatorsPage` 를 `/influencer` 에서 띄우고, 짧은 판은 지운다. `/creators` 는 **지우지 않고 301** —
 * 푸터·안내 메일·sitemap 으로 밖에 뿌려진 링크가 있다. 신청서 `/creators/apply`·`/start` 는 다른 페이지라 그대로.
 *
 * ## 이 시험이 **못** 보는 것
 * 문구가 좋은지 · 검색엔진이 실제로 `/influencer` 를 정본으로 받는지(수일~수주, 서치콘솔은 대표만 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'
import { resolveConsumerAlias } from '@/shared/seo/consumer-redirects'

const APP = stripComments(readFileSync('src/App.tsx', 'utf-8'))

describe('① 페이지는 하나', () => {
  it('짧은 판 InfluencerLandingPage 가 되살아나지 않는다', () => {
    expect(existsSync('src/pages/InfluencerLandingPage.tsx'), '같은 사람에게 같은 말을 하는 두 번째 랜딩이었다').toBe(false)
  })

  it('/influencer 가 모집 랜딩(CreatorsPage)을 띄운다', () => {
    expect(APP).toMatch(/path="\/influencer"\s+element=\{<CreatorsPage\s*\/>\}/)
  })

  it('/creators 는 지우지 않고 /influencer 로 보낸다 (SPA 안 이동)', () => {
    expect(APP).toMatch(/path="\/creators"\s+element=\{<Navigate to="\/influencer" replace\s*\/>\}/)
  })
})

describe('② 서버 301 — 밖에 뿌려진 링크를 살린다', () => {
  it('/creators → /influencer', () => {
    expect(resolveConsumerAlias('/creators')).toBe('/influencer')
    expect(resolveConsumerAlias('/creators/')).toBe('/influencer')
  })

  it('신청서·시작 페이지는 옮겨가지 않는다 (정확 일치 별칭)', () => {
    for (const p of ['/creators/apply', '/creators/start', '/influencer', '/influencer/dashboard']) {
      expect(resolveConsumerAlias(p), p).toBeNull()
    }
  })
})

describe('③ 옛 주소로 새로 링크하지 않는다', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) { if (name !== 'tests') walk(p, out) }
      else if (/\.(tsx?|mjs)$/.test(name)) out.push(p)
    }
    return out
  }
  // 별칭 표 · 라우트 선언 · sitemap 의 "옮겼다" 주석만 허용한다(주석은 걷어내고 본다).
  const ALLOW = new Set(['src/shared/seo/consumer-redirects.ts', 'src/App.tsx'])

  it('소스 어디에도 `/creators` (하위 경로 제외) 를 가리키는 링크가 없다', () => {
    const files = walk('src').filter((f) => !ALLOW.has(f))
    expect(files.length, '검사 대상 0 이면 통과가 아니라 고장이다').toBeGreaterThan(500)
    const hits: string[] = []
    for (const f of files) {
      const code = stripComments(readFileSync(f, 'utf-8'))
      // **링크로** 쓰이는 `/creators`(하위 경로 제외)만 본다. 레이아웃 접두사 목록의 `'/creators'` 는
      // 신청서(`/creators/apply`·`/start`)를 덮으려고 일부러 남긴 것이라 링크가 아니다.
      if (/(?:href=\{?|to=\{?|navigate\(|href:\s*)["'`]\/creators(?![/\w-])|urdeal\.kr\/creators(?![/\w-])/.test(code)) hits.push(f)
    }
    expect(hits, '301 을 거치는 링크다 — /influencer 로 바로 보낼 것').toEqual([])
  })

  it('sitemap 은 /influencer 를 한 번 제출하고 /creators 는 제출하지 않는다', () => {
    const sm = stripComments(readFileSync('src/worker/routes/sitemap.routes.ts', 'utf-8'))
    expect(sm.match(/loc: '\/influencer'/g)?.length).toBe(1)
    expect(sm).not.toMatch(/loc: '\/creators'/)
  })

  it('푸터는 사람을 "크리에이터" 라 부르지 않는다 (명칭 SSOT — 소개 파트너)', () => {
    for (const f of ['src/components/main/SiteFooter.tsx', 'src/components/MobileFooter.tsx', 'src/worker/utils/home-footer-noscript.ts']) {
      const code = stripComments(readFileSync(f, 'utf-8'))
      expect(code, f).not.toContain('크리에이터 모집')
      expect(code, f).toContain('소개 파트너 모집')
    }
  })
})
