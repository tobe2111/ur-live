/**
 * 🎁 교환권 상세 — 교환 버튼 브랜드 블루 · 확인창 수식 제거 〔2026-11-03 대표〕
 * *"1300딜로 교환하기 버튼 색 변경하고 싶고, 굳이 저 곱하기 수식이 필요한가 싶어"*
 *
 * 지키는 것: ① 주 버튼은 `bg-brand`(인라인 검정 그라디언트 금지 — 주 버튼 색 가드는 className 만 봐서 못 잡았다)
 *   ② 확인창에 `×`·`=` 수식이 없다 ③ 환불 불가 고지는 남는다 ④ 확인 버튼은 행동 이름, 빨강(danger) 아님.
 * 못 보는 것: 실제 렌더 색 — 그려서 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const src = stripComments(readFileSync('src/pages/VoucherDetailPage.tsx', 'utf8'))
const dialog = src.slice(src.indexOf('confirmDialog({'), src.indexOf('})', src.indexOf('confirmDialog({')))

describe('교환권 교환 — 버튼·확인창', () => {
  it('① 교환 버튼은 브랜드 블루이고 검정 그라디언트가 없다', () => {
    expect(src).toMatch(/className="flex-1 h-\[54px\] rounded-2xl bg-brand text-white/)
    expect(src).not.toContain('linear-gradient(180deg,#26282D,#16181C)')
  })
  it('② 확인창에 곱하기·등호 수식이 없다', () => {
    expect(dialog).not.toMatch(/[×=]/)
  })
  it('③ 환불 불가 고지는 남는다', () => {
    expect(dialog).toContain('환불할 수 없어요')
  })
  it("④ 확인 버튼은 '교환하기' 이고 빨강이 아니다", () => {
    expect(dialog).toContain("confirmText: '교환하기'")
    expect(dialog).not.toMatch(/danger:\s*true/)
  })
})
