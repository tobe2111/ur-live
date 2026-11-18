/**
 * 🗺️ 2026-11-17 누구에게나 같은 응답은 로그인 손님에게도 캐시한다 (결재 2026-11-17-traffic-surge-readiness 5번).
 *
 * `edgeCache` 는 로그인 쿠키·Authorization 이 있으면 캐시를 통째로 비켜 매번 DB 로 갔다. 홈 섹션·숏폼·배너·브랜드는
 * 사람마다 다르지 않으므로 `publicCache`(비켜 가지 않음)로 옮겼다.
 *
 * 🔴 이 전환의 전제 — **핸들러가 요청자 신원을 읽지 않는다.** 읽기 시작하는 순간 한 사람의 응답이 캐시에 남아
 *   다른 사람에게 나간다(개인정보 노출). 그래서 이 시험이 그 전제를 고정한다.
 *
 * 못 막는 것: 핸들러가 부르는 하위 함수가 신원을 읽는 것(파일 단위 문자열 검사) · 유어샵(`/api/curator/:handle`)은
 *   주인에게 다른 응답을 주므로 의도적으로 `edgeCache` 그대로다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const IDENTITY = /getCurrentUser|c\.get\('user'\)|req\.header\('(?:Authorization|Cookie)'\)|getCookie\(|parseSessionCookie|verifyJWT|optionalAuth/

function handlerBody(src: string, start: string): string {
  const at = src.indexOf(start)
  expect(at, `${start} 를 못 찾았다 — 시험이 헛돈다`).toBeGreaterThan(-1)
  // 핸들러 끝 = 그 뒤 첫 '줄 맨 앞의 })' (최상위 라우트 등록의 닫힘). 다음 라우트 이름으로 끊으면 이름이 다른
  //   형제 라우터(adminUrshortsRoutes 등)를 지나쳐 남의 핸들러까지 읽는다 — 실제로 그렇게 오탐했다.
  const end = src.indexOf('\n})', at)
  expect(end, '핸들러 끝을 못 찾았다').toBeGreaterThan(at)
  return src.slice(at, end)
}

describe('publicCache 로 옮긴 핸들러는 신원을 읽지 않는다', () => {
  const IDX = fs.readFileSync('src/worker/index.ts', 'utf8')
  it('사이드 배너', () => {
    const b = handlerBody(IDX, "app.get('/api/side-banners', publicCache(600)")
    expect(b).not.toMatch(IDENTITY)
  })
  it('홈 섹션 목록', () => {
    const b = handlerBody(fs.readFileSync('src/features/sections/api/sections.routes.ts', 'utf8'), "sectionsRoutes.get('/', publicCache(120)")
    expect(b).not.toMatch(IDENTITY)
  })
  it('숏폼 레일', () => {
    const b = handlerBody(fs.readFileSync('src/features/urshorts/api/urshorts.routes.ts', 'utf8'), "urshortsRoutes.get('/', publicCache(300)")
    expect(b).not.toMatch(IDENTITY)
  })
  it('브랜드 공개 라우트 파일 전체', () => {
    expect(IDX).toMatch(/app\.use\('\/api\/brands\/\*', publicCache\(300\)\)/)
    expect(fs.readFileSync('src/features/brands/api/brands-public.routes.ts', 'utf8')).not.toMatch(IDENTITY)
  })
  it('유어샵은 주인 응답이 달라 edgeCache 그대로다(반대 방향)', () => {
    expect(IDX).toMatch(/app\.use\('\/api\/curator\/:handle', edgeCache\(300\)\)/)
  })
})
