/**
 * 🖼️ 히어로 사진은 **입구가 어디였든** 나온다 (2026-09-03 대표 신고 "심각해")
 *
 * ## 사고
 * 대표: *"메인페이지에 히어로의 이미지는 항상 새로고침을 해야 이미지나 영상이 보이네..?"*
 *
 * 사진의 출처가 하나뿐이었다 — 워커가 **`/` 하드로드에서만** 문서에 넣는
 * `<script id="__SSR_INITIAL_MAIN__">`. 앱 안에서 홈 탭을 눌러 들어오면 그 시드가 없어
 * 히어로가 색면만 남았다. **에러도 빈 이미지도 없어서** 새로고침해 보기 전엔 모른다.
 * 라이브 실측: 하드로드 HTML 에 시드 1 + preload 2줄 정상 / `/api/banners?type=hero` → `[]`
 * (어드민 배너 0건이라 시드가 유일한 소스였다).
 *
 * ## 이 검사가 고정하는 것
 *   ① 시드가 있으면 그걸 쓴다(하드로드 빠른 길 — 왕복 0)
 *   ② 시드가 **없으면** 홈 피드 캐시에서 고른다(= 새로고침 없이 나온다)
 *   ③ 그때 **새 요청을 만들지 않는다**(구독만) — 히어로가 트래픽을 늘리면 안 된다
 *   ④ 고르는 규칙은 SSOT 하나 — 워커 preload 와 답이 갈리면 사진을 두 번 받는다
 *
 * ⚠️ 못 막는 것: 실제 브라우저에서 사진이 그려지는지(여긴 소스·로직 검사다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pickHeroPhotoFrom } from '@/shared/home-hero-photo'

const HOOK = readFileSync('src/components/home/useHeroPhoto.ts', 'utf8')
const HERO = readFileSync('src/components/home/HomeHeroDefault.tsx', 'utf8')

describe('고르는 규칙(SSOT)', () => {
  it('④ 실상품이 데모보다 먼저다', () => {
    const pick = pickHeroPhotoFrom([
      { id: 1, slug: 'demo-deal-x', image_url: '/api/media/a.jpg' },
      { id: 2, slug: 'real-deal', image_url: 'https://cdn.example/b.jpg' },
    ])
    expect(pick).toEqual({ src: 'https://cdn.example/b.jpg', href: '/group-buy/2' })
  })

  it('④ 남의 호스트 데모 사진은 어느 단계에서도 안 쓴다 (2026-08-04 워터마크 보도사진 사고)', () => {
    expect(pickHeroPhotoFrom([{ id: 1, slug: 'demo-deal-x', image_url: 'https://news.example/x.jpg' }])).toBeNull()
    expect(pickHeroPhotoFrom([{ id: 1, slug: 'demo-deal-x', image_url: '/api/media/ours.jpg' }]))
      .toEqual({ src: '/api/media/ours.jpg', href: '/group-buy/1' })
  })

  it('깨진 시드에도 안 터진다', () => {
    for (const bad of [null, undefined, {}, 'x', [{}], [{ image_url: 123 }]]) {
      expect(() => pickHeroPhotoFrom(bad)).not.toThrow()
    }
  })
})

describe('사진 소스 배선', () => {
  it('① 하드로드 시드를 먼저 본다', () => {
    expect(HOOK).toContain("getElementById('__SSR_INITIAL_MAIN__')")
    expect(HOOK).toMatch(/seed \?\?/)
  })

  it('② 시드가 없으면 홈 피드 캐시에서 고른다 (이게 빠지면 새로고침해야만 보인다)', () => {
    expect(HOOK).toMatch(/getQueriesData/)
    expect(HOOK).toMatch(/'group-buy', 'list'/)
    expect(HOOK).toMatch(/pickHeroPhotoFrom\(/)
  })

  it('③ 캐시를 **구독만** 한다 — 히어로가 새 요청을 만들지 않는다', () => {
    expect(HOOK).toMatch(/useSyncExternalStore/)
    expect(HOOK).toMatch(/getQueryCache\(\)\.subscribe/)
    expect(HOOK, '히어로가 자기 fetch 를 하면 홈 첫 화면 요청이 하나 늘어난다').not.toMatch(/api\.get|fetch\(|queryFn/)
  })

  it('히어로는 그 훅을 쓴다 (시드 직접 읽기로 되돌아가지 않는다)', () => {
    expect(HERO).toMatch(/useHeroPhoto\(/)
    expect(HERO, '컴포넌트가 시드를 직접 읽으면 ②가 다시 사라진다').not.toContain("getElementById('__SSR_INITIAL_MAIN__')")
  })

  it('순환 import 가 없다 (번들 순서에 따라 TDZ 로 터지는 종류)', () => {
    expect(HOOK, '훅이 컴포넌트를 import 하면 순환이다').not.toMatch(/from '\.\/HomeHeroDefault'/)
  })
})
