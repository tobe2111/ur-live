/**
 * 🖼️ 이미지 허브 noimageindex — `shared/seo/image-hub.ts` 머리말이 이유를 적어 뒀다.
 *
 * 지키는 것:
 *  ① 허브(홈·지도·목록·지역·유어샵·가게 공개)는 허브로, 상세는 **절대** 허브가 아니다(상세가 사진의 출처다).
 *  ② `applySurfaceMeta` 가 허브 정본에만 `noimageindex` 메타를 붙이고, 그 페이지의 `index` 는 건드리지 않는다.
 * 못 보는 것: 구글이 출처를 실제로 바꾸는지(수주 · 서치콘솔은 대표만 본다) · `applySurfaceMeta` 를 안 타는 표면.
 */
import { describe, it, expect } from 'vitest'
import { isImageHubPath, isHubCanonical, NOIMAGEINDEX_META } from '@/shared/seo/image-hub'
import { applySurfaceMeta } from '@/worker/utils/surface-ssr-meta'

function fake() {
  const appended: string[] = []
  const attrs: Array<{ selector: string; name: string; value: string }> = []
  const rb = {
    on(selector: string, handlers: { element(el: unknown): void }) {
      handlers.element({
        setInnerContent: () => {},
        setAttribute: (name: string, value: string) => attrs.push({ selector, name, value }),
        append: (c: string) => appended.push(c),
        remove: () => {},
      })
      return rb
    },
  }
  return { rb, appended, attrs }
}

const meta = (canonical: string) => ({
  pageTitle: 't', title: 't', description: 'd', canonical,
})

describe('🖼️ 이미지 허브 판정', () => {
  it('① 허브', () => {
    for (const p of ['/', '/map', '/browse', '/vouchers', '/stays', '/region', '/region/서울', '/region/서울/종로구',
      '/u/jiwon1228', '/s/store_x', '/profile/abc', '/urshorts', '/videos', '/map/']) {
      expect(isImageHubPath(p), p).toBe(true)
    }
  })

  it('① 상세·정적은 허브가 아니다 — 상세에 붙이면 우리 사진이 이미지 검색에서 사라진다', () => {
    for (const p of ['/pass/2919', '/stays/2887', '/products/2917', '/vouchers/2192', '/group-buy/2875',
      '/u/jiwon1228/p/2887', '/blog/safe-payment-system', '/about', '/faq', '/region/서울/종로구/x']) {
      expect(isImageHubPath(p), p).toBe(false)
    }
  })

  it('① 정본 URL 로 판정 — 쿼리·한글 경로 무관, 깨진 값은 허브 아님', () => {
    expect(isHubCanonical('https://urdeal.kr/vouchers?category=%ED%8E%B8%EC%9D%98%EC%A0%90')).toBe(true)
    expect(isHubCanonical('https://urdeal.kr/region/%EC%84%9C%EC%9A%B8')).toBe(true)
    expect(isHubCanonical('https://urdeal.kr/pass/2919')).toBe(false)
    expect(isHubCanonical('')).toBe(false)
    expect(isHubCanonical('not a url')).toBe(false)
  })
})

describe('🖼️ applySurfaceMeta 배선', () => {
  it('② 허브 정본엔 noimageindex 하나를 붙인다', () => {
    const f = fake()
    applySurfaceMeta(f.rb, meta('https://urdeal.kr/'))
    expect(f.appended.filter(x => x === NOIMAGEINDEX_META)).toHaveLength(1)
  })

  it('② 상세 정본엔 붙이지 않는다', () => {
    for (const c of ['https://urdeal.kr/pass/2919', 'https://urdeal.kr/stays/2887', 'https://urdeal.kr/products/1']) {
      const f = fake()
      applySurfaceMeta(f.rb, meta(c))
      expect(f.appended.join(''), c).not.toContain('noimageindex')
    }
  })

  it('② 페이지 색인은 건드리지 않는다 — 기존 robots 메타를 noindex 로 바꾸지 않는다', () => {
    const f = fake()
    applySurfaceMeta(f.rb, meta('https://urdeal.kr/map'))
    expect(f.attrs.filter(a => a.selector === 'meta[name="robots"]')).toHaveLength(0)
    expect(NOIMAGEINDEX_META).not.toMatch(/noindex[,"]/)
  })
})
