/**
 * 🍽️ 영업신고증을 **판매 전에 본다** — 그리고 **막지는 않는다** (2026-09-21 대표 확정 2건).
 *
 * ## 대표가 말한 그대로
 * 1. *"1번은 알겠어. 판매 전으로 하자."* — 유어딜에서 판매가 시작되는 순간은 어드민이 **승인 버튼을
 *    누를 때**다. 그러니 그 화면에 서류가 보여야 한다.
 * 2. *"등록증이 없어도 승인 되게끔 해줘. 어차피 내가 보고 승인해야하잖아."* —
 *    ⇒ **코드가 서류로 승인을 막지 않는다.** 내가 제안했던 "서류 없으면 승인 버튼 잠그기" 는 기각됐다.
 *
 * ## 🩸 실측 (2026-09-21 라이브)
 * ```
 * sellers 7행 · business_registration_status 전원 pending · food_permit_url **0건**
 * 승인 화면에는 사업자등록증만 있었다 — 영업신고증은 볼 방법 자체가 없었다
 * ```
 *
 * ## 이 시험이 지키는 불변식
 * 1. 승인 화면이 영업신고증을 **보여 준다**(서버가 얹고, 화면이 그린다).
 * 2. **막지 않는다** — 승인 버튼이 서류 유무에 묶이지 않는다. ← 대표 결정. 되돌리면 빨간불.
 * 3. 업종 판정은 순수 함수 하나(`needsFoedPermit`)이고, 모르면 조용하다.
 * 4. 안 낸 칸이 "승인 불가" 라고 **거짓말하지 않는다**.
 *
 * ## ⚠️ 이 시험이 못 하는 것
 * - 어느 업종이 **법적으로** 영업신고 대상인지. 그건 대표·전문가 판단이고, 여기 규칙은
 *   *"화면에 한 줄 띄울지"* 를 고르는 휴리스틱일 뿐이다(틀려도 아무것도 안 막힌다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { needsFoodPermit } from '@/shared/food-permit'

const PAGE = stripComments(readFileSync('src/pages/AdminSellerApprovalPage.tsx', 'utf-8'))
const BLOCK = stripComments(readFileSync('src/pages/admin-seller-approval/FoodPermitBlock.tsx', 'utf-8'))
const FLAG = stripComments(readFileSync('src/features/admin/api/seller-permit-flag.ts', 'utf-8'))
const ROUTE = stripComments(readFileSync('src/features/admin/api/admin-sellers.routes.ts', 'utf-8'))
const ENRICH = stripComments(readFileSync('src/features/admin/api/admin-sellers/enrich-rows.ts', 'utf-8'))

describe('업종 판정 — 순수 함수 (표시용 힌트일 뿐이다)', () => {
  it('① 우리 8종 중 음식 계열이면 참', () => {
    expect(needsFoodPermit('restaurant', null)).toBe(true)
    expect(needsFoodPermit('cafe', null)).toBe(true)
  })

  it('② 카카오 업종 원문으로도 판단한다 (가입 문·매장 등록 문 둘 다 남긴다)', () => {
    expect(needsFoodPermit(null, '음식점 > 한식 > 육류,고기 > 갈비')).toBe(true)
    expect(needsFoodPermit(null, '음식점 > 카페 > 커피전문점')).toBe(true)
  })

  it('③ 음식이 아니면 거짓 — 미용실 카드에 안내를 띄우지 않는다', () => {
    expect(needsFoodPermit('beauty', '서비스,산업 > 뷰티 > 네일샵')).toBe(false)
    expect(needsFoodPermit('stay', '숙박 > 모텔')).toBe(false)
  })

  it('④ 모르면 조용하다 — 둘 다 비면 거짓', () => {
    expect(needsFoodPermit(null, null)).toBe(false)
    expect(needsFoodPermit('', '')).toBe(false)
    expect(needsFoodPermit(undefined, undefined)).toBe(false)
  })
})

describe('승인 화면 — 보여 준다', () => {
  it('⑤ 서버가 목록에 영업신고증과 업종 힌트를 얹는다', () => {
    // 🩸 첫 판은 **이름만** 셌다 — `needs_food_permit = false` 로 바꿔도 글자가 남아 통과했다
    //   (주입이 잡았다). 오늘 세 번째로 밟은 클래스라 여기선 **값의 출처**를 본다.
    expect(FLAG).toMatch(/food_permit_url\s*=\s*url/)
    expect(FLAG, '업종 힌트가 판정 함수에서 오지 않는다').toMatch(
      /needs_food_permit\s*=\s*needsFoodPermit\(/,
    )
  })

  it('⑥ 승인 목록이 실제로 그 함수를 탄다 (import 만 있으면 아무 일도 안 일어난다)', () => {
    // 라우트(961줄 동결)는 한 줄만 두고, 무엇을 얹는지는 `enrich-rows.ts` 에서 자란다.
    expect(ROUTE, '승인 목록이 enrich 를 안 부른다').toMatch(/m => m\.enrichSellerRows\(DB, sellers\)/)
    expect(ENRICH, 'enrich 가 영업신고증을 안 얹는다').toMatch(/m\.attachFoodPermitFlag\(DB, rows\)/)
  })

  it('⑦ 승인 카드가 그 값을 그린다', () => {
    expect(PAGE).toMatch(/<FoodPermitBlock[^>]*url=\{s\.food_permit_url\}/)
    expect(PAGE).toMatch(/needed=\{s\.needs_food_permit\}/)
  })

  it('⑧ 안 냈고 음식 업종도 아니면 칸 자체를 안 만든다', () => {
    expect(BLOCK).toMatch(/if \(!url && !needed\) return null/)
  })
})

describe('🔴 막지 않는다 — 대표 결정 (되돌리면 빨간불)', () => {
  /**
   * 판매 승인 버튼 **전부**. 🩸 첫 판은 앵커를 `approveSeller` 로 잡았는데 실제 이름은 `approve` 였고
   * (시험이 통째로 빨간불), 게다가 버튼이 **두 곳**이다(대기 목록 카드 + 상세). 하나만 보면
   * 다른 하나에 게이트를 걸어도 초록이 뜬다.
   */
  function approveButtons(): string[] {
    const out: string[] = []
    for (let at = PAGE.indexOf('approve(s.id)'); at !== -1; at = PAGE.indexOf('approve(s.id)', at + 1)) {
      // 사업자등록증 '승인'(verifyBizReg)이 아니라 **판매 승인**만 — 그 둘은 다른 버튼이다.
      out.push(PAGE.slice(Math.max(0, at - 250), at + 250))
    }
    expect(out.length, '판매 승인 버튼을 못 찾았다 — 앵커가 낡았다(통과 아님)').toBeGreaterThanOrEqual(2)
    return out
  }

  it('⑨ 승인 버튼이 서류 유무에 묶이지 않는다 (대표 "어차피 내가 보고 승인해야하잖아")', () => {
    for (const b of approveButtons()) {
      for (const forbidden of ['food_permit', 'business_registration_image_url', 'needs_food_permit']) {
        expect(b, `승인 버튼이 ${forbidden} 로 게이트됐다 — 대표가 기각한 설계다`).not.toContain(forbidden)
      }
      expect(b, '승인 버튼의 disabled 가 진행 중 표시 말고 다른 것에 묶였다')
        .toMatch(/disabled=\{actingId === s\.id\}/)
    }
  })

  it('⑩ 서류 칸이 "승인 불가" 라고 거짓말하지 않는다 (화면이 거짓말하면 아무도 안 본다)', () => {
    for (const lie of ['승인 불가', '승인할 수 없', '필수 서류', '제출해야']) {
      expect(BLOCK, `안 막으면서 "${lie}" 라고 말한다`).not.toContain(lie)
    }
  })
})
