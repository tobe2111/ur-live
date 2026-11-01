/**
 * 🏠 생활 견적 — 내 요청 찾기 · 링크 공유 (2026-10-31 대표
 *   *"견적을 낸 걸 마이페이지나 어디서 봐야하지 않을까? 그 견적 링크를 공유해야 홍보도 되는거잖아"*).
 *
 * 지키는 것:
 *  ① 마이 '내가 산 것' 에 `/life/requests` 로 가는 줄이 있다 — 종전엔 생활 페이지 중간 카드에만 묻혀 있었다.
 *  ② /life 첫 카드가 서비스 이름과 '내 견적 요청' 문을 말한다.
 *  ③ 공유 링크는 **받는 중(open)** 인 요청만 — 목록 API 가 마감된 요청의 토큰을 내보내지 않는다.
 *  ④ 목록·접수 완료 화면 둘 다 같은 공유 함수(`shareLifeRequest`)를 쓴다(두 벌이면 문구·주소가 갈린다).
 * ⚠️ 못 보는 것: 공유 시트가 실제로 뜨는지(브라우저) · 받은 사람이 공개 페이지에서 무엇을 보는지(별도 가드 life-share).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const R = (p: string) => readFileSync(p, 'utf8')

describe('생활 견적 — 내 요청 · 공유', () => {
  it('① 마이에 내 견적 요청 줄', () => {
    expect(R('src/pages/user-profile/ShoppingGroup.tsx')).toMatch(/path: '\/life\/requests'/)
  })
  it('② /life 첫 카드: 서비스 이름 + 내 견적 요청 문', () => {
    const s = R('src/pages/life/LifePage.tsx')
    expect(s).toContain('사장님 생활 견적 서비스')
    expect(s).toMatch(/<Link to="\/life\/requests"[^>]*>\s*내 견적 요청/)
  })
  it('③ 목록 API 는 open 요청만 토큰을 낸다', () => {
    const s = R('src/features/home-service/api/home-service.routes.ts')
    const i = s.indexOf("homeServiceRoutes.get('/requests/mine'")
    const block = s.slice(i, i + 800)
    expect(block).toMatch(/CASE WHEN status = 'open' THEN share_token END AS share_token/)
    expect(block).not.toMatch(/SELECT[^`]*,\s*share_token\s*,/)
  })
  it('④ 목록·접수 완료가 같은 공유 함수', () => {
    const list = R('src/pages/life/LifeMyRequestsPage.tsx')
    expect(list).toMatch(/\{r\.share_token && \(/)
    expect(list).toMatch(/shareLifeRequest\(r\.share_token!/)
    const form = R('src/pages/life/LifeRequestFormPage.tsx')
    expect(form).toMatch(/setDoneShare\(r\.data\.data\.share_token \|\| null\)/)
    expect(form).toMatch(/shareLifeRequest\(doneShare,/)
  })
})
