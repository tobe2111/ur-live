/**
 * 📸 2026-11-09 — 대외 안내 페이지(/about · /partners · /influencer) 맨 위 사진(LCP, 222KB)을 HTML 과 함께 출발시킨다.
 * 실측(폰 흉내): 앱 코드가 다 돈 뒤 1.7s 에 출발 → LCP 3.1s. 화면과 워커가 같은 주소 상수를 쓴다(갈리면 두 번 받는다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { landingHeroFor, LANDING_HERO_SRC } from '@/shared/landing-photo'

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../..', p), 'utf8')

describe('landingHeroFor', () => {
  it('세 페이지만', () => {
    for (const p of ['/about', '/partners', '/influencer', '/about/']) expect(landingHeroFor(p)).toBe(LANDING_HERO_SRC)
    for (const p of ['/', '/about/print', '/new-openings', '/pass/1']) expect(landingHeroFor(p)).toBe('')
  })
  it('화면 사진 주소가 같은 상수다', () => {
    const s = read('src/pages/landing/premium.tsx')
    expect((s.match(/src: LANDING_HERO_SRC,/g) || []).length).toBe(3)
    expect(s).not.toContain("src: '/static/partners/deal-photo.jpg'")
  })
  it('워커가 응답 헤더에 싣는다', () => {
    expect(read('src/worker/index.ts')).toContain('appendLcpLink(c.res.headers, landingHeroFor(url.pathname));')
  })
})
