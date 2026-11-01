import { describe, it, expect } from 'vitest'
import { resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import { surfaceCopyFor } from '@/shared/seo/surface-copy'

describe('/store/new SEO', () => {
  it('서버 메타가 있다(공유 카드 제목·설명)', () => {
    const s = resolveConsumerSurfaceSeo('/store/new', '', 'https://urdeal.kr')
    expect(s).not.toBeNull()
    expect(s!.title).toContain('입점')
    expect(s!.canonical.endsWith('/store/new')).toBe(true)
  })
  it('로그인 뒤 도구라 색인하지 않는다(robots Disallow 와 일치)', () => {
    const s = resolveConsumerSurfaceSeo('/store/new', '', 'https://urdeal.kr')
    expect(s!.noindex).toBe(true)
  })
  it('noindex 표면이라 크롤러 본문을 두지 않는다', () => {
    expect(surfaceCopyFor('/store/new')).toBeNull()
  })
})
