/**
 * 🏪 매장 추가 문 · 승인 전 이용권 등록 (2026-10-06 대표)
 *
 *   ① *"지금 상태에서 매장 등록 새로 마이 페이지에서 하려면 뭐 눌러야 해?"* — 답이 "없다" 였다.
 *      `내 가게 등록` 은 사장님이 아닐 때만 보이고, 가게 시트는 2곳 이상일 때만 열렸다.
 *   ② *"이용권 등록은 사업자 확인 이후라는데 그러면 안되지 않나?"* — 맞다. 등록 화면은 "건너뛰어도
 *      등록돼요. 다만 승인 전엔 메인에 안 보여요" 라고 하는데 내 매장 패널은 승인 전 매장을 **막았다**.
 *      서버(`switch-to-seller`)는 대기·반려를 열어 주고 메인 노출만 `approvedSellerProductSql` 이 거른다
 *      (2026-09-16 대표 확정 당근 모델). 막는 것은 정지(`suspended`) 하나뿐이어야 한다.
 *
 * ⚠️ 못 막는 것: 실제로 /store/new 가 열리는지(라우팅 런타임) · 서버 쪽 정책 변경.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const R = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const SHEET = R('src/pages/user-profile/StoreSwitchSheet.tsx')
const SECTION = R('src/pages/user-profile/SellerSection.tsx')

describe('① 사장님이 된 뒤에도 마이에서 매장을 더할 수 있다', () => {
  it('가게 시트에 [매장 추가] 가 있고 /store/new 로 간다', () => {
    expect(SHEET).toMatch(/navigate\('\/store\/new/)
    expect(SHEET).toContain('매장 추가')
  })
  it('가게가 1곳이어도 시트를 열 수 있다', () => {
    // 🏪 2026-10-31 B안: 가게 머리줄 전체가 버튼이다 — 개수 조건 없이(기다리는 동안만 막는다) 시트를 연다.
    expect(SECTION).toMatch(/disabled=\{awaiting\}\s*onClick=\{\(\) => setSheetOpen\(true\)\}/)
  })
})
