/**
 * 🔎 /map 의 화면 제목·설명이 서버 메타와 같은 글자인가 (2026-10-31).
 *
 * JS 렌더 뒤 '맛집 지도' 로 바뀌어 서버(Yeti) 와 렌더(Googlebot) 가 다른 제목을 받았다.
 * 표를 import 하면 홈 첫 화면 청크가 하나 는다(surface-chunk-runtime 실측) — 그래서 글자를 두고 여기서 대조한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'

describe('/map 화면 SEO = 서버 메타', () => {
  const src = readCode('src/pages/RestaurantMapPage.tsx')
  it('제목', () => expect(src).toContain(`: '${CONSUMER_SURFACE_SEO['/map'].title}'}`))
  it('설명', () => expect(src).toContain(`: '${CONSUMER_SURFACE_SEO['/map'].description}'}`))
  it("옛 '맛집 지도' 기본값이 돌아오지 않는다", () => expect(src).not.toMatch(/defaultValue: '맛집 지도'/))
})
