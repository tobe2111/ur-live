/**
 * 🔀 화면 밖 공용 묶음이 손님 화면을 무겁게 하던 것 (2026-10-18) — 근거는 vite.config.ts `CROSS_MODULES` 주석.
 *   장바구니는 링크 하나, 로그아웃 마이는 카드 하나 때문에 공용 부품 묶음(26.6KB br)과 상품 화면 묶음·embla 를 받았다.
 *
 * 고정하는 것:
 *   ① 고정 묶음 `app-cross` 의 규칙이 있고, 묶음기가 그 이름을 건드리지 않는다(보호 목록)
 *   ② 목록의 경로가 실재한다(파일이 옮겨지면 규칙이 조용히 아무것도 안 잡는다)
 *   ③ 규칙이 lucide 아이콘 규칙보다 **앞**에 있다(빼기 아이콘이 lucide 봉투로 먼저 빠지면 소용없다)
 *   ④ 장바구니가 첫 화면에 안 쓰는 것을 정적으로 끌고 오지 않는다 — 옵션 창(lazy) · 결제 시작 유틸(누른 뒤 동적)
 * ⚠️ 못 막는 것: 실제 바이트(그건 `check-surface-budgets` 의 cart·guestMy 래칫이 잰다) · 목록 밖 새 부품이 같은 짓을 하는 것.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { LIBRARY_ENVELOPES } from '../../../scripts/surface-chunks.mjs'
import { stripComments } from '../helpers/source-text'

const VITE = readFileSync('vite.config.ts', 'utf8')
const listSrc = VITE.slice(VITE.indexOf('export const CROSS_MODULES = ['), VITE.indexOf(']', VITE.indexOf('export const CROSS_MODULES = [')))
const MODULES = [...listSrc.matchAll(/'([^']+)'/g)].map((m) => m[1])

describe('① 고정 묶음', () => {
  it('규칙이 있고 묶음기 보호 목록에 있다', () => {
    expect(stripComments(VITE)).toMatch(/if \(CROSS_MODULES\.some\(\(p\) => id\.includes\(p\)\)\) return 'app-cross'/)
    expect(LIBRARY_ENVELOPES.has('app-cross')).toBe(true)
  })
  it('목록이 비지 않았고 원인 부품 둘이 들어 있다', () => {
    expect(MODULES.length).toBeGreaterThanOrEqual(3)
    expect(MODULES).toContain('/src/components/mall/')
    expect(MODULES).toContain('/src/components/deal/DealMiniCard')
  })
})

describe('② 경로 실재', () => {
  it('목록의 src 경로가 파일·폴더로 존재한다', () => {
    for (const p of MODULES.filter((x) => x.startsWith('/src/'))) {
      const base = p.slice(1).replace(/\/$/, '')
      const ok = [base, `${base}.ts`, `${base}.tsx`].some((c) => existsSync(c))
      expect(ok, p).toBe(true)
    }
  })
})

describe('③ 규칙 순서', () => {
  it('app-cross 규칙이 lucide 아이콘 규칙보다 앞', () => {
    const code = stripComments(VITE)
    const cross = code.indexOf("return 'app-cross'")
    const lucide = code.search(/return 'lucide(-shell|-home)?'/)
    expect(cross).toBeGreaterThan(0)
    expect(lucide).toBeGreaterThan(cross)
  })
})

describe('④ 장바구니 첫 화면', () => {
  const cart = stripComments(readFileSync('src/pages/CartPage.tsx', 'utf8'))
  const checkout = stripComments(readFileSync('src/pages/cart/voucher-checkout.ts', 'utf8'))
  it('옵션 창은 정적으로 import 하지 않고 열 때만 그린다', () => {
    expect(cart).not.toMatch(/import OptionSelectModal from/)
    expect(cart).toMatch(/lazy\(\(\) => import\('@\/components\/OptionSelectModal'\)\)/)
    expect(cart).toMatch(/\{optionModal\.isOpen && \(/)
  })
  it('결제 시작 유틸(pay-summary · toss-key-type)은 함수 안에서 동적으로 부른다', () => {
    expect(checkout).not.toMatch(/import \{[^}]*\} from '@\/shared\/pay-summary'/)
    expect(checkout).not.toMatch(/import \{[^}]*\} from '@\/lib\/toss-key-type'/)
    expect(checkout).toMatch(/await Promise\.all\(\[\s*import\('@\/lib\/toss-key-type'\),\s*import\('@\/shared\/pay-summary'\),?\s*\]\)/)
  })
})
