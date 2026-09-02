/**
 * 🎫 표면 체계 계약 (2026-09-02 대표 확정 — 코레일톡 다크·화이트 시안 "오차없이 정확하게")
 *
 * 규율은 문서가 아니라 테스트로. 이 파일이 지키는 것:
 *   ① 토큰 — 브랜드 블루·시안 바탕·카드·rule·lift 가 index.css 양 테마에 있다(로즈·구 다크 hex 로 되돌아가지 않는다)
 *   ② 결제 완료 — 이용권 confirm 이 자동 이동 대신 티켓 화면을 그린다(체크 원 0)
 *   ③ 티켓 부품 — 테두리·그림자 스택 없이 밴드 + shadow-lift + border-rule 만
 *   ④ 하단 탭 — 다섯 탭 전부 유어딜 아이콘, 활성 = 면(filled)
 *   ⑤ 지갑 — 접기 박스 대신 탭, 카드는 TicketCard
 *
 * 못 막는 것: 렌더 결과(색이 실제로 어떻게 보이는지)는 하네스 `scripts/visual-preview.mjs` 로 눈으로 본다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const R = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8')
/** 주석을 벗긴 본문 — "구 로즈 #E0526B 폐기" 같은 설명이 위반으로 잡히면 안 된다(주석은 규칙이 아니라 기록). */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① 토큰 — 시안 실측값이 SSOT 에 있다', () => {
  const css = code(R('src/index.css'))
  it('브랜드 블루 #1C69EF, 구 로즈 0', () => {
    expect(css).toMatch(/--brand:\s*#1C69EF/i)
    expect(css).not.toMatch(/#E0526B/i)
  })
  it('다크 바탕 #11141C · 카드 #1D1F29 (대표 "뒷 배경색이 가장 마음에 들어")', () => {
    expect(css).toMatch(/--bg:\s*#11141C/i)
    expect(css).toMatch(/--surface:\s*#1D1F29/i)
    expect(css).not.toMatch(/--bg:\s*#0D0F12/i)
  })
  it('화이트 바탕 #F8F7FC', () => {
    expect(css).toMatch(/--bg:\s*#F8F7FC/i)
  })
  it('rule / rule-strong / lift 가 라이트·다크 양쪽에 정의', () => {
    expect((css.match(/--rule:/g) || []).length).toBeGreaterThanOrEqual(2)
    expect((css.match(/--rule-strong:/g) || []).length).toBeGreaterThanOrEqual(2)
    expect((css.match(/--lift:/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(css).toMatch(/--lift:\s*none/)
  })
  it('tailwind 가 shadow-lift · border-rule 을 노출', () => {
    const tw = R('tailwind.config.js')
    expect(tw).toMatch(/lift:\s*'var\(--lift\)'/)
    expect(tw).toMatch(/rule:\s*\{\s*DEFAULT:\s*'var\(--rule\)'/)
  })
})

describe('② 결제 완료 — 자동 이동 폐기, 티켓 화면', () => {
  const page = R('src/pages/GroupBuyConfirmPaymentPage.tsx')
  it('setTimeout 으로 /my-vouchers 자동 이동하지 않는다', () => {
    expect(page).not.toMatch(/setTimeout\([^)]*navigate\('\/my-vouchers'\)/)
  })
  it('성공 시 PaymentCompleteTicket 을 렌더', () => {
    expect(page).toMatch(/<PaymentCompleteTicket\b/)
  })
  it('체크 원·X 원 아이콘 0 (시안: 제목 한 줄이 전부)', () => {
    expect(page).not.toMatch(/CheckCircle|XCircle/)
  })
  const ticket = R('src/pages/group-buy/PaymentCompleteTicket.tsx')
  it('티켓 화면은 TicketCard + outline 버튼 + 안내 + 서비스 타일로 구성', () => {
    expect(ticket).toMatch(/<TicketCard\b/)
    expect(ticket).toMatch(/<TicketOutlineButton\b/)
    expect(ticket).toMatch(/<TicketNotes\b/)
    expect(ticket).toMatch(/<CategoryTile\b/)
    expect(ticket).toMatch(/결제가 완료되었어요/)
  })
})

describe('③ 티켓 부품 — 테두리·그림자 스택 없음', () => {
  const src = code(R('src/components/ticket/TicketCard.tsx'))
  it('카드 밖 테두리(border border-*) 0, 그림자는 shadow-lift 만', () => {
    expect(src).not.toMatch(/\bborder border-(gray|\[#)/)
    expect(src).not.toMatch(/shadow-(sm|md|lg|xl|2xl)\b/)
    expect(src).toMatch(/shadow-lift/)
  })
  it('밴드는 bg-brand, 구분선은 border-rule', () => {
    expect(src).toMatch(/bg-brand/)
    expect(src).toMatch(/border-rule\b/)
  })
})

describe('④ 하단 탭 — 유어딜 아이콘 한 벌, 활성 = 면', () => {
  const nav = R('src/components/main/BottomNav.tsx')
  it('탭 다섯 개가 urdeal-icons 에서 온다(lucide Home/Gift/Ticket/User 아님)', () => {
    expect(nav).toMatch(/icon: HomeIcon,/)
    expect(nav).toMatch(/icon: GiftBoxIcon,/)
    expect(nav).toMatch(/icon: TicketStubIcon,/)
    expect(nav).toMatch(/icon: UrShopIcon,/)
    expect(nav).toMatch(/icon: PersonIcon,/)
    expect(nav).not.toMatch(/icon: (Home|Gift|Ticket|User),/)
  })
  it('활성 아이콘은 filled', () => {
    expect(nav).toMatch(/filled=\{active\}/)
  })
  it('아이콘 파일이 다섯 탭 + filled 를 export', () => {
    const icons = R('src/components/icons/urdeal-icons.tsx')
    for (const n of ['HomeIcon', 'GiftBoxIcon', 'TicketStubIcon', 'UrShopIcon', 'PersonIcon']) expect(icons).toMatch(new RegExp(`export const ${n} =`))
    expect(icons).toMatch(/filled\?: boolean/)
    expect(icons).toMatch(/strokeWidth: 1\.6/)
  })
})

describe('⑤ 지갑 — 탭 + TicketCard', () => {
  const page = R('src/pages/MyVouchersPage.tsx')
  const card = R('src/pages/my-vouchers/VoucherTicket.tsx')
  it('이용권 지갑은 접기 박스(WalletArchive) 대신 [사용 가능|사용 완료] 탭', () => {
    expect(page).not.toMatch(/<WalletArchive\b/)
    expect(page).toMatch(/setTab\(/)
  })
  it('카드는 TicketCard 이고 천공·노치·테두리 스택이 없다', () => {
    expect(card).toMatch(/<TicketCard\b/)
    expect(card).not.toMatch(/notchStyle/)
    expect(card).not.toMatch(/rounded-\[18px\] bg-white dark:bg-\[#141414\] border/)
  })
})

describe('⑥ 아이콘 컨셉 — 채색 flat 타일 세트가 존재하고 윤곽선을 안 쓴다', () => {
  const src = R('src/components/icons/category-icons.tsx')
  it('팔레트 SSOT + 원 타일', () => {
    expect(src).toMatch(/export const CATEGORY_PALETTE/)
    expect(src).toMatch(/export function CategoryTile/)
  })
  it('아이콘은 fill 로만 그린다(윤곽선 stroke 는 김·절취선 같은 장식 2곳 이하)', () => {
    const strokes = (src.match(/stroke=/g) || []).length
    expect(strokes).toBeLessThanOrEqual(3)
  })
})
