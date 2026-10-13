/**
 * 🧨 **철거된 서비스의 URL 은 410 Gone 이다** 〔2026-10-12 대표 *"SEO 측면에서 어떻게 해야하는지 알려줘"* → *"모두 해줘"*〕
 *
 * 2026-10-11 도매몰 철거(#1710)는 화면·라우트·마운트를 전부 지웠는데 **크롤러가 보는 쪽은 그대로**
 * 남아 있었다. Googlebot UA 로 라이브를 받아 보니 네 URL 이 전부 이 모양이었다:
 *
 *     /wholesale · /wholesale/intro · /wholesale/join · /wholesale/oem
 *       HTTP 200 · robots `index, follow` · canonical **2개** · 본문 **0자**
 *       <title>유통스타트 도매몰 — 제조사 직거래 B2B 도매사이트</title>
 *
 * 그리고 `public/robots.txt` 가 그 넷을 **"공개 인덱스 대상"** 으로 명시 허용했다. 즉 구글이 정의한
 * 교과서적 **soft 404** 를 우리가 직접 초대해서 만들고 있었다. 에러가 안 나고 화면도 안 깨져서
 * (라우트가 없으니 사람은 그냥 "없는 페이지" 를 본다) **재 본 사람만 안다.**
 *
 * 🔑 이 시험이 지키는 불변식 — **다섯 조각이 쌍이다.** 하나만 빠져도 조용히 soft-404 로 돌아간다:
 *   ① `isRetiredSurface` 가 그 경로를 판정한다 (SSOT — 판정이 두 벌이 되면 갈린다)
 *   ② 워커가 그 판정으로 **410** + `noindex` 를 낸다 (200 이면 "있다" 고 말하는 것)
 *   ③ 도매 브랜드 메타·`utongstart.com` canonical 주입이 **없다** (없는 서비스를 광고하지 않는다)
 *   ④ `robots.txt` 가 그 넷을 **초대하지도, 차단하지도 않는다** (차단하면 410 을 못 읽어 색인 영구 잔존)
 *   ⑤ sitemap·cron 이 그 경로를 **선언하지 않는다** (색인 요청과 410 이 서로 반대 신호)
 *
 * 🔴 **왜 404 가 아니라 410 인가**: 엔티티가 없어진 것(`shouldNoindexMissingEntity` — 상품 하나가
 *    내려간 것)과 **서비스가 없어진 것**은 다르다. 상품은 다시 올라올 수 있어 404("지금 없다")가
 *    맞지만 도매몰은 돌아오지 않는다. 그래서 둘을 **같은 조건으로 묶지 않는다**(시험이 고정).
 *
 * 🔴 **왜 301 → `/` 가 아닌가**: 301 은 *"이 내용이 저기로 옮겨갔다"* 일 때만 맞다. 대체 관계가 아니면
 *    구글이 soft-404 로 재분류해서 색인에서 빼는 건 똑같고 사이트 신뢰도만 추가로 깎인다.
 *
 * ⚠️ 이 시험이 **못 보는 것**:
 *   - 구글·네이버가 실제로 색인에서 빼는지(수일~수주 · 판정은 서치콘솔에서 **대표만** 볼 수 있다).
 *   - HTMLRewriter 의 런타임 동작(워커 전용 API 라 유닛 밖) — 배선 문자열만 본다.
 *   - `utongstart.com` 도메인 자체(레지스트라·DNS 쪽 일. Cloudflare 실측으로 어느 Pages 프로젝트에도
 *     연결돼 있지 않다 → 지금은 아무것도 서빙하지 않는다).
 *   - **`/supplier` 의 410 은 크롤러에게 도달하지 않는다** — `robots.txt` 가 그 경로를 막고 있고,
 *     그건 의도다(애초에 색인 의도 0). 상태코드만 정직해진 것이다.
 *
 * 주입 매니페스트: scripts/mutations/retired-surface-410.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { isRetiredSurface, shouldNoindexMissingEntity } from '../../worker/utils/surface-ssr-meta'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const raw = (p: string) => readFileSync(p, 'utf8')

const WORKER = 'src/worker/index.ts'
const META = 'src/worker/utils/surface-ssr-meta.ts'
const ROBOTS = 'public/robots.txt'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const PREWARM = 'src/worker/cron/cache-prewarm.ts'
const SSRPAY = 'src/worker/utils/ssr-payload.ts'

/** 라이브 실측(2026-10-12)에서 `200 + index,follow + 본문 0자` 였던 네 URL. */
const RETIRED = ['/wholesale', '/wholesale/intro', '/wholesale/join', '/wholesale/oem']

describe('① isRetiredSurface — 판정 (SSOT)', () => {
  for (const p of RETIRED) {
    it(`${p} 는 철거된 표면이다`, () => expect(isRetiredSurface(p)).toBe(true))
  }

  it('/supplier 와 그 하위도 철거된 표면이다', () => {
    expect(isRetiredSurface('/supplier')).toBe(true)
    expect(isRetiredSurface('/supplier/dashboard')).toBe(true)
  })

  it('거래성 하위 경로도 포함한다 (결제·대시보드·정산)', () => {
    for (const p of ['/wholesale/cart', '/wholesale/checkout', '/wholesale/dashboard', '/wholesale/statement']) {
      expect(isRetiredSurface(p)).toBe(true)
    }
  })

  // 🔴 살아 있는 표면을 삼키면 소비자 페이지가 통째로 410 이 된다 — 가장 큰 사고 방향.
  it('소비자·대시보드 표면은 건드리지 않는다', () => {
    for (const p of [
      '/', '/vouchers', '/browse', '/map', '/stays', '/blog', '/pass/2919',
      '/u/jiwon1228', '/seller', '/seller/orders', '/admin', '/ads', '/agency',
      '/products/123', '/group-buy/2888', '/about', '/terms',
    ]) {
      expect(isRetiredSurface(p), p).toBe(false)
    }
  })

  // ⚠️ 접두만 같고 다른 경로를 삼키지 않는다(`/wholesaler` 같은 미래 경로).
  it('접두가 겹치는 다른 경로를 삼키지 않는다', () => {
    expect(isRetiredSurface('/wholesaler')).toBe(false)
    expect(isRetiredSurface('/suppliers-guide')).toBe(false)
    expect(isRetiredSurface('/my-wholesale')).toBe(false)
  })

  // 🔴 `/api/*` 는 이 판정이 닿지 않아야 한다 — `features/supply/` 의 정산 엔진과 공구 서비스 몰
  //    인프라(`wholesale-malls*` — 이름만 wholesale)는 살아 있다. 경로가 비슷하다고 묶으면
  //    소비자 결제·환불·cron 이 끊긴다. (호출부도 text/html 청크포인트 안이라 구조적으로 안 닿는다.)
  it('API 경로를 삼키지 않는다 (소비자 정산 엔진이 산다)', () => {
    for (const p of ['/api/supplier/settlements', '/api/wholesale/malls', '/api/admin/wholesale-malls']) {
      expect(isRetiredSurface(p), p).toBe(false)
    }
  })
})

describe('② 410 과 404 는 서로 다른 판정이다', () => {
  // 서비스 철거(경로 기반·영구) ↔ 엔티티 소멸(런타임 self-fetch 404·일시). 둘을 한 조건으로 묶으면
  // 내려간 상품에 410 이 나가 다시 올릴 때 색인이 안 돌아온다.
  it('엔티티 판정은 경로를 안 본다', () => {
    expect(shouldNoindexMissingEntity('DETAIL', 'self-fetch-404')).toBe(true)
    expect(shouldNoindexMissingEntity('DETAIL', 'self-fetch-timeout')).toBe(false)
    // 철거 표면은 슬롯이 없으므로 엔티티 판정에 걸리지 않는다.
    expect(shouldNoindexMissingEntity('MAIN', 'self-fetch-404')).toBe(false)
  })

  it('워커가 410(철거) 과 404(엔티티) 를 구분해 낸다', () => {
    const s = read(WORKER)
    // 🔀 2026-10-12 재조준: 404 쪽 항이 `(entityGone || unknownPath)` 로 늘었다(등록 안 된 경로).
    //   지키는 불변식은 그대로 — **철거는 410, 그 밖의 부재는 404**. 404 쪽 내용은 모양 무관으로 둔다.
    expect(s).toMatch(/const goneStatus = retiredSurface \? 410 : \([^;]*\? 404 : 0\)/)
    // 🔴 그리고 둘을 한 조건으로 **묶지 않는다** — 묶으면 내려간 상품에 410 이 나가 재등록해도 색인이 안 돌아온다.
    expect(s).not.toMatch(/\(retiredSurface \|\|[^)]*\) \? 410/)
    expect(s).toMatch(/statusText: goneStatus === 410 \? 'Gone' : 'Not Found'/)
  })

  // 🩸 **주입이 이 가드의 눈먼 자리를 잡았다.** 첫 판은 `goneStatus` 의 **계산**만 단언했는데,
  //    그 값을 쓰는 쪽을 `c.res = false ? …` 로 중성화해도 **통과했다** — 계산은 멀쩡히 남아 있으니까.
  //    ⇒ 계산과 사용은 다른 자리다. 응답을 가르는 조건이 `goneStatus` 자신인지 함께 본다.
  it('그 상태코드로 실제로 응답한다 (계산만 하고 버리지 않는다)', () => {
    expect(read(WORKER)).toMatch(/c\.res = goneStatus\s*\?\s*new Response\(rewritten\.body, \{/)
  })

  // 🔀 2026-10-12 재조준: 같은 블록이 **등록 안 된 경로**의 noindex 도 맡게 되어 조건에 항이 하나
  //   늘었다(`unknownPath`). 지키는 불변식은 그대로 — **철거 표면이 그 블록에 들어 있다**.
  //   `retiredSurface` 를 빼는 쪽만 잡으면 되므로 앞의 항들은 모양 무관으로 둔다.
  it('철거 표면도 noindex 를 받는다 (410 을 못 읽는 크롤러 대비)', () => {
    expect(read(WORKER)).toMatch(/if \([^)]*\bretiredSurface\) \{\s*\n\s*rb = rb\.on\('meta\[name="robots"\]'/)
  })
})

describe('③ 없는 서비스를 광고하지 않는다', () => {
  const s = read(WORKER)

  it('도매 브랜드 메타 주입이 없다', () => {
    expect(s).not.toContain('유통스타트 도매몰')
    expect(s).not.toContain('favicon-utong.svg')
    expect(s).not.toMatch(/og:site_name[\s\S]{0,80}유통스타트/)
  })

  // 🔴 canonical 이 특히 나빴다 — `utongstart.com` 은 어느 Pages 프로젝트에도 연결돼 있지 않은데
  //    그 도메인을 "정본" 으로 선언하고, `index.html` 의 canonical 과 둘이 갈려 있었다.
  it('utongstart.com canonical 을 주입하지 않는다', () => {
    expect(s).not.toMatch(/canonical[^\n]*utongstart/)
    expect(s).not.toContain('https://utongstart.com${url.pathname}')
  })

  it('WHOLESALE SSR 슬롯이 없다 (self-fetch 404 + 3000ms 대기)', () => {
    expect(s).not.toMatch(/slot: 'WHOLESALE'/)
    expect(s).not.toContain("'/api/wholesale/catalog'")
  })

  it('WHOLESALE 전용 타임아웃이 없다', () => {
    expect(read(SSRPAY)).not.toMatch(/slot === 'WHOLESALE'/)
  })

  // 판정이 두 벌이 되면 갈린다 — 워커는 SSOT 를 import 해서 쓴다.
  it('워커가 판정을 직접 베끼지 않고 SSOT 를 쓴다', () => {
    expect(s).toMatch(/import \{[^}]*isRetiredSurface[^}]*\} from '\.\/utils\/surface-ssr-meta'/)
    expect(s).toMatch(/const retiredSurface = isRetiredSurface\(url\.pathname\)/)
    // 같은 정규식을 워커에 또 쓰면 둘이 갈린다.
    expect(s).not.toMatch(/\/\^\\\/\(wholesale\|supplier\)/)
  })
})

describe('④ robots.txt — 초대하지도, 차단하지도 않는다', () => {
  const r = raw(ROBOTS)
  /** `#` 주석을 뺀 실제 규칙 줄만. 주석에 적힌 설명이 규칙으로 오독되지 않게. */
  const rules = r.split('\n').filter((l) => !l.trimStart().startsWith('#'))
  const ruleText = rules.join('\n')

  // 🩸 이 단언의 첫 판은 **원문 전체**에서 `"공개 인덱스 대상: /wholesale"` 을 찾았고, 거짓 빨간불이
  //    났다 — 그 문구를 **지웠다고 기록하는 주석이 그것을 인용**하기 때문이다. 이 레포가 이미 겪은
  //    클래스(`d1-migrate` 가드가 워크플로 머리말의 옛 안티패턴 인용에 걸린 것)다.
  //    ⇒ 판정은 **실행되는 줄**로 한다. 실제 불변식은 "그 넷을 명시 초대하지 않는다" 이고,
  //      초대의 수단은 주석이 아니라 `Allow:` 다.
  it('네 URL 을 Allow 로 명시 초대하지 않는다', () => {
    for (const p of RETIRED) {
      expect(ruleText, p).not.toMatch(new RegExp(`^Allow: ${p.replace(/\//g, '\\/')}`, 'm'))
    }
  })

  // 🩸 **같은 함정을 두 번 밟았다.** 위 단언을 고친 직후, "호스트별 robots 를 권하는 기록이 없다" 를
  //    원문 검사로 쓰자 또 거짓 빨간불이 났다 — 그 권고를 **철회한다고 적은 주석이 권고 문구를 인용**
  //    하기 때문이다.
  //    ⇒ 교훈: **제거를 기록하는 주석과, 제거를 검사하는 단언은 같은 문자열을 공유할 수 없다.**
  //      문서 안의 권고 문구는 코드 동작이 아니므로 애초에 가드 대상이 아니다. 지켜야 하는 것은
  //      "워커가 호스트별로 robots 본문을 바꾸지 않는다" 이고, 그건 아래 it 이 코드에서 검사한다.

  // 🔴 이게 이 구역의 핵심 불변식이다. Disallow 를 넣으면 크롤러가 410 을 **읽을 수 없어**
  //    색인에 영구 잔존한다 — 폐기 URL 처리에서 가장 흔한 실수.
  for (const p of RETIRED) {
    it(`${p} 를 Disallow 하지 않는다 (410 이 읽혀야 한다)`, () => {
      expect(ruleText).not.toMatch(new RegExp(`^Disallow: ${p.replace(/\//g, '\\/')}\\$?\\s*$`, 'm'))
    })
  }

  // 반대 방향 — 색인 의도가 0 이던 거래성 경로는 차단을 **유지**한다(크롤 예산 보호).
  it('거래성 경로 차단은 유지된다', () => {
    for (const p of ['/wholesale/cart', '/wholesale/checkout', '/wholesale/dashboard', '/wholesale/login']) {
      expect(ruleText).toMatch(new RegExp(`^Disallow: ${p.replace(/\//g, '\\/')}\\s*$`, 'm'))
    }
  })

  it('비공개 라우트 차단과 Sitemap 선언이 그대로다', () => {
    expect(ruleText).toMatch(/^Disallow: \/admin/m)
    expect(ruleText).toMatch(/^Sitemap: https:\/\/urdeal\.kr\/sitemap\.xml$/m)
  })

  // 🚫 호스트별로 robots 본문을 바꾸면 "크롤러가 받는 파일" 이 두 벌이 된다 — 2026-07-29 에
  //    Cloudflare Managed robots.txt 가 우리 파일을 대체해 50줄이 서빙되지 않던 사고와 같은 클래스.
  it('워커가 호스트별로 Sitemap 을 바꿔치지 않는다', () => {
    const s = read(WORKER)
    expect(s).not.toContain('Sitemap: https://utongstart.com/sitemap.xml')
    expect(s).not.toMatch(/isWholesaleHost/)
  })
})

describe('⑤ 선언과 410 이 서로 반대를 말하지 않는다', () => {
  it('sitemap 이 도매 URL 을 발행하지 않는다', () => {
    const s = read(SITEMAP)
    expect(s).not.toContain('utongstart.com')
    expect(s).not.toMatch(/loc: '\/wholesale/)
    expect(s).not.toMatch(/WHOLESALE_BASE|WHOLESALE_HOSTS/)
  })

  it('cron 이 도매 경로를 예열하지 않는다 (서브리퀘스트 예산)', () => {
    const s = read(PREWARM)
    expect(s).not.toMatch(/WS_PREWARM/)
    expect(s).not.toMatch(/'\/api\/wholesale\//)
    expect(s).not.toMatch(/https:\/\/utongstart\.com/)
  })

  // 하한 — 검사 대상이 조용히 비면 "통과" 가 아니라 "고장" 이다(이 레포가 반복해 당한 헛도는 가드).
  it('검사 대상 파일이 실제로 읽혔다', () => {
    expect(read(WORKER).length).toBeGreaterThan(50_000)
    expect(raw(ROBOTS).split('\n').length).toBeGreaterThan(40)
    expect(read(META)).toContain('isRetiredSurface')
  })
})
