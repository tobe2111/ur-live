/**
 * 🧪 2026-11-12 생활 견적 입구 닫힘(토스페이먼츠 PG 심사 — "견적 문의" 입점 불가 업종).
 *
 * 닫혀 있는 동안 손님이 `/life*` 로 들어올 길이 없어야 한다: 워커 302 · sitemap 미제출 · 홈/PC 탭 없음.
 * 반대 방향: 닫힌 판정이 `/life` 접두어만 잡고 비슷한 이름(`/lifestyle`)은 안 잡는다.
 * ⚠️ 못 보는 것: 라이브에서 실제로 302 가 나는지(배포 후 curl 로 본다) · 앱 안에 열려 있던 탭의 내부 이동.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { LIFE_PUBLIC_CLOSED, isClosedLifePath } from '@/shared/life-closed'
import { DEAL_CAT_LABELS, HOME_TAB_LINKS } from '@/shared/deal-cats'
import { buildHomeFirstScreen } from '@/worker/utils/home-first-screen'

describe.runIf(LIFE_PUBLIC_CLOSED)('생활 입구 닫힘', () => {
  it('판정 — /life 와 그 아래만', () => {
    for (const p of ['/life', '/life/pro', '/life/request/move', '/life/q/abc', '/life/biz/3', '/life/requests/1']) expect(isClosedLifePath(p)).toBe(true)
    for (const p of ['/', '/lifestyle', '/map', '/admin/home-service']) expect(isClosedLifePath(p)).toBe(false)
  })

  it('워커가 문서 요청을 홈으로 302 한다', () => {
    expect(readCode('src/worker/index.ts')).toMatch(/if \(isClosedLifePath\(url\.pathname\)\) return Response\.redirect\(`\$\{url\.origin\}\/`, 302\)/)
  })

  it('sitemap 이 생활 URL 을 제출하지 않는다', () => {
    const code = readCode('src/worker/routes/sitemap.routes.ts')
    expect(code).toMatch(/\.\.\.\(LIFE_PUBLIC_CLOSED \? \[\] : \[/)
    expect(code).toMatch(/if \(!LIFE_PUBLIC_CLOSED\) \{/)
  })

  it('홈·PC 탭과 서버 첫 화면에 생활 버튼이 없다', () => {
    expect(DEAL_CAT_LABELS.map(c => c.key)).not.toContain('home_voucher')
    expect(HOME_TAB_LINKS.home_voucher).toBeUndefined()
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(JSON.stringify({ success: true, data: [{ id: 1, title: '줄', products: [{ id: 2, name: '돈가스', image_url: 'https://media.ur-team.com/b.jpg', price: 7500, category: 'meal_voucher', deal_only: 0 }] }] }), '')
    const tabs = [...(host.querySelector('#ur-first-screen nav')?.children ?? [])].map(c => c.textContent)
    expect(tabs.length).toBeGreaterThan(0)
    expect(tabs).not.toContain('생활')
  })
})
