/**
 * 🏪 가입 입력 부품 — 대표 확정 **시각 C** (2026-09-16)
 *
 * 시안·근거: docs/design/seller-signup-documents.md
 *
 * 🪦 2026-10-12 축소: 옛 가입 폼(`SellerRegisterSupplierPage`)과 그 부품(가게 정보 카드·주소 검색·
 *   확인 시트)은 **아무도 import 하지 않는 파일**이 되어 지웠다 — 가입 문은 2026-10-10 부터
 *   `/store/new` 하나다. 그 화면을 대상으로 하던 단언(남은-것 목록·라벨·주소 검색)은 지킬 대상이
 *   사라져 함께 뺐다. 남은 것은 **아직 쓰이는 입력 부품**(`RegisterFields` — 매장 등록 모달이
 *   사업자번호 포매터를, 시안 미리보기가 입력 칸을 쓴다)의 시각 계약이다.
 *
 * ⚠️ 이 시험이 **못 막는 것**: 실제로 예쁜지(렌더로 눈으로 봐야 한다).
 *
 * 주입 매니페스트: scripts/mutations/seller-signup-c.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const FIELDS = read('src/pages/seller-register/RegisterFields.tsx')

describe('가입 화면 — 시각 C(큰 입력)', () => {
  it('입력 값이 크고 굵다 — 채운 칸과 빈 칸이 굵기로 갈린다', () => {
    expect(FIELDS).toMatch(/INPUT\s*=[\s\S]{0,400}?text-\[17px\][\s\S]{0,200}?font-bold/)
    expect(FIELDS).toMatch(/placeholder:font-normal/)
  })

  it('16px 미만으로 내리지 않는다 — iOS 가 포커스 때 화면을 확대한다', () => {
    const m = FIELDS.match(/INPUT\s*=[\s\S]{0,400}?text-\[(\d+(?:\.\d+)?)px\]/)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBeGreaterThanOrEqual(16)
  })

  it('상자를 없앤 대신 포커스 신호가 있다 — 없으면 키보드 사용자가 위치를 잃는다', () => {
    expect(FIELDS).toContain('group-focus-within:opacity-100')
    expect(FIELDS).toMatch(/<div className="group relative/)
  })
})
