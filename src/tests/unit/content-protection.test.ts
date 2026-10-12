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
import { stripComments } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf-8')
/** 주석에만 남아도 통과하는 함정을 피한다 — 판정은 항상 주석 제거본으로. */
const code = (s: string) => stripComments(s)

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
    // 🔁 2026-10-12 재조준: `read(BOT)`(원문) → `code()`(주석 제거본). 불변식은 그대로이고
    //   앵커만 옮겼다 — 원문을 보면 **"Googlebot 은 넣지 말 것" 같은 설명 주석 자체가 위반**으로
    //   잡힌다(실제로 그렇게 거짓 빨간불이 났다). 이 레포가 d1-migrate·robots 가드에서 두 번
    //   밟은 함정이고, 이 파일 머리말도 "판정은 항상 주석 제거본으로" 라고 적어 뒀다.
    const bot = code(read(BOT))
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

/**
 * 🔀 2026-10-11 — AI **검색·인용** 크롤러는 페이지를 허용, **API 는 계속 차단**.
 *
 * 대표 *"세계최고의 SEO, GEO를 자랑하게 만들어줘"* · *"우리 서비스로 트래픽이 몰려야해"*.
 *
 * 라이브 실측(`urdeal.kr/` HTML)이 결판냈다 — **엣지는 이미 둘을 가르는데 robots.txt 만 안 갈랐다**:
 *   GPTBot 403 · ClaudeBot 403                                  ← 학습
 *   OAI-SearchBot 200 · ChatGPT-User 200 · PerplexityBot 200     ← 검색·인용
 *   Claude-SearchBot 200 · Googlebot 200
 * 그 상태에서 robots.txt 는 검색·인용 쪽에게도 `Disallow: /` 를 주고 있었다. 그들은 robots 를
 * **지키는** 봇이라, 결과는 "우리를 링크로 인용해 줄 수 있는 크롤러만 돌려보내기" 였다.
 *
 * 이 테스트가 고정하는 것은 **비대칭 그 자체**다(한쪽만 보면 둘 다 "고치고" 싶어진다):
 *   · robots.txt    → 다섯이 차단 목록에 **없어야** 한다 (페이지 크롤 허용)
 *   · 헤더 차단 목록 → 다섯이 **있어야** 한다 (공개 JSON 수확은 403 유지)
 *
 * **못 막는 것**: 실제로 그 봇들이 우리 페이지를 크롤하는지 · ChatGPT·Perplexity 답변에
 * 인용되는지(둘 다 외부 판정이고 수일~수주 걸린다) · Cloudflare 엣지의 AI 봇 차단 설정
 * (대시보드이고 레포가 못 본다 — 대표만 바꾼다).
 */
describe('GEO — AI 검색·인용 크롤러는 페이지 허용 / API 차단 (비대칭이 의도다)', () => {
  /** 사업자가 "학습" 과 분리해 운영하는, 링크로 인용해 주는 크롤러들. */
  const AI_SEARCH = [
    'OAI-SearchBot',
    'ChatGPT-User',
    'PerplexityBot',
    'Perplexity-User',
    'Claude-SearchBot',
  ]
  /** 학습·벌크 데이터셋 쪽. 이쪽은 양쪽에서 계속 막는다. */
  const AI_TRAINING = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Claude-Web', 'CCBot', 'Bytespider']

  it('robots.txt 차단 목록에 AI 검색·인용 다섯이 없다', () => {
    const s = read(ROBOTS)
    for (const ua of AI_SEARCH) {
      expect(s, `robots 가 ${ua} 를 막고 있다 — 유입을 스스로 끊는다`).not.toMatch(
        new RegExp(`^User-agent: ${ua}$`, 'm'),
      )
    }
  })

  it('학습 크롤러는 robots.txt 에서 계속 차단된다 (분리가 전면 해제로 번지지 않았는지)', () => {
    const s = read(ROBOTS)
    for (const ua of AI_TRAINING) {
      expect(s, `robots 에 ${ua} 차단이 사라졌다`).toMatch(new RegExp(`^User-agent: ${ua}$`, 'm'))
    }
  })

  it('AI 검색·인용 다섯은 헤더 수확 목록에 남아 있다 (공개 JSON 벌크 수확 차단 유지)', () => {
    const bot = code(read(BOT))
    const block = bot.slice(bot.indexOf('const SCRAPER_UA_PATTERNS'))
    for (const ua of AI_SEARCH) {
      expect(block, `${ua} 가 수확 목록에서 빠졌다 — 가격표 API 가 열린다`).toContain(`/${ua}/i`)
    }
  })

  it('동작으로도 확인 — 다섯은 API 수확 봇으로 판정되고, 검색엔진은 아니다', async () => {
    const { isScraperUA } = await import('../../worker/middleware/bot-detection')
    for (const ua of AI_SEARCH) {
      expect(isScraperUA(`Mozilla/5.0 (compatible; ${ua}/1.0; +https://example.com/bot)`), ua).toBe(
        true,
      )
    }
    // 색인·공유 미리보기는 절대 막히지 않는다(이 서비스의 유입).
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)',
      'ur-live-ssr-prefetch/1.0',
    ]) {
      expect(isScraperUA(ua), ua).toBe(false)
    }
  })

  // ── 🔀 2026-10-12: 라이브 실측에서 드러난 **형제 비대칭** 셋 ──
  //   같은 종류인데 목록에 없어서 API 가 열려 있었다(실측: 형제는 403, 이 셋은 200).
  //   `MistralAI-User` = `ChatGPT-User`·`Perplexity-User` 와 같은 사용자-트리거,
  //   `MistralAI-Index`·`YouBot` = `OAI-SearchBot` 과 같은 AI 답변용 색인.
  const AI_ANSWER_SIBLINGS = ['MistralAI-User', 'MistralAI-Index', 'YouBot']

  it('형제 비대칭 셋도 API 수확 목록에 있다 (실측으로 드러난 구멍)', async () => {
    const bot = code(read(BOT))
    const block = bot.slice(bot.indexOf('const SCRAPER_UA_PATTERNS'))
    for (const ua of AI_ANSWER_SIBLINGS) {
      expect(block, `${ua} 가 수확 목록에 없다 — 형제는 403 인데 이것만 열린다`).toContain(`/${ua}/i`)
    }
    const { isScraperUA } = await import('../../worker/middleware/bot-detection')
    for (const ua of AI_ANSWER_SIBLINGS) {
      expect(isScraperUA(`Mozilla/5.0 (compatible; ${ua}/1.0; +https://example.com/bot)`), ua).toBe(true)
    }
  })

  it('그 셋의 HTML 은 안 가린다 (이 미들웨어는 /api/* 전용 — GEO 손실 0)', () => {
    // 배선이 `/api/` 로 시작하는 경로에만 붙어 있어야 한다. HTML 라우트에 한 줄이라도
    // 붙으면 AI 검색봇이 페이지를 못 받아 **인용 유입이 통째로** 끊긴다(비대칭의 전제가 무너진다).
    const lines = read(WORKER)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => !l.startsWith('//'))
      .filter((l) => l.includes('contentScrapeGuard'))
    expect(lines.length).toBeGreaterThan(0)
    for (const l of lines) {
      if (!l.startsWith('app.use(')) continue
      expect(l, `HTML 경로에 수확 가드가 붙었다: ${l}`).toMatch(/app\.use\('\/api\//)
    }
  })

  it('robots 전용 토큰은 UA 로 막을 수 없다 — "살리려고" LEGIT 을 좁히지 말 것', async () => {
    // 🚧 애플·구글은 `Applebot-Extended`·`Google-Extended` 를 **robots.txt 토큰으로만** 쓴다.
    //   크롤러가 보내는 UA 는 늘 `Applebot`·`Googlebot` 이라 UA 차단은 원리상 불가능하고,
    //   실측에서도 `Applebot-Extended` UA 는 API 200 이었다(수확 목록에 있는데도).
    //   그 항목을 '살리려고' LEGIT 의 `/Applebot/i` 를 좁히면 **애플 검색 색인이 통째로 막힌다.**
    const { isScraperUA } = await import('../../worker/middleware/bot-detection')
    expect(isScraperUA('Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)')).toBe(false)
    const bot = code(read(BOT))
    const legit = bot.slice(bot.indexOf('const LEGIT_BOT_PATTERNS'), bot.indexOf('const SCRAPER_UA_PATTERNS'))
    expect(legit, 'LEGIT 에서 /Applebot/i 가 좁혀졌다 — 애플 검색 색인이 막힌다').toContain('/Applebot/i')
    // 실제 학습 거부는 robots 가 한다 — 그쪽이 비면 이 정책은 아무 데서도 집행되지 않는다.
    // ⚠️ `Google-Extended` 는 **일부러 빠져 있다**(2026-10-12 대표 승인 — 구글은 그 토큰이
    //    학습과 그라운딩을 한 덩어리로 묶어서, 막는 동안 제미나이가 우리를 근거로 쓸 수 없었다).
    //    그래서 여기 넣으면 안 된다 — 제가 처음 넣었고 이 가드가 바로 잡아 줬다.
    const robots = read(ROBOTS)
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n')
    expect(robots, 'robots 에서 Applebot-Extended 차단이 사라졌다').toMatch(/^User-agent: Applebot-Extended$/m)
    expect(robots, 'Google-Extended 가 robots 차단으로 되살아났다 — 제미나이 인용이 끊긴다').not.toMatch(
      /^User-agent: Google-Extended$/m,
    )
  })

  it('다섯에게 전용 User-agent 그룹을 만들지 않았다 (그룹은 합쳐지지 않아 비공개 Disallow 가 통째로 무시된다)', () => {
    const s = read(ROBOTS)
    // robots.txt 그룹은 **가장 구체적인 하나만** 적용된다. 제 이름 그룹이 생기면 그 봇은
    // `User-agent: *` 의 `/admin`·`/seller/login` … Disallow 를 전부 무시한다. 목록을 두 벌로
    // 베끼는 것도 답이 아니다(반드시 갈린다) — 그래서 "그냥 빼서 `*` 로 떨어뜨린다" 가 정답이다.
    for (const ua of AI_SEARCH) {
      expect(s, `${ua} 전용 그룹이 생겼다`).not.toContain(`User-agent: ${ua}`)
    }
    // `*` 그룹이 비공개 경로를 실제로 막고 있어야 그 폴백이 안전하다.
    const star = s.slice(s.indexOf('User-agent: *'))
    const starGroup = star.split('\n\n')[0]
    expect(starGroup).toMatch(/^Allow: \/$/m)
    for (const priv of ['/admin', '/seller/login']) {
      expect(starGroup, `* 그룹이 ${priv} 를 안 막는다`).toMatch(
        new RegExp(`^Disallow: ${priv.replace('/', '\\/')}$`, 'm'),
      )
    }
  })
})
