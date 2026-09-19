import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { stripComments } from '../helpers/source-text'
import { resolveConsumerAlias } from '@/shared/seo/consumer-redirects'
import { RESERVED_SLUGS } from '@/shared/mall/slug'
import { isMallSlugCandidate } from '@/shared/mall/resolve'
import { getProductFlow, FLOW_CONFIG, canonicalDetailPath } from '@/shared/product-flow'

/**
 * 🎟️ **이용권 상세 주소 이전** `/group-buy/:id` → `/pass/:id` 〔2026-08-12 대표 확정 · 2026-09-16 시행〕
 *
 * 주소 이전은 **반쪽이 되기 쉽고, 반쪽인 채로도 화면이 멀쩡해 보인다.** 앱 안에서 눌러 들어가는
 * 경로만 고치면 개발 중엔 다 되는 것처럼 보이지만, 밖에서 들어오는 트래픽(카톡 공유 카드·검색
 * 색인·QR·북마크)은 옛 주소로 오고 **그쪽이 깨진 걸 우리는 못 본다.**
 *
 * ## 이 파일이 막는 것
 *   - R1 `pass` 가 **몰 슬러그로 선점되지 않는다** — 선점되면 `urdeal.kr/pass` 가 남의 가게가 되고
 *        이용권 상세가 통째로 사라진다. 목록 등재만이 아니라 **런타임 판정 함수를 직접 불러** 확인한다
 *   - R2 옛 주소가 **301 로 살아 있다** — 지우면 밖에서 오는 트래픽이 그냥 죽는다
 *   - R3 `/group-buy/confirm-payment`(다른 화면)이 **301 에 휩쓸리지 않는다** — 결제 흐름이 끊긴다
 *   - R4 상세 경로 SSOT(`product-flow`)가 새 주소를 준다
 *   - R5 인프라(SSR 시드·청크 프리로드·sitemap·prerender 힌트·PC 풀블리드)가 새 주소를 안다
 *   - R6 **서버가 그리는 첫 화면**이 정본에서도 그려진다 〔2026-09-16 신설 — 아래 🩸〕
 *
 * 🩸 **R6 는 원안(2026-08-16)에 없었다.** 그 사이 09-15·09-16 에 워커가 `/group-buy/:id` 의 `#root` 에
 *   [빵부스러기 + 히어로]를 직접 그리게 됐고(`detail-ssr-body.ts`), 그 분기가 **pathname 문자열로**
 *   `/group-buy/` 를 본다. 정본만 옮기고 이 줄을 빼먹으면 `/pass/:id` 하드로드에서 첫 화면이
 *   **조용히 사라진다** — 에러도 빈 화면도 없고 그냥 종전 로더로 돌아갈 뿐이라 아무도 신고하지 않는다.
 *   (이 레포가 반복해 당한 "실패가 아니라 조용한 부재" 클래스.)
 *
 * ⚠️ **못 막는 것**: 실제 배포에서의 301(워커 런타임은 유닛 밖) · 카카오 스크랩 캐시에 이미 박힌
 *   옛 공유 카드(코드로 못 고친다 — 카카오 캐시가 갱신돼야 한다) · 화면에서 눈으로 봐야 하는 것.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const src = (p: string) => stripComments(read(p))

describe('R1 — `pass` 는 예약어다', () => {
  it('🔴 몰 슬러그로 선점될 수 없다', () => {
    expect(RESERVED_SLUGS).toContain('pass')
  })

  // 🩸 목록에 이름이 있는 것과 **그 목록이 실제로 쓰이는 것**은 다르다. 워커의 몰 후보 판정은
  //   `isMallSlugCandidate` 를 거치는데, 그 함수가 다른 목록을 보도록 바뀌어도 위 단언은 초록이다
  //   (= 이 레포가 반복해 당한 "헛도는 가드"). 그래서 **함수를 실제로 불러** 판정을 확인한다.
  it('🔴 런타임 몰 해석기까지 닿는다 — 목록에 있는 것만으로는 부족하다', () => {
    expect(isMallSlugCandidate('pass')).toBe(false)
  })

  it('대조군 — 평범한 슬러그는 몰 후보다(판정이 늘 false 면 위 검사가 무의미하다)', () => {
    expect(isMallSlugCandidate('mystore')).toBe(true)
  })
  it('옛 주소 `group-buy` 예약도 유지된다 — 301 이 걸린 주소라 더더욱 남의 가게가 되면 안 된다', () => {
    expect(RESERVED_SLUGS).toContain('group-buy')
  })
})

describe('R2/R3 — 옛 주소는 301 로 살아 있고, 결제 화면은 건드리지 않는다', () => {
  it('🔴 `/group-buy/123` → `/pass/123`', () => {
    expect(resolveConsumerAlias('/group-buy/123')).toBe('/pass/123')
    expect(resolveConsumerAlias('/group-buy/123/')).toBe('/pass/123') // 후행 슬래시 변형도
  })

  it('🔴 `/group-buy/confirm-payment` 은 **리다이렉트되지 않는다**', () => {
    // 숫자 id 만 잡는 이유가 이것이다. 여기가 튕기면 결제 확인 흐름이 끊긴다 —
    // 돈이 빠져나간 **직후** 라서 사용자는 결제가 됐는지조차 알 수 없게 된다.
    expect(resolveConsumerAlias('/group-buy/confirm-payment')).toBeNull()
    expect(resolveConsumerAlias('/group-buy/confirm-payment/')).toBeNull()
  })

  it('`/group-buy`(목록 별칭)는 종전대로 홈으로 간다', () => {
    expect(resolveConsumerAlias('/group-buy')).toBe('/')
  })

  it('🔴 앱 안에서도 갈 곳이 있다 — App.tsx 가 옛 경로를 정본으로 넘긴다', () => {
    // 서버 301 은 **하드로드에만** 걸린다. SPA 내부 이동은 서버를 안 타므로 라우트가 남아야 한다.
    const app = src('src/App.tsx')
    expect(/<Route path="\/pass\/:id"/.test(app), '정본 라우트 없음').toBe(true)
    expect(/<Route path="\/group-buy\/:id" element=\{<PathRedirect base="\/pass"/.test(app), '옛 경로 폴백 없음').toBe(true)
    expect(/to=\{`\$\{base\}\/\$\{id\}`\}/.test(app), '리다이렉트 헬퍼가 base 를 안 쓴다').toBe(true)
  })

  it('🔴 옛 경로 라우트가 **결제 경로보다 뒤**에 온다 — 앞서면 결제 확인 화면이 상세로 튕긴다', () => {
    // react-router 는 랭킹 매칭이라 실제로는 구체적인 경로가 이기지만, 이 파일의 다른 라우트 표들이
    // 등록 순서에 의존해 온 이력이 있어(Hono 는 선언 순서다) 순서를 눈에 보이게 고정한다.
    const app = src('src/App.tsx')
    const pay = app.indexOf('path="/group-buy/confirm-payment"')
    const old = app.indexOf('path="/group-buy/:id"')
    expect(pay, '결제 확인 라우트가 사라졌다').toBeGreaterThan(0)
    expect(old, '옛 경로 폴백이 사라졌다').toBeGreaterThan(0)
    expect(pay).toBeLessThan(old)
  })
})

describe('R4 — 상세 경로 SSOT 가 새 주소를 준다', () => {
  it('🔴 이용권(공구) 상품의 detailPath 가 `/pass/:id`', () => {
    // 화면마다 경로를 손으로 쓰면 이전이 영원히 안 끝난다 — SSOT 하나만 보면 되게 한다.
    const flow = getProductFlow({ deal_only: 0, group_buy_status: 'active', category: 'meal_voucher' })
    expect(flow).toBe('group_buy_toss')
    expect(FLOW_CONFIG[flow].detailPath(123)).toBe('/pass/123')
  })

  it('🔴 카드가 쓰는 `canonicalDetailPath` 도 따라온다', () => {
    // 홈·유어샵 카드가 이걸로 목적지를 정한다. SSOT 를 안 타는 카드가 있으면 여기서 안 잡히므로
    // 아래 R5 의 "옛 주소 잔존 0" 검사가 짝으로 붙어 있다.
    expect(canonicalDetailPath({ id: 7, deal_only: 0, category: 'meal_voucher' })).toBe('/pass/7')
  })

  it('🔴 교환권(딜 결제)은 `/vouchers/:id` 그대로 — 이전 대상이 아니다', () => {
    expect(canonicalDetailPath({ id: 7, deal_only: 1, category: 'meal_voucher' })).toBe('/vouchers/7')
  })

  it('🔴 결제 복귀 경로는 **옮기지 않았다** — 라우트가 그대로라 옮기면 결제가 죽는다', () => {
    // 🐛 원안(2026-08-16)이 이걸 실제로 한 번 깨뜨렸다: 일괄 치환 패턴에 `confirm-payment` 예외를
    //   빼먹어 `successPath` 가 존재하지 않는 `/pass/confirm-payment` 가 됐다(Toss 복귀 URL = 머니 경로).
    //   문자열이라 타입도 빌드도 통과했다. 대표 확정 범위는 상세뿐이므로 이 경로는 옛 자리에 남는다.
    expect(FLOW_CONFIG.group_buy_toss.successPath).toBe('/group-buy/confirm-payment')
    expect(src('src/App.tsx')).toContain('path="/group-buy/confirm-payment"')
  })

  it('🔴 결제 화면·장바구니 복귀 URL 이 휩쓸리지 않았다', () => {
    // 이 셋은 전부 `/group-buy/confirm-payment` 를 손으로 적는 자리다(머니 경로).
    expect(src('src/pages/GroupBuyDetailPage.tsx')).toContain('/group-buy/confirm-payment?')
    expect(src('src/pages/cart/voucher-checkout.ts')).toContain("'/group-buy/confirm-payment?cart=1'")
    expect(src('src/pages/GroupBuyConfirmPaymentPage.tsx')).toContain('url="/group-buy/confirm-payment"')
  })
})

describe('R5 — 인프라가 새 주소를 안다', () => {
  const worker = () => src('src/worker/index.ts')

  it('🔴 SSR 시드 매처가 `/pass/:id` 를 잡는다', () => {
    // 안 잡으면 하드로드에서 0-RTT 시드가 사라져 상세가 스켈레톤부터 시작한다.
    expect(/\^\\\/\(\?:pass\|group-buy\|vouchers\)/.test(worker())).toBe(true)
  })

  it('🔴 청크 프리로드 표면이 `/pass/:id` 를 잡는다', () => {
    // 안 잡으면 페이지 청크가 엔트리 실행 후에야 직렬로 내려온다(로더 구간이 길어진다).
    expect(/\^\\\/\(\?:pass\|group-buy\)\\\/\\d\+/.test(worker())).toBe(true)
  })

  it('🔴 sitemap 이 **정본**을 제출한다 — 301 을 제출하면 색인 신호가 한 홉 낭비된다', () => {
    const sm = src('src/worker/routes/sitemap.routes.ts')
    expect(/loc: `\/pass\/\$\{g\.id\}`/.test(sm)).toBe(true)
    expect(/loc: `\/group-buy\/\$\{/.test(sm), 'sitemap 에 옛 주소가 남아 있다').toBe(false)
  })

  it('prerender 힌트도 새 주소를 가리킨다', () => {
    const html = src('index.html')
    expect(html).toContain('"/pass/*"')
    expect(html).not.toContain('"/group-buy/*"')
  })

  it('🔴 PC 풀블리드 접두사가 정본을 안다 — 빠지면 상세가 430 액자에 갇힌다', () => {
    const pf = src('src/shared/pc-fullbleed.ts')
    expect(/FULLBLEED_PC_PREFIXES = \[[^\]]*'\/pass\/'/.test(pf)).toBe(true)
  })

  it('🔴 큐레이터 핀 redirect 가 정본으로 보낸다', () => {
    expect(src('src/worker/routes/curator.routes.ts')).toContain('`/pass/${productId}?aff=')
  })
})

describe('R6 — 서버가 그리는 첫 화면이 정본에서도 그려진다', () => {
  it('🔴 `#root` 첫 화면 분기가 `/pass/` 를 본다', () => {
    // 🩸 이 줄은 pathname **문자열**로 가른다(`/vouchers/:id` 가 같은 DETAIL 슬롯이지만 다른 페이지라서).
    //   정본만 옮기고 여기를 빼먹으면 `/pass/:id` 하드로드가 조용히 종전 로더로 돌아간다.
    const w = worker6()
    expect(w).toContain("startsWith('/pass/')")
  })

  it('옛 주소로 들어와도 첫 화면은 그대로 — 301 이 안 걸린 요청(SPA 폴백)도 있다', () => {
    expect(worker6()).toContain("startsWith('/group-buy/')")
  })

  it('🔴 그 분기가 실제로 첫 화면 빌더를 부른다 — 조건만 있고 호출이 없으면 무의미하다', () => {
    const w = worker6()
    const cond = w.indexOf("startsWith('/pass/')")
    expect(cond, '조건이 없다').toBeGreaterThan(0)
    const call = w.indexOf('buildDetailFirstScreen(', cond)
    expect(call, '조건 뒤에 첫 화면 빌더 호출이 없다').toBeGreaterThan(cond)
    expect(call - cond).toBeLessThan(1200) // 같은 분기 안
  })
})

function worker6() {
  return src('src/worker/index.ts')
}

describe('R7 — 옛 주소가 링크로 남아 있지 않다', () => {
  it('🔴 소비자 표면에 `/group-buy/:id` 링크 잔존 0', () => {
    // 하나라도 남으면 그 카드만 301 을 한 번 더 타고, 그 경로의 첫 화면·프리로드 이득이 사라진다.
    // 결제 확인 화면(`confirm-payment`)과 API(`/api/...`)는 이전 대상이 아니므로 제외한다.
    const files = listSourceFiles()
    const offenders: string[] = []
    for (const f of files) {
      const body = stripComments(readFileSync(f, 'utf8'))
      for (const line of body.split('\n')) {
        if (!/['`"]\/group-buy\/|urdeal\.kr\/group-buy\/|ur-team\.com\/group-buy\//.test(line)) continue
        if (line.includes('/api/') || line.includes('confirm-payment')) continue
        if (/path="\/group-buy\/:id"/.test(line)) continue // 옛 경로 폴백 라우트(R2 가 요구한다)
        // API 라우트 등록 — 마운트 지점이 `/api/og` 라 경로 문자열만 같아 보인다(이전 대상 아님).
        if (line.includes("ogRoutes.get('/group-buy/:id'")) continue
        // 301 이 안 걸린 요청(SPA 폴백)도 첫 화면을 받게 남긴 방어선 — R6 이 이걸 요구한다.
        if (line.includes("startsWith('/group-buy/')")) continue
        offenders.push(`${f.replace(process.cwd() + '/', '')}: ${line.trim().slice(0, 110)}`)
      }
    }
    expect(offenders, `옛 주소 링크 잔존:\n${offenders.join('\n')}`).toEqual([])
  })

  it('검사 대상이 실제로 있다 — 0개면 통과가 아니라 고장이다', () => {
    expect(listSourceFiles().length).toBeGreaterThan(200)
  })
})

function listSourceFiles(): string[] {
  const out: string[] = []
  const skip = new Set(['tests', 'node_modules', 'generated'])
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (skip.has(e)) continue
      const p = resolve(dir, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(e) && !/\.d\.ts$/.test(e)) out.push(p)
    }
  }
  walk(resolve(process.cwd(), 'src'))
  return out
}
