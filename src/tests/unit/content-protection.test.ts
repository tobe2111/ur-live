/**
 * 🛡️ 사진 저장 억제 + 크롤링 차단 (2026-08-22 대표 지시)
 *
 * 이 두 기능은 **한 쪽만 살아 있으면 반쪽**이라 가드가 필요하다:
 *   · robots.txt 는 *부탁*이라 안 지키는 봇이 실제 문제 → 헤더 차단이 짝이다.
 *   · JS `contextmenu` 는 iOS 에서 아예 안 뜬다 → CSS `-webkit-touch-callout` 이 짝이다.
 * 한쪽을 지워도 화면은 멀쩡해 보이므로 리뷰로는 절대 안 걸린다.
 *
 * 이 테스트가 **못 막는 것**: 실제 봇이 정말 403 을 받는지(런타임 미들웨어 순서),
 * 그리고 iOS 실기기에서 길게 눌렀을 때의 동작. 둘 다 배포 후 실측 영역이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
/** 주석에만 남아도 통과하는 함정을 피한다 — 판정은 항상 주석 제거본으로. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const BOT = 'src/worker/middleware/bot-detection.ts'
const WORKER = 'src/worker/index.ts'
const ROBOTS = 'public/robots.txt'
const PROTECT = 'src/lib/image-protect.ts'
const MAIN = 'src/main.tsx'
const CSS = 'src/index.css'

describe('크롤링 차단 — robots.txt 와 헤더 차단은 한 쌍이다', () => {
  it('robots.txt 가 AI 학습·수확 크롤러를 차단한다', () => {
    const s = read(ROBOTS)
    for (const ua of ['GPTBot', 'CCBot', 'ClaudeBot', 'Bytespider', 'AhrefsBot', 'SemrushBot']) {
      expect(s, `robots 에 ${ua} 차단이 없다`).toMatch(new RegExp(`^User-agent: ${ua}$`, 'm'))
    }
    // 차단 그룹이 실제로 Disallow 를 갖는가 — User-agent 만 늘어놓고 규칙이 없으면 무효다.
    const idx = s.indexOf('User-agent: GPTBot')
    expect(idx).toBeGreaterThan(-1)
    expect(s.slice(idx).split('\n\n')[0]).toMatch(/^Disallow: \/$/m)
  })

  it('robots 의 차단 목록이 헤더 차단 목록과 어긋나지 않는다', () => {
    const robots = read(ROBOTS)
    const bot = code(read(BOT))
    // robots 에서 막았는데 헤더에서 안 막으면 = robots 를 무시하는 봇에게 무방비.
    const missing: string[] = []
    for (const m of robots.matchAll(/^User-agent: ([A-Za-z][\w.-]*)$/gm)) {
      const ua = m[1]
      if (ua === '*') continue
      if (!new RegExp(`/${ua.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}/i`).test(bot)) missing.push(ua)
    }
    expect(missing, `robots 만 막고 헤더는 안 막는 봇: ${missing.join(', ')}`).toEqual([])
  })

  it('검색엔진·카카오 스크랩은 절대 수확 목록에 없다 (색인·공유 미리보기 = 유입)', () => {
    const bot = read(BOT)
    const scraperBlock = bot.slice(bot.indexOf('const SCRAPER_UA_PATTERNS'))
    for (const good of ['Googlebot', 'Yeti', 'KakaoTalk', 'Daum', 'facebookexternalhit', 'NaverBot']) {
      expect(scraperBlock, `${good} 이 수확 목록에 들어 있다`).not.toContain(good)
    }
    const robots = read(ROBOTS)
    for (const good of ['Googlebot', 'Yeti', 'Daum', 'KakaoTalk']) {
      expect(robots).not.toMatch(new RegExp(`^User-agent: ${good}$`, 'm'))
    }
  })

  it('빈 UA 는 통과시킨다 — 공개 목록에서 빈 UA 차단은 인앱 웹뷰를 깬다', () => {
    const s = code(read(BOT))
    const fn = s.slice(s.indexOf('export function isScraperUA'))
    expect(fn).toMatch(/if \(!userAgent \|\| userAgent\.trim\(\) === ''\) return false/)
  })

  it('내부 self-fetch UA 가 수확 봇으로 오인되지 않는다 (SSR·예열이 멎는다)', async () => {
    const { isScraperUA } = await import('../../worker/middleware/bot-detection')
    expect(isScraperUA('ur-live-ssr-prefetch/1.0')).toBe(false)
    expect(isScraperUA('ur-live-cache-prewarm/1.0')).toBe(false)
    expect(isScraperUA(undefined)).toBe(false)
    expect(isScraperUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(false)
    expect(isScraperUA('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(false)
    expect(isScraperUA('GPTBot/1.2')).toBe(true)
    expect(isScraperUA('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)')).toBe(true)
  })

  it('소비자 콘텐츠 API 에 실제로 배선돼 있다 (목록만 막으면 id 훑기는 그대로)', () => {
    // ⚠️ 여기서는 `code()` 를 쓰지 않는다 — 경로 `'/api/products/*'` 안의 `/*` 가
    //    블록주석 시작으로 오인돼 뒤쪽이 통째로 잘린다(처음에 실제로 그렇게 헛돌았다).
    //    대신 **줄 단위**로 보고, 주석 처리된 줄(`//` 로 시작)은 배선으로 치지 않는다.
    const lines = read(WORKER)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => !l.startsWith('//'))
    expect(lines.some((l) => l.includes('scrapeProtection()'))).toBe(true)
    for (const p of ['/api/products/*', '/api/group-buy/*', '/api/vouchers/*', '/api/sections']) {
      expect(
        lines.some((l) => l === `app.use('${p}', contentScrapeGuard);`),
        `${p} 에 수확 가드 미배선`,
      ).toBe(true)
    }
  })

  it('로그인용 botProtection 을 공개 목록에 재사용하지 않는다 (빈 UA 오탐)', () => {
    const s = read(WORKER)
    for (const m of s.matchAll(/app\.use\('(\/api\/(?:products|group-buy|vouchers|sections|curator)[^']*)',\s*([A-Za-z]+)/g)) {
      expect(m[2], `${m[1]} 에 botProtection 계열이 걸렸다`).not.toMatch(/^bot/)
    }
  })
})

describe('사진 저장 억제 — JS 와 CSS 는 한 쌍이다', () => {
  it('이미지에서만 우클릭을 막는다 (페이지 전체 차단 금지)', () => {
    const s = code(read(PROTECT))
    expect(s).toContain("addEventListener(\n    'contextmenu'")
    // 이미지 판정을 거치지 않고 무조건 preventDefault 하면 주소 복사까지 죽는다.
    const ctx = s.slice(s.indexOf("'contextmenu'"), s.indexOf("'dragstart'"))
    expect(ctx).toContain('imageAtEvent')
    expect(ctx).toContain('isEditable')
  })

  it('입력 요소는 건드리지 않는다 (붙여넣기 메뉴 유지)', () => {
    const s = code(read(PROTECT))
    expect(s).toMatch(/tag === 'INPUT'/)
    expect(s).toMatch(/isContentEditable/)
  })

  it('대시보드는 제외한다 (운영자는 사진을 저장해야 한다)', () => {
    const s = code(read(PROTECT))
    const m = s.match(/EXEMPT_PREFIXES\s*=\s*\[([^\]]*)\]/)
    expect(m, 'EXEMPT_PREFIXES 가 사라졌다').toBeTruthy()
    for (const p of ['/admin', '/seller', '/agency', '/wholesale']) expect(m![1]).toContain(p)
  })

  it('엔트리에서 실제로 설치된다', () => {
    const s = code(read(MAIN))
    expect(s).toContain('installImageProtection()')
  })

  it('iOS 길게 눌러 저장이 막힌다 (JS contextmenu 는 iOS 에서 안 뜬다)', () => {
    // ⚠️ 2026-08-22 CI 가 잡은 헛도는 판정 수리: 예전엔 "파일 어딘가에 `-webkit-touch-callout: none`
    //    이 있는가" 로 봤다. 그런데 **기존 `html.native-app *` 규칙**(네이티브 앱 터치 최적화)이
    //    같은 속성을 이미 갖고 있어서, 사진 보호 블록을 통째로 지워도 초록이 떴다.
    //    ⇒ 판정은 반드시 **`img`/`picture`/`canvas` 셀렉터에 앵커**해야 한다.
    const s = read(CSS)
    const block = s.match(
      /(?:^|\n)img,\s*\n\s*picture,\s*\n\s*canvas\s*\{([^}]*)\}/,
    )
    expect(block, '사진(img/picture/canvas) 대상 보호 블록이 사라졌다 — 모바일에선 아무것도 안 막힌다')
      .toBeTruthy()
    expect(block![1]).toMatch(/-webkit-touch-callout:\s*none/)
    expect(block![1]).toMatch(/-webkit-user-drag:\s*none/)
    // 대시보드는 되돌린다 — 운영자는 상품 사진을 저장·교체해야 한다.
    const revert = s.match(
      /\.admin-light-theme img[^{]*\{([^}]*)\}/,
    )
    expect(revert, '대시보드 되돌림 규칙이 사라졌다').toBeTruthy()
    expect(revert![1]).toMatch(/-webkit-touch-callout:\s*default/)
  })

  it('텍스트 선택은 막지 않는다 (주소·전화 복사는 정상 사용)', () => {
    const s = code(read(PROTECT))
    expect(s).not.toMatch(/user-select|selectstart|preventDefault\(\)\s*;?\s*}\s*,\s*{\s*capture:\s*true\s*}\s*\)\s*$/m)
    expect(s).not.toContain("'copy'")
  })
})
