/**
 * 🔗 유어샵 핀 공유 주소(`/u/{handle}/p/{id}`)를 서버가 바로 넘겨준다 (2026-11-11).
 *   라이브 실측: 이 주소는 앱 껍데기(200) → JS 부팅 → `/api/curator/…/redirect`(302) → 상품 상세 로 **문서를 두 번** 받았다.
 *
 * 지키는 것:
 *   ① 경로 판정 — 핀 공유 주소만(핸들 한 세그먼트 + /p/ + 숫자), 유어샵 본체·`/u/me`·다른 꼴은 null
 *   ② 워커 배선 — 문서 요청(GET/HEAD) 구간에서 같은 API 핸들러를 안에서 부른다(요청 헤더를 그대로 넘긴다 — 클릭 기록이 UA·쿠키를 본다)
 *   ③ 귀속·기록은 그 핸들러 그대로 — 핸들러의 목적지(`?aff=`·`?ref=`)와 클릭 기록 줄이 살아 있다
 *   ④ 앱 안 이동용 라우트는 남아 있다(서버를 안 타는 클릭 — 지우면 갈 곳이 없어진다)
 * ⚠️ 못 보는 것: 실제 응답(배포 뒤 `curl -I https://urdeal.kr/u/<handle>/p/<id>` 가 302 인지) · 걸린 시간.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pinRedirectApiPath } from '@/shared/seo/pin-link'

const read = (f: string) => readFileSync(f, 'utf8')

describe('핀 공유 주소 서버 리다이렉트', () => {
  it('① 경로 판정', () => {
    expect(pinRedirectApiPath('/u/jiwon1228/p/2919')).toBe('/api/curator/jiwon1228/p/2919/redirect')
    expect(pinRedirectApiPath('/u/a_b-C9/p/1/')).toBe('/api/curator/a_b-C9/p/1/redirect')
    for (const p of ['/u/jiwon1228', '/u/jiwon1228/', '/u/me/p/3', '/u/jiwon1228/p/', '/u/jiwon1228/p/abc', '/u/jiwon1228/p/3/x', '/u/a/b/p/3', '/x/u/a/p/3', '/u/jiwon1228/p/1234567890123', '/pass/3', '/']) {
      expect(pinRedirectApiPath(p), p).toBeNull()
    }
  })
  it('② 워커 배선 — GET/HEAD 문서 구간 · 같은 핸들러 · 요청 헤더 유지', () => {
    const w = read('src/worker/index.ts') // raw — worker/index.ts 엔 주석 제거기를 쓰지 않는다
    const line = "const pinApi = pinRedirectApiPath(url.pathname); if (pinApi) return app.fetch(new Request(`${url.origin}${pinApi}`, request), env as never, ctx as never);"
    expect(w).toContain(line)
    const guard = w.lastIndexOf("if (request.method === 'GET' || request.method === 'HEAD') {", w.indexOf(line))
    expect(guard).toBeGreaterThan(-1); expect(w.indexOf(line) - guard).toBeLessThan(3000) // 그 구간 안이다
    expect(w).toContain("import { pinRedirectApiPath } from '../shared/seo/pin-link';")
    expect(w).toContain("app.route('/api/curator', curatorRoutes);")
  })
  it('③ 귀속·기록은 핸들러 그대로', () => {
    const r = read('src/worker/routes/curator.routes.ts')
    expect(r).toContain("curatorRoutes.get('/:handle/p/:productId/redirect', async (c) => {")
    expect(r).toContain('c.executionCtx.waitUntil(logPinClick(DB, pin, c.req.raw))')
    expect(r).toContain('?aff=${pin.user_id}'); expect(r).toContain('?ref=${pin.user_id}')
  })
  it('④ 앱 안 이동용 라우트는 남아 있다', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('<Route path="/u/:handle/p/:productId" element={<CuratorPinClientRedirect />} />')
    expect(app).toContain('window.location.replace(`/api/curator/${encodeURIComponent(handle)}/p/${encodeURIComponent(productId)}/redirect`)')
  })
})
