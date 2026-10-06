/**
 * 🧾 2026-09-28 (대표 확정 **B안**) 유어샵 맨 아래 유입 링크 세 줄.
 *
 * ■ 무엇을 지키나
 *   ① **손님에게만** — 주인 화면엔 안 그린다. 대표가 `AskUserQuestion` 에서 골랐고,
 *      2026-06-19 에 하단 CTA 를 치운 이유 중 하나가 "주인에게도 떴다" 였다.
 *   ② **목록 뒤** — 목록이 끝난 뒤에 온다(상품을 한 픽셀도 밀지 않는다). 시안 실측 y=496.
 *   ③ **B안이다** — 판·배경·강조색 없음. C안(파란 버튼 셋)으로 되돌아가면 이 화면의 유일한
 *      강조색이 *상품이 아니라 문의* 로 간다(🎫 표면 규칙 ② "강조색 하나, 자리 셋").
 *   ④ **가는 곳 셋이 실재하는 라우트** — 죽은 링크를 조용히 내보내지 않는다.
 *   ⑤ **문구는 대표 원문 그대로** — 좋아서가 아니라 **대표가 골라서** 고정한다(아래 ⚠️).
 *
 * ■ ⚠️ 이 시험이 **일부러 규칙과 반대로** 고정하는 것
 *   `인플루언서 참여하기` 는 CLAUDE.md 의 *"사람 지칭에 인플루언서 금지"*(2026-08-26 대표 확정
 *   "행위 2개로 말한다")와 충돌한다. 충돌을 문구 표로 보고했고 **대표가 원문을 골랐다.**
 *   ⇒ 다음 세션이 "규칙 위반" 이라며 조용히 바꾸지 않도록 **대표 결정 쪽을 고정**한다.
 *      바꾸려면 규칙이 아니라 **대표에게** 물을 것.
 *
 * ■ 이 시험이 **못** 하는 것
 *   - 실제로 사람이 누르는지(전환)는 못 잰다. 라이브 판정은 유입 수로.
 *   - 렌더 위치(목록 뒤)는 소스 순서로만 본다 — 픽셀은 브라우저 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const LINKS = 'src/pages/curator-page/ShopInquiryLinks.tsx'
const PAGE = 'src/pages/CuratorPage.tsx'
const APP = 'src/App.tsx'

const read = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const links = read(LINKS)
const page = read(PAGE)
const app = read(APP)

describe('① 손님에게만 (주인은 숨김)', () => {
  it('측정이 비어 있지 않다', () => {
    // 0자면 통과가 아니라 고장이다(경로가 낡으면 아래 단언이 전부 무의미해진다).
    expect(links.length).toBeGreaterThan(500)
    expect(page.length).toBeGreaterThan(5000)
  })

  it('호출부가 !isOwner 로 게이트한다', () => {
    expect(page).toMatch(/\{!isOwner && <ShopInquiryLinks \/>\}/)
  })

  it('부품이 소유권을 스스로 캐지 않는다', () => {
    // check-linkshop-ownership ③ — 순수 뷰 자식은 prop 구동. 토큰/스토어를 직접 읽으면 안 된다.
    expect(links).not.toContain('seller_token')
    expect(links).not.toContain('localStorage')
    expect(links).not.toMatch(/useAuthStore|isOwner/)
  })
})

describe('② 목록이 끝난 뒤에 온다', () => {
  it('상품 목록보다 뒤에서 렌더된다', () => {
    const list = page.indexOf('<PinRow')
    const block = page.indexOf('<ShopInquiryLinks')
    expect(list, '목록이 있다').toBeGreaterThan(0)
    expect(block, '블록이 있다').toBeGreaterThan(0)
    expect(block, '블록은 목록 뒤').toBeGreaterThan(list)
  })
  /**
   * 🖥️ 2026-09-30 — **진열대 칸(`.ur-ushop-main`) 안**에 있어야 한다.
   * 밖에 두면 자기 `max-w-3xl mx-auto` 가 1,440px 페이지 한가운데를 잡아, PC 2단에서
   * 좌 프로필 칸(210~630)과도 줄(685~)과도 어긋난 **485~665** 에 떴다(2026-09-28 실측).
   * 칸 안에서는 `.ur-ushop-main .max-w-3xl` 가 상한·좌우 패딩을 지워 줄과 같은 선에 선다.
   * ⚠️ 모바일은 `.ur-ushop-pc` 가 lg+ 에서만 격자라 **DOM 순서 그대로** — 그림이 안 바뀐다.
   */
  it('🖥️ 진열대 칸 안에 있다 — PC 2단에서 줄과 같은 왼쪽 선', () => {
    const pane = page.indexOf('className="ur-ushop-main"')
    expect(pane, '진열대 칸이 있다').toBeGreaterThan(0)
    const block = page.indexOf('<ShopInquiryLinks')
    expect(block, '블록은 칸이 열린 뒤').toBeGreaterThan(pane)
    // 칸이 닫히기 전인가 — 뒤에만 있으면 칸 **밖**(페이지 꼬리)일 수도 있다.
    const closes = page.indexOf('\n        </div>\n        </div>', pane)
    expect(closes, '칸을 닫는 자리를 찾았다').toBeGreaterThan(pane)
    expect(block, '블록이 칸 밖으로 나갔다 — 페이지 한가운데에 떠서 어느 칸과도 안 맞는다').toBeLessThan(closes)
  })
})

describe('③ B안이다 — 판도 색도 없다', () => {
  it('흰 판(A안)이 아니다', () => {
    expect(links).not.toMatch(/bg-surface|bg-white|shadow-lift|rounded-xl|rounded-2xl/)
  })

  it('브랜드 색 버튼(C안)이 아니다', () => {
    // 되살아나면 이 화면의 유일한 강조색이 상품이 아니라 문의로 간다.
    expect(links).not.toMatch(/bg-brand|text-white|#1C69EF/)
  })

  it('회색 글자 한 벌이고 다크 대응이 있다', () => {
    expect(links).toMatch(/text-gray-500 dark:text-gray-400/)
    expect(links).toMatch(/text-\[12px\]/)
  })
})

describe('④ 가는 곳 셋이 실재한다', () => {
  const routes = ['/partners', '/influencer', '/partnership']

  it.each(routes)('%s 가 App.tsx 에 라우트로 있다', (r) => {
    expect(app, `${r} 라우트`).toContain(`path="${r}"`)
  })

  it('세 링크를 전부 그린다', () => {
    for (const r of routes) expect(links).toContain(`to: '${r}'`)
    expect((links.match(/to: '\//g) || []).length, '정확히 셋').toBe(3)
  })

  it('SPA 이동이다 — 통짜 새로고침이 아니다', () => {
    // <a href> 로 나가면 앱을 통째로 다시 받는다(도매 로그인 SPA 이동 가드와 같은 이유).
    expect(links).toMatch(/<Link\b/)
    expect(links).not.toMatch(/<a href=/)
  })
})

describe('⑤ 문구는 대표 원문 그대로 (규칙보다 대표 결정이 앞선다)', () => {
  it('세 문구가 대표가 쓴 말 그대로다', () => {
    expect(links).toContain('사장님 입점 신청')
    expect(links).toContain('인플루언서 참여하기')
    expect(links).toContain('제휴 및 협업 문의')
  })

  it('충돌을 아는 채로 골랐다는 것이 파일에 적혀 있다', () => {
    // 이 주석이 없으면 다음 세션이 "명칭 규칙 위반" 으로 읽고 조용히 바꾼다.
    const raw = readFileSync(LINKS, 'utf-8')
    expect(raw, '충돌을 명시').toMatch(/CLAUDE\.md[\s\S]{0,200}인플루언서/)
    expect(raw, '대표 결정이라는 근거').toMatch(/대표 결정이 규칙을 이긴다|대표가 원문을 골랐다/)
  })
})
