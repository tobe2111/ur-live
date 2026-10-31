/**
 * 🏷️ **소비자 표면 제목의 계약** (2026-10-14 — 대표 *"다 해주고 머지 후 또 개선점 찾아"*)
 *
 * ## 계약이 둘이고 둘 다 깨져 있었다
 * `CONSUMER_SURFACE_SEO` 의 `title` 필드는 자기 선언에 *"og/twitter title (사이트명 접미사 **없이**)"*
 * 이라고 못박는다. 접미사는 `withSiteName` **한 곳**에서만 붙는다(그 함수 머리말의 2026 실측 버그
 * `교환권 - 유어딜 - 유어딜` 이 그 규칙의 출처다).
 *
 *     ① 표가 접미사를 박아 뒀다
 *        `/gdpr`        'Privacy Policy (GDPR) - YourDeal'  → 라이브 `<title>` 에 브랜드 **2회**
 *                       (`withSiteName` 은 `유어딜` 만 보므로 영문 표기를 중복으로 못 센다)
 *        `/partnership` '광고/제휴 문의 - 유어딜'            → 증상은 없지만 **같은 모양**
 *
 *     ② 페이지가 제목을 손으로 적어 표와 갈렸다 (같은 URL, 크롤러에 따라 다른 제목)
 *        `/`      표 '유어딜 - 우리 동네 맛집·카페·뷰티 이용권 할인'
 *                 화면 '유어딜 — 동네 이용권·공동구매·교환권을 할인가로'   ← em-dash 까지 다르다
 *        `/about` 표 '서비스 소개 - 유어딜은 이렇게 작동합니다'
 *                 화면 '서비스 소개 - 유어딜'
 *
 * ②가 특히 고약하다: `<SEO>`(react-helmet)는 **JS 렌더 후**라 Googlebot 은 화면 값을 보고,
 * 네이버 Yeti 는 서버가 주입한 **표의 값**을 본다 ⇒ **한 URL 에 두 제목.** 에러가 없어서
 * 재 본 사람만 안다.
 *
 * ## 🩸 이 시험을 쓰다 내가 틀린 것 (측정 방법 교훈)
 * 처음엔 표를 **정규식으로 파싱**해 세었고 `/gdpr` 1건만 나왔다. 본문 길이를 700자로 캡했는데
 * `/partnership` 항목의 주석이 그보다 길어 **title 이 캡 밖으로 밀려 안 잡혔다.**
 * ⇒ 이 시험은 표를 **import 한다.** 소스를 정규식으로 긁어 세지 말 것(오늘 네 번째 측정 오류였다).
 *
 * ⚠️ **이 시험이 못 보는 것**: 제목이 *좋은지*(길이·키워드·중복)는 안 본다 · 라이브에서 실제로
 *   무엇이 서빙되는지도 안 본다(그건 배포 후 UA 실측) · `<SEO>` 를 안 쓰고 직접 `document.title` 을
 *   만지는 코드가 있으면 못 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { CONSUMER_SURFACE_SEO, withSiteName, CONSUMER_SITE_NAME } from '@/shared/seo/consumer-surfaces'

type Row = { crumb?: string; title: string; description: string; noindex?: boolean }
const TABLE = CONSUMER_SURFACE_SEO as unknown as Record<string, Row>
const ROWS = Object.entries(TABLE)

/**
 * 제목이 **브랜드 접미사로 끝나는가**. 브랜드가 *앞*에 오는 것은 정상이다
 * (`유어딜 이용약관`·`유어딜 시작하기`) — 계약이 금지하는 것은 **접미사**다.
 * 영문 표기까지 함께 본다: `/gdpr` 이 터진 이유가 정확히 `withSiteName` 이 영문을 못 본 것이다.
 */
const BRAND_SUFFIX = /[-|·–—]\s*(유어딜|YourDeal|UrDeal|urdeal)\s*$/

const ROOT = process.cwd()
function walkTsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git|dist/.test(p)) walkTsx(p, out) }
    else if (/\.tsx$/.test(e.name)) out.push(p)
  }
  return out
}

/** `<SEO … title="리터럴" … url="/경로">` 를 (파일, url, title) 로 뽑는다. 속성 순서 둘 다 본다. */
function hardcodedSeoTitles(): Array<[string, string, string]> {
  const hits: Array<[string, string, string]> = []
  for (const f of walkTsx(join(ROOT, 'src/pages'))) {
    const src = readFileSync(f, 'utf-8')
    for (const m of src.matchAll(/<SEO\b[^>]*?title="([^"]+)"[^>]*?url="(\/[^"]*)"/g)) hits.push([relative(ROOT, f), m[2], m[1]])
    for (const m of src.matchAll(/<SEO\b[^>]*?url="(\/[^"]*)"[^>]*?title="([^"]+)"/g)) hits.push([relative(ROOT, f), m[1], m[2]])
  }
  return hits
}

describe('소비자 표면 제목 계약 (2026-10-14)', () => {
  it('① 측정이 헛돌지 않는다 (표·파일 수 하한 + 판정식 자기검사)', () => {
    // 🔴 하한이 없으면 표가 비거나 경로가 낡아도 아래 전부가 **통과**한다.
    expect(ROWS.length).toBeGreaterThanOrEqual(25)
    expect(walkTsx(join(ROOT, 'src/pages')).length).toBeGreaterThanOrEqual(50)
    // 판정식이 실제로 발화하는가 — 안 발화하는 정규식으로 "0건" 을 선언하는 것이 이 레포의 단골 사고다.
    expect(BRAND_SUFFIX.test('광고/제휴 문의 - 유어딜')).toBe(true)
    expect(BRAND_SUFFIX.test('Privacy Policy (GDPR) - YourDeal')).toBe(true)
    expect(BRAND_SUFFIX.test('유어딜 이용약관')).toBe(false)          // 앞에 오는 것은 정상
    expect(BRAND_SUFFIX.test('쇼핑 - 유어딜 상품 모아보기')).toBe(false) // 가운데도 정상
  })

  it('② 표의 title 이 **브랜드 접미사로 끝나지 않는다** (접미사는 withSiteName 한 곳에서만)', () => {
    const bad = ROWS.filter(([, v]) => BRAND_SUFFIX.test(v.title)).map(([p, v]) => `${p} → ${v.title}`)
    expect(bad).toEqual([])
  })

  it('③ 렌더된 제목에 브랜드가 두 번 들어가지 않는다', () => {
    const bad: string[] = []
    for (const [p, v] of ROWS) {
      const t = withSiteName(v.title)
      const n = (t.match(new RegExp(CONSUMER_SITE_NAME, 'g')) || []).length + (t.match(/YourDeal|UrDeal/g) || []).length
      if (n >= 2) bad.push(`${p} → ${t}`)
    }
    expect(bad).toEqual([])
  })

  it('④ 표에 항목이 있는 경로는 페이지가 **제목을 손으로 적지 않는다** (한 URL 두 제목 차단)', () => {
    const all = hardcodedSeoTitles()
    // 🔴 스캐너가 0건을 돌려주면 아래 단언이 **무조건 통과**한다(정규식·경로가 낡은 경우).
    //   표 **밖** 경로의 리터럴 제목은 정상이고(어드민 등 표에 없는 화면) 실측 53건이다 —
    //   그 숫자가 스캐너가 살아 있다는 증거다.
    expect(all.length).toBeGreaterThanOrEqual(30)
    expect(all.filter(([, url]) => !(url in TABLE)).length).toBeGreaterThanOrEqual(30)
    const bad = all.filter(([, url]) => url in TABLE).map(([f, url, t]) => `${f} ${url} → ${t}`)
    expect(bad).toEqual([])
  })

  it('⑤ 반대 방향 — 브랜드가 **앞·가운데** 오는 제목은 그대로 둔다', () => {
    // 🔴 ②를 "제목에 브랜드 금지" 로 조이면 `유어딜 이용약관`·`유어딜 시작하기` 처럼 **일부러**
    //   브랜드로 시작하는 제목까지 깨진다(그 여덟은 의도다). 과조임 방향을 여기서 막는다.
    const withBrand = ROWS.filter(([, v]) => v.title.includes(CONSUMER_SITE_NAME))
    expect(withBrand.length).toBeGreaterThanOrEqual(5)
    for (const [, v] of withBrand) expect(BRAND_SUFFIX.test(v.title)).toBe(false)
  })

  it('⑥ 반대 방향 — 표를 읽는 페이지가 실제로 있다 (④가 "리터럴 0건" 으로 헛돌지 않게)', () => {
    // 🔑 ④는 "리터럴이 없다" 를 단언한다. 페이지가 `<SEO>` 를 아예 안 쓰게 되면 그것도 0건이라
    //   통과한다 — 그러면 제목이 사라진 것인데 초록이다. 표를 읽는 호출이 있는지 함께 본다.
    let reads = 0
    for (const f of walkTsx(join(ROOT, 'src/pages'))) {
      const src = readFileSync(f, 'utf-8')
      reads += (src.match(/<SEO[\s\S]{0,400}?CONSUMER_SURFACE_SEO\['\/[^']*'\]\.title/g) || []).length
    }
    // 🔑 하한을 **실측값(23)** 으로 조인다 — 느슨하면 호출이 하나 사라져도 통과한다.
    //   페이지가 늘어 24가 되는 것은 통과(하한), 하나라도 줄면 빨간불. 표면을 일부러 없앨 때는
    //   이 숫자를 **함께** 내리는 것이 그 결정을 의식하게 만든다.
    // 📣 2026-10-31: 23 → 22 — 같은 말을 하던 두 번째 모집 랜딩(`InfluencerLandingPage`)을 지웠다
    //   (대표 "인플루언서용은 하나로 통일"). `/influencer` 는 이제 `CreatorsPage` 가 띄운다.
    expect(reads).toBeGreaterThanOrEqual(22)
  })

  it('⑦ `/gdpr`·`/partnership`·`/` 가 실측 회귀 자리다', () => {
    expect(TABLE['/gdpr'].title).toBe('Privacy Policy (GDPR)')
    expect(withSiteName(TABLE['/gdpr'].title)).toBe('Privacy Policy (GDPR) - 유어딜')
    expect(TABLE['/partnership'].title).toBe('광고/제휴 문의')
    expect(withSiteName(TABLE['/partnership'].title)).toBe('광고/제휴 문의 - 유어딜')
    // 홈은 표의 값이 정본이고 화면이 그걸 읽는다(em-dash 판은 폐기).
    expect(TABLE['/'].title).toBe('유어딜 - 우리 동네 맛집·카페·뷰티 이용권 할인')
    for (const f of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const src = readFileSync(f, 'utf-8')
      expect(src).toContain("CONSUMER_SURFACE_SEO['/'].title")
      expect(src).not.toContain('동네 이용권·공동구매·교환권을 할인가로')
    }
  })
})
