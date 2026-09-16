/**
 * 🧭 형제 랜딩 둘의 PC 판 — `/about` · `/creators` (2026-09-16 대표 *"지워줘. PC를 같은 수준으로 만들어주고."*)
 *
 * ## 무엇이 문제였나
 * 같은 날 `/partners` 를 PC 로 세우고 나서 형제 둘을 재 보니 **똑같은 병**을 앓고 있었다.
 *   ① `MobileAppLayout` 의 `HIDE_SIDEBAR_PREFIXES` 에 없어 430px 소비자 액자에 갇혔고,
 *      빈 거터를 `ConsumerFrameRails`(소비자 앱 바로가기 + 설치 QR)가 채웠다.
 *      ⇒ 서비스를 알아보러 온 제휴처와 **소개로 돈을 벌러 온 사람** 화면의 좌우가 앱 광고였다.
 *   ② 본문이 `max-w-xl`(576px) 고정이라 액자를 풀어도 "넓어진 모바일" 이 된다.
 *   ③ `/creators` 의 성과 화면 자리가 **"(화면 준비 중)" 플레이스홀더 두 칸**이었다.
 *
 * ## 왜 눈으로 안 잡히나
 * 셋 다 **에러가 아니다.** 액자에 갇힌 화면은 "모바일 최적화" 처럼 보이고, 플레이스홀더는
 * 디자인처럼 보인다. 실제로 `/partners` 가 바로 그래서 몇 달 동안 아무 신고 없이 그대로 있었다.
 *
 * ## 이 시험이 **못** 보는 것
 * 픽셀. 여백 리듬이 좋은지, 레이아웃 계열이 실제로 갈렸는지는 **렌더해서 눈으로** 봐야 한다
 * (`check-anti-slop-copy` 머리말이 같은 한계를 적어 둔 그 두 항목이다).
 * 여기서 막는 것은 **되돌아가는 길** 넷뿐이다: 액자 · 폭 · 정직하지 않은 그림 · 다크 미검사.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const LAYOUT = readFileSync('src/components/MobileAppLayout.tsx', 'utf-8')
const APP = readFileSync('src/App.tsx', 'utf-8')
const DARK_GUARD = readFileSync('scripts/check-dark-contrast.mjs', 'utf-8')

const PAGES = {
  '/about': 'src/pages/AboutServicePage.tsx',
  '/creators': 'src/pages/CreatorsPage.tsx',
} as const
/** 주석을 걷어낸 본문 — 주석에 적어 둔 단어에 걸려 초록이 뜨는 함정을 피한다. */
const visible = (p: string) => stripComments(readFileSync(p, 'utf-8'))

describe('① PC 에서 액자를 벗는다', () => {
  /**
   * ⚠️ 주석이 아니라 **목록 항목**으로 앵커한다. 위 머리말에서 경로를 여러 번 언급하므로
   *    단순 `toContain('/about')` 은 목록에서 지워도 통과한다.
   */
  const entries = [...stripComments(LAYOUT).matchAll(/'(\/[a-z-]+)'/g)].map((m) => m[1])

  it.each(Object.keys(PAGES))('`%s` 가 HIDE_SIDEBAR_PREFIXES 에 있다', (route) => {
    const at = stripComments(LAYOUT).indexOf('HIDE_SIDEBAR_PREFIXES')
    const block = stripComments(LAYOUT).slice(at, stripComments(LAYOUT).indexOf(']', at))
    expect(block, `${route} 가 빠지면 430px 소비자 액자 + 앱 설치 거터로 되돌아간다`).toContain(`'${route}'`)
  })

  it('형제 셋이 함께 있다 (하나만 빠져도 그 페이지만 조용히 폰 폭이 된다)', () => {
    for (const r of ['/partners', '/about', '/creators']) expect(entries).toContain(r)
  })

  it('App.tsx 가 셋 다 fullScreen 으로 처리한다 (액자만 풀고 네비가 남으면 이중 크롬)', () => {
    // ⚠️ 바로 윗줄 주석도 이 이름을 말한다 — **선언 줄**(`= [`)로 좁히지 않으면 주석을 집는다.
    const line = APP.split('\n').find((l) => /fullScreenPrefixes\s*=\s*\[/.test(l)) ?? ''
    for (const r of ['/partners', '/about', '/creators']) expect(line, r).toContain(`'${r}'`)
  })
})

describe('② "넓어진 모바일" 로 되돌아가지 않는다', () => {
  it.each(Object.entries(PAGES))('%s 의 본문이 `ur-content-wide` 로 열린다', (_route, file) => {
    const s = visible(file)
    expect(s, '폭 컨테이너가 없으면 PC 에서 폰 레이아웃이 그대로 늘어난다').toContain('ur-content-wide')
    expect(s.match(/ur-content-wide/g)!.length, '섹션마다 폭 컨테이너를 쓴다').toBeGreaterThanOrEqual(4)
  })

  it.each(Object.entries(PAGES))('%s 가 본문을 `max-w-xl` 로 다시 조이지 않는다', (_route, file) => {
    const s = visible(file)
    // 모바일 고정 CTA 안의 max-w-xl 은 정상(폰 전용 바)이라 <main> 구간만 본다.
    const main = s.slice(s.indexOf('<main'), s.indexOf('</main>'))
    expect(main, '본문을 576px 로 조이면 PC 판이 무의미해진다').not.toContain('max-w-xl')
  })

  /**
   * ⚠️ **크기를 숫자로 못 박지 않는다.** 첫 판은 `lg:text-[52px]` 를 그대로 요구했는데, 1440 실측에서
   *    `/about` 의 h1 이 그 크기로는 어느 자리에서 끊어도 마지막 낱말이 홀로 남아 한 단 내려야 했다.
   *    시험이 막을 것은 "PC 단계가 있는가" 이지 특정 px 이 아니다(특정 px 을 잠그면 문장이 바뀔 때마다
   *    시험이 디자인을 가로막는다).
   */
  it.each(Object.entries(PAGES))('%s 의 h1 에 PC 타이포 단계가 있다', (_route, file) => {
    const h1 = visible(file).match(/<h1 className="([^"]+)"/)?.[1] ?? ''
    expect(h1, 'h1 을 못 찾았다').toBeTruthy()
    const px = (prefix: string) => Number(h1.match(new RegExp(`${prefix}:text-\\[(\\d+(?:\\.\\d+)?)px\\]`))?.[1] ?? 0)
    const [base, lg, xl] = [px('text') || Number(h1.match(/(?:^|\s)text-\[(\d+)px\]/)?.[1] ?? 0), px('lg'), px('xl')]
    expect(lg, '`lg:` 단계가 없으면 PC 에서 폰 크기 그대로다').toBeGreaterThanOrEqual(44)
    expect(xl, '`xl:` 가 `lg:` 보다 작으면 넓은 화면에서 되레 줄어든다').toBeGreaterThanOrEqual(lg)
    expect(lg, 'PC 제목이 모바일보다 확실히 커야 한다').toBeGreaterThan(base)
  })

  it.each(Object.entries(PAGES))('%s 의 모바일 고정 CTA 는 PC 에서 숨는다', (_route, file) => {
    const s = visible(file)
    // ⚠️ `lg:hidden` 은 `fixed bottom-0` **앞**에 온다 — 거기서부터 자르면 영영 못 본다(첫 판이 그랬다).
    //    그 div 의 className 문자열 전체를 집어서 판정한다.
    const bar = s.match(/className="([^"]*fixed bottom-0[^"]*)"/)?.[1] ?? ''
    expect(bar, 'lg:hidden 이 빠지면 PC 본문 위에 폰 바가 떠 있는다').toContain('lg:hidden')
    expect(s, '<main> 하단 여백도 PC 에서 걷는다').toContain('pb-24 lg:pb-0')
  })
})

describe('③ 화면 캡처는 실재하고, 없는 기능을 그림으로 약속하지 않는다', () => {
  it.each(Object.entries(PAGES))('%s 가 부르는 캡처 파일이 전부 있다', (_route, file) => {
    const keys = [...visible(file).matchAll(/SHOT\('([^']+)'\)/g)].map((m) => m[1])
    expect(keys.length, '랜딩에 사진이 한 장도 없으면 1차 판(글만 있는 PC)으로 되돌아간 것이다').toBeGreaterThan(0)
    for (const k of keys) {
      expect(existsSync(`public/static/partners/${k}.jpg`), `캡처 없음: ${k}.jpg`).toBe(true)
    }
  })

  /**
   * 🔴 이전 판은 *"실시간 적립 알림"* 과 *"내 성과 탭"* 을 칸으로 그려 놓고 그 안에 "(화면 준비 중)"
   *    이라고 적었다. 앞의 장치는 **아직 없다**(그 파일 주석이 "잔존 장치 2종 완성 후 교체" 라고
   *    적어 둔 것이 그것이다). 모집 랜딩 한복판의 공사중 팻말은 신청을 막는다.
   */
  it('/creators 가 "화면 준비 중" 플레이스홀더로 되돌아가지 않는다', () => {
    const s = visible(PAGES['/creators'])
    expect(s).not.toContain('화면 준비 중')
    expect(s, '아직 없는 장치를 그림으로 약속하지 않는다').not.toContain('실시간 적립 알림')
  })

  it('/creators 의 캡션이 라이브인지 예시 데이터인지 밝힌다', () => {
    const s = visible(PAGES['/creators'])
    expect(s).toContain('예시 데이터')
    expect(s).toContain('라이브 화면')
  })
})

describe('④ 다크 대비 가드가 두 랜딩을 실제로 돈다', () => {
  /** 문자열이 아니라 **경로 항목**으로 앵커한다(주석 언급만으로 통과하는 함정). */
  const routes = [...stripComments(DARK_GUARD).matchAll(/route:\s*'([^'?]+)[^']*'/g)].map((m) => m[1])

  it.each(Object.keys(PAGES))('`%s` 가 모바일·PC 둘 다 목록에 있다', (route) => {
    expect(routes.filter((r) => r === route).length,
      '목록이 곧 범위다 — 빠지면 다크에서 글자가 사라져도 초록불이 뜬다').toBeGreaterThanOrEqual(2)
  })

  it('PC 판정이 실제로 켜져 있다 (액자를 벗은 뒤 글자가 앉는 배경이 모바일과 다르다)', () => {
    for (const route of Object.keys(PAGES)) {
      const line = stripComments(DARK_GUARD).split('\n').find((l) => l.includes(`route: '${route}'`) && l.includes('pc: true'))
      expect(line, `${route} PC 항목이 없다`).toBeTruthy()
    }
  })
})

describe('⑤ 지운 랜딩이 되살아나지 않는다 (/business)', () => {
  it('페이지 파일이 없다', () => {
    expect(existsSync('src/pages/BusinessLandingPage.tsx'),
      '`/partners` 와 같은 사람에게 같은 말을 하는 두 번째 랜딩이었다').toBe(false)
  })

  it('`/business` 는 지우지 않고 `/partners` 로 보낸다 (밖에 뿌려진 링크를 죽이지 않는다)', () => {
    const redirects = readFileSync('src/shared/seo/consumer-redirects.ts', 'utf-8')
    expect(stripComments(redirects)).toMatch(/'\/business':\s*'\/partners'/)
    expect(APP).toContain('path="/business"')
  })

  it('sitemap 이 사라진 랜딩을 더는 제출하지 않는다', () => {
    const sm = stripComments(readFileSync('src/worker/routes/sitemap.routes.ts', 'utf-8'))
    expect(sm, '죽은 URL 제출은 크롤 예산 낭비 + 사이트맵 신뢰도 하락이다').not.toContain("'/business'")
  })
})
