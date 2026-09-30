import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🔧 2026-09-28 (대표 확정 **e3** — "E3로 하고 /u/me/manage 신설해줘") 계약.
 *
 * 지키는 것 하나: **유어샵은 손님 화면 하나뿐이고, 고치는 일은 전부 `/u/me/manage` 에 있다.**
 *   종전엔 [유어샵 편집]이 손님 화면 **위에 관리 chrome 다섯 덩어리**를 덧칠했다 —
 *   편집 툴바 · 적립 한 줄 · 돈 버는 길 3단계 · 판매 진입 CTA · 순서 바꾸기,
 *   거기에 카드마다 삭제 pill 과 목록 끝 '+ 추가' 카드. 그래서 주인/손님 화면이 갈렸다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 렌더된 픽셀(헤더가 실제로 면으로 나뉘어 보이는지, 관리 화면이
 *    읽히는지)은 문자열로 못 잰다 — 브라우저로 눈으로 본다. 여기서 재는 것은 **배선**뿐이다.
 */
const read = (f: string) => readFileSync(f, 'utf-8')
const APP = 'src/App.tsx'
const PAGE = 'src/pages/CuratorPage.tsx'
const HEADER = 'src/pages/curator-page/CuratorHeader.tsx'
const MANAGE = 'src/pages/UShopManagePage.tsx'
const CARDS = 'src/pages/ushop-manage/ShopInfoCards.tsx'

/** 관리 화면이 맡기로 한 다섯 덩어리 — 유어샵에서 사라지고 여기서 나타나야 한다. */
const MOVED = ['OwnerEarningsStrip', 'PinManageList', 'EarnLadder', 'SellOwnProductsCTA'] as const

describe('e3 — 관리 화면 분리', () => {
  it('/u/me/manage 가 로그인 뒤에만 열린다', () => {
    const src = codeOnly(read(APP))
    expect(src).toMatch(/<Route path="\/u\/me\/manage" element=\{<ProtectedRoute requireUser>/)
    expect(src).toContain("import('./pages/UShopManagePage')")
  })

  it('옮긴 다섯 덩어리가 관리 화면에 **있고** 유어샵에는 **없다**', () => {
    const manage = codeOnly(read(MANAGE))
    const page = codeOnly(read(PAGE))
    for (const name of MOVED) {
      expect(manage, `${name} 이 관리 화면에 없다`).toContain(name)
      expect(page, `${name} 이 아직 유어샵에 남아 있다`).not.toContain(name)
    }
    // 이름·소개·주소·SNS 편집도 헤더가 아니라 관리 화면이 맡는다.
    expect(manage).toContain('ShopInfoCards')
    expect(codeOnly(read(HEADER))).not.toContain('/api/curator/me/profile')
    expect(codeOnly(read(CARDS))).toContain('/api/curator/me/profile')
  })

  it('유어샵 카드에 삭제 pill 도 "+ 추가" 점선 카드도 없다', () => {
    const src = codeOnly(read(PAGE))
    expect(src).not.toContain('curator.deletePin')
    expect(src).not.toContain('border-dashed')
    expect(src).not.toContain('removePin')
  })

  it('헤더: urdeal 로고가 홈 링크이고, 주소 텍스트는 적지 않는다', () => {
    const src = codeOnly(read(HEADER))
    // 로고 = 홈. 스크린리더가 "urdeal" 만 읽으면 어디로 가는지 모른다 → aria-label 필수.
    expect(src).toMatch(/<Link to="\/"[\s\S]{0,200}?aria-label=/)
    // 🩸 2026-09-30 재조준: 종전엔 `toContain('urdeal')` — 즉 **워드마크를 손으로 적었는지**를 봤다.
    //   그게 바로 결함이었다(라이브 실측 `font: Pretendard` · 브랜드 원 마침표 없음). 이제 SSOT 부품을
    //   쓰므로 그 문자열이 소스에 없다. 지키려던 것은 "로고가 있고 홈으로 간다" 이고, 그건 그대로다.
    expect(src, '워드마크는 SSOT 부품으로 그린다').toContain('<UrDealLogo')
    // 대표: "링크를 적지 말고 그냥 공유하기 버튼 하나로 둬줘" — 주소는 [공유]가 보낸다.
    expect(src).not.toContain('shareHost')
    expect(src).not.toMatch(/@\{curator\.handle\}/)
  })

  it('공유는 네이티브 시트 우선 · 없으면 링크 복사(자리는 하나)', () => {
    const src = codeOnly(read(PAGE))
    expect(src).toMatch(/nav\.share === 'function'/)
    expect(src).toContain('clipboard.writeText')
  })

  it('관리 화면은 소유권을 seller_token 으로 판정하지 않는다', () => {
    // 🔴 유어샵 소유권 = 로그인 소비자 유저(check-linkshop-ownership). 토큰을 보면 그 규칙이 깨진다.
    for (const f of [MANAGE, CARDS, HEADER]) {
      expect(codeOnly(read(f)), f).not.toContain('seller_token')
    }
  })

  it('검사 대상이 실제로 존재한다(0건이면 통과가 아니라 고장)', () => {
    expect(MOVED.length).toBeGreaterThanOrEqual(4)
    for (const f of [APP, PAGE, HEADER, MANAGE, CARDS]) {
      expect(read(f).length, f).toBeGreaterThan(400)
    }
  })
})
