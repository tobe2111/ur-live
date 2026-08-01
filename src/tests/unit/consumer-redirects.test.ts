/**
 * 🔀 2026-07-29 별칭 경로 301 — 불변식.
 *
 * 핵심은 **`App.tsx` 와 이 표가 갈라지지 않는 것**이다. 라우트를 지우거나 대상이 바뀌었는데
 * 표가 남으면, 서버가 존재하지 않는 곳으로 301 을 쏘게 된다(죽은 리다이렉트 = 사이트맵 죽은 URL 과
 * 같은 클래스). 그래서 이 테스트는 상수만 보지 않고 **App.tsx 를 실제로 읽어 대조**한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveConsumerAlias, CONSUMER_ALIASES } from '@/shared/seo/consumer-redirects'

const APP = readFileSync('src/App.tsx', 'utf8')

describe('resolveConsumerAlias — 별칭만, 정본은 건드리지 않는다', () => {
  it('별칭을 정본으로 옮긴다', () => {
    expect(resolveConsumerAlias('/group-buy')).toBe('/')
    expect(resolveConsumerAlias('/restaurant-map')).toBe('/map')
    expect(resolveConsumerAlias('/terms-of-service')).toBe('/terms')
    expect(resolveConsumerAlias('/privacy-policy')).toBe('/privacy')
    expect(resolveConsumerAlias('/refund-policy')).toBe('/refund')
    expect(resolveConsumerAlias('/shipping-policy')).toBe('/refund')
  })

  it('`/product/:id`(단수) → `/products/:id`(복수)', () => {
    expect(resolveConsumerAlias('/product/2687')).toBe('/products/2687')
    expect(resolveConsumerAlias('/product/abc-def')).toBe('/products/abc-def')
  })

  it('후행 슬래시 변형도 같은 별칭 (안 그러면 그 변형만 중복 URL 로 남는다)', () => {
    expect(resolveConsumerAlias('/terms-of-service/')).toBe('/terms')
    expect(resolveConsumerAlias('/product/2687/')).toBe('/products/2687')
  })

  it('정본 경로는 절대 리다이렉트하지 않는다 (무한 루프 방지)', () => {
    for (const target of [...new Set(Object.values(CONSUMER_ALIASES)), '/products/2687']) {
      expect(resolveConsumerAlias(target), target).toBeNull()
    }
  })

  it('무관한 경로는 통과', () => {
    for (const p of ['/vouchers', '/browse', '/blog/what-is-urdeal', '/u/jiwon1228', '/api/products', '/products']) {
      expect(resolveConsumerAlias(p), p).toBeNull()
    }
  })

  it('id 가 없는 `/product` 는 리다이렉트하지 않는다', () => {
    expect(resolveConsumerAlias('/product')).toBeNull()
    expect(resolveConsumerAlias('/product/')).toBeNull()
  })
})

describe('App.tsx 와의 동기화 — 표가 낡으면 죽은 301 이 된다', () => {
  it('별칭 경로는 App.tsx 에 라우트로 존재한다 (SPA 내부 이동용 <Navigate> 를 지우면 안 된다)', () => {
    for (const alias of Object.keys(CONSUMER_ALIASES)) {
      expect(APP.includes(`path="${alias}"`), `${alias} 라우트가 App.tsx 에 없다`).toBe(true)
    }
  })

  it('301 목적지도 App.tsx 에 실재한다 (없는 곳으로 보내면 죽은 리다이렉트)', () => {
    for (const target of new Set(Object.values(CONSUMER_ALIASES))) {
      // 루트('/')는 `path="/"` 로, 나머지는 그대로 매칭.
      expect(APP.includes(`path="${target}"`), `${target} 라우트가 App.tsx 에 없다`).toBe(true)
    }
  })

  it('별칭들은 App.tsx 에서 실제로 <Navigate>/리다이렉트다 (콘텐츠 페이지를 301 로 가리면 안 된다)', () => {
    for (const alias of Object.keys(CONSUMER_ALIASES)) {
      const m = new RegExp(`path="${alias.replace(/[/]/g, '\\/')}"\\s+element=\\{([^}]*)`).exec(APP)
      expect(m, `${alias} 라우트 element 를 못 찾음`).not.toBeNull()
      expect(m![1], `${alias} 가 <Navigate> 가 아니다 — 실제 콘텐츠 페이지를 301 로 가릴 위험`).toContain('Navigate')
    }
  })

  it('`/product/:id` 는 App.tsx 에서 리다이렉트 컴포넌트다', () => {
    expect(/path="\/product\/:id"\s+element=\{<ProductRedirect/.test(APP)).toBe(true)
  })
})
