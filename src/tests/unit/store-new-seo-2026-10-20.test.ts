import { describe, it, expect } from 'vitest'
import { resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import { surfaceCopyFor } from '@/shared/seo/surface-copy'

describe('/store/new SEO', () => {
  it('서버 메타가 있다', () => {
    const s = resolveConsumerSurfaceSeo('/store/new', '', 'https://urdeal.kr')
    expect(s).not.toBeNull()
    expect(s!.title).toContain('입점')
    expect(s!.canonical.endsWith('/store/new')).toBe(true)
  })
  it('크롤러 본문 문구가 있다', () => {
    const c = surfaceCopyFor('/store/new')
    expect(c).not.toBeNull()
    expect(c!.lines.length).toBeGreaterThan(0)
  })
})
