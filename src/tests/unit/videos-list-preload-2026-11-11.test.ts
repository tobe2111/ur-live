/**
 * 🎬 뷰어(`/videos`)의 영상 목록을 HTML 과 함께 출발시킨다 + `/my-store` 서버 301 (2026-11-11).
 *   라이브 실측(폰 4G·CPU 4배): `/videos` 는 목록(`/api/urshorts?all=1`)이 와야 첫 영상을 아는데, 그 요청이 앱 부팅 뒤 3.3s 에야 출발했다.
 *
 * 지키는 것:
 *   ① 워커가 `/videos` 응답 헤더에 목록 주소를 `rel=preload; as=fetch; crossorigin` 으로 싣는다
 *   ② 그 주소가 앱이 `fetch()` 하는 주소와 **같은 상수**다(한 글자라도 다르면 미리 받은 것을 버린다)
 *   ③ `crossorigin` 이 있다(없으면 `fetch()` 의 요청 모드와 안 맞아 재사용되지 않고 두 번 받는다)
 *   ④ `/my-store` 는 서버가 마이로 넘긴다(앱 라우트는 앱 안 이동용으로 남는다)
 * ⚠️ 못 보는 것: 브라우저가 실제로 재사용했는지(배포 뒤 그 주소의 요청이 **한 번**인지 · 출발 시각).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SHORTS_ALL_PATH, SHORTS_ALL_PRELOAD_LINK } from '@/shared/urshorts-list-cache'
import { resolveConsumerAlias } from '@/shared/seo/consumer-redirects'

const read = (f: string) => readFileSync(f, 'utf8')

describe('뷰어 목록 미리 받기', () => {
  it('① 워커 배선 — /videos 에만', () => {
    const w = read('src/worker/index.ts') // raw — worker/index.ts 엔 주석 제거기를 쓰지 않는다
    // 2026-11-11 재조준 — 같은 조건 안에 표지 preload 가 같이 들어와 중괄호가 생겼다(불변식 동일: /videos 에만 목록 Link)
    expect(w).toContain("if (url.pathname === '/videos' || url.pathname === '/videos/') { c.res.headers.append('Link', SHORTS_ALL_PRELOAD_LINK);")
    expect(w).toContain("import { SHORTS_ALL_PRELOAD_LINK } from '../shared/urshorts-list-cache';")
  })
  it('② 같은 상수 — 앱이 받는 주소', () => {
    const src = read('src/shared/urshorts-list-cache.ts')
    expect(src).toContain('inflight = fetch(SHORTS_ALL_PATH)')
    expect(src).not.toContain("fetch('/api/urshorts?all=1')")
    expect(SHORTS_ALL_PATH).toBe('/api/urshorts?all=1')
    expect(SHORTS_ALL_PRELOAD_LINK.startsWith(`<${SHORTS_ALL_PATH}>;`)).toBe(true)
  })
  it('③ as=fetch + crossorigin', () => {
    expect(SHORTS_ALL_PRELOAD_LINK).toBe('</api/urshorts?all=1>; rel=preload; as=fetch; crossorigin')
  })
})

describe('/my-store 서버 301', () => {
  it('④ 마이로 넘긴다 · 앱 라우트는 남는다', () => {
    expect(resolveConsumerAlias('/my-store')).toBe('/user/profile'); expect(resolveConsumerAlias('/my-store/')).toBe('/user/profile')
    expect(resolveConsumerAlias('/my-stores')).toBeNull(); expect(resolveConsumerAlias('/my-store/x')).toBeNull()
    expect(read('src/App.tsx')).toContain('<Route path="/my-store" element={<Navigate to="/user/profile" replace />} />')
  })
})
