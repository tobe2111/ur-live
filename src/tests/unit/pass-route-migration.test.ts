import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveConsumerAlias } from '@/shared/seo/consumer-redirects'
import { RESERVED_SLUGS } from '@/shared/mall/slug'
import { getProductFlow, FLOW_CONFIG } from '@/shared/product-flow'

/**
 * 🎟️ **이용권 상세 주소 이전** `/group-buy/:id` → `/pass/:id` 〔2026-08-16, 대표 확정〕
 *
 * 주소 이전은 **반쪽이 되기 쉽고, 반쪽인 채로도 화면이 멀쩡해 보인다.** 앱 안에서 눌러 들어가는
 * 경로만 고치면 개발 중엔 다 되는 것처럼 보이지만, 밖에서 들어오는 트래픽(카톡 공유 카드·검색
 * 색인·QR·북마크)은 옛 주소로 오고 그쪽이 깨진 걸 우리는 못 본다.
 *
 * ## 이 파일이 막는 것
 *   - R1 `pass` 가 **몰 슬러그로 선점되지 않는다** — 선점되면 `urdeal.kr/pass` 가 남의 가게가 되고
 *        이용권 상세가 통째로 사라진다
 *   - R2 옛 주소가 **301 로 살아 있다** — 지우면 밖에서 오는 트래픽이 그냥 죽는다
 *   - R3 `/group-buy/confirm-payment`(다른 화면)이 **301 에 휩쓸리지 않는다** — 결제 흐름이 끊긴다
 *   - R4 상세 경로 SSOT(`product-flow`)가 새 주소를 준다
 *   - R5 인프라(SSR 시드·청크 프리로드·sitemap·prerender 힌트)가 새 주소를 안다
 *
 * ⚠️ **못 막는 것**: 실제 배포에서의 301(워커 런타임) · 카카오 스크랩 캐시에 이미 박힌 옛 카드.
 *   후자는 코드로 못 고친다 — 시간이 지나거나 카카오 캐시가 갱신돼야 한다.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('R1 — `pass` 는 예약어다', () => {
  it('🔴 몰 슬러그로 선점될 수 없다', () => {
    expect(RESERVED_SLUGS).toContain('pass')
  })
  it('옛 주소 `group-buy` 예약도 유지된다', () => {
    expect(RESERVED_SLUGS).toContain('group-buy')
  })
})

describe('R2/R3 — 옛 주소는 301 로 살아 있고, 결제 화면은 건드리지 않는다', () => {
  it('🔴 `/group-buy/123` → `/pass/123`', () => {
    expect(resolveConsumerAlias('/group-buy/123')).toBe('/pass/123')
    expect(resolveConsumerAlias('/group-buy/123/')).toBe('/pass/123')  // 후행 슬래시 변형도
  })

  it('🔴 `/group-buy/confirm-payment` 은 **리다이렉트되지 않는다**', () => {
    // 숫자 id 만 잡는 이유가 이것이다. 여기가 튕기면 결제 확인 흐름이 끊긴다.
    expect(resolveConsumerAlias('/group-buy/confirm-payment')).toBeNull()
    expect(resolveConsumerAlias('/group-buy/confirm-payment?orderId=1')).toBeNull()
  })

  it('`/group-buy`(목록 별칭)는 종전대로 홈으로 간다', () => {
    expect(resolveConsumerAlias('/group-buy')).toBe('/')
  })

  it('🔴 앱 안에서도 갈 곳이 있다 — App.tsx 가 옛 경로를 정본으로 넘긴다', () => {
    // 서버 301 은 하드로드에만 걸린다. SPA 내부 이동은 서버를 안 타므로 라우트가 남아야 한다.
    const app = read('src/App.tsx')
    expect(/<Route path="\/pass\/:id"/.test(app), '정본 라우트 없음').toBe(true)
    expect(/<Route path="\/group-buy\/:id" element=\{<PathRedirect base="\/pass"/.test(app), '옛 경로 폴백 없음').toBe(true)
    expect(/to=\{`\$\{base\}\/\$\{id\}`\}/.test(app), '리다이렉트 헬퍼가 base 를 안 쓴다').toBe(true)
  })
})

describe('R4 — 상세 경로 SSOT 가 새 주소를 준다', () => {
  it('🔴 이용권(공구) 상품의 detailPath 가 `/pass/:id`', () => {
    // 화면마다 경로를 손으로 쓰면 이전이 영원히 안 끝난다 — SSOT 하나만 보면 되게 한다.
    const flow = getProductFlow({ deal_only: 0, group_buy_status: 'active', category: 'meal_voucher' })
    expect(flow).toBe('group_buy_toss')
    expect(FLOW_CONFIG[flow].detailPath(123)).toBe('/pass/123')
  })

  it('🔴 결제 복귀 경로는 **옮기지 않았다** — 라우트가 그대로라 옮기면 결제가 죽는다', () => {
    // 🐛 이걸 실제로 한 번 깨뜨렸다: 일괄 치환 패턴에 `confirm-payment` 예외를 빼먹어
    //   `successPath` 가 존재하지 않는 `/pass/confirm-payment` 가 됐다(Toss 복귀 URL = 머니 경로).
    //   대표 확정 범위는 상세뿐이므로 이 경로는 옛 자리에 남는다.
    expect(FLOW_CONFIG.group_buy_toss.successPath).toBe('/group-buy/confirm-payment')
    expect(/<Route path="\/group-buy\/confirm-payment"/.test(read('src/App.tsx'))).toBe(true)
  })
})

describe('R5 — 인프라가 새 주소를 안다', () => {
  it('🔴 SSR 시드 매처가 `/pass/:id` 를 잡는다', () => {
    // 안 잡으면 하드로드에서 0-RTT 시드가 사라져 상세가 스켈레톤부터 시작한다.
    expect(/\^\\\/\(\?:pass\|group-buy\|vouchers\)/.test(read('src/worker/index.ts'))).toBe(true)
  })

  it('🔴 청크 프리로드 표면이 `/pass/:id` 를 잡는다', () => {
    // 안 잡으면 페이지 청크가 엔트리 실행 후에야 직렬로 내려온다(로더 구간이 길어진다).
    expect(/\^\\\/\(\?:pass\|group-buy\)\\\/\\d\+/.test(read('src/worker/index.ts'))).toBe(true)
  })

  it('🔴 sitemap 이 **정본**을 제출한다 — 301 을 제출하면 색인 신호가 한 홉 낭비된다', () => {
    const sm = read('src/worker/routes/sitemap.routes.ts')
    expect(/loc: `\/pass\/\$\{g\.id\}`/.test(sm)).toBe(true)
    expect(/loc: `\/group-buy\/\$\{/.test(sm), 'sitemap 에 옛 주소가 남아 있다').toBe(false)
  })

  it('prerender 힌트도 새 주소를 가리킨다', () => {
    const html = read('index.html')
    expect(html).toContain('"/pass/*"')
    expect(html).not.toContain('"/group-buy/*"')
  })
})
