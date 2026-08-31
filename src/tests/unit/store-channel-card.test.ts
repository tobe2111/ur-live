/**
 * 💰 2026-08-31 어드민 매장 카드 — 채널 스위치 + 돈 갈림표.
 *
 * 대표: *"되게 복잡해졌어"* / *"3번 결과는 운영자인 나만 보여야 해"*
 *
 * ## 이 가드가 지키는 것
 * ① 채널을 바꿀 UI 가 실제로 배선돼 있다(그전엔 API 만 있고 부르는 화면이 없었다)
 * ② 돈 갈림표가 **어드민 밖으로 새지 않는다** — PG 준비금·유어딜 실수령이 들어 있다
 * ③ 영입 2% 조건(직접 입점 + 영입자)이 화면 계산에도 반영돼 있다
 *
 * ## 못 막는 것
 * 실제 렌더 결과·숫자의 정확성. 그건 staging 에서 눈으로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

const CARD = 'src/pages/admin-merchant-commissions/StoreChannelCard.tsx'
const PAGE = 'src/pages/AdminMerchantCommissionsPage.tsx'
const API = 'src/features/admin/api/admin-store-channel.routes.ts'

describe('① 채널을 바꿀 UI 가 배선돼 있다', () => {
  it('어드민 매장 카드가 컴포넌트를 렌더한다', () => {
    // import 만으로는 부족하다 — JSX 로 실제 렌더되는지 본다.
    expect(codeOnly(readFileSync(PAGE, 'utf-8'))).toMatch(/<StoreChannelCard\b/)
  })

  it('카드가 채널 PATCH 를 부른다', () => {
    expect(codeOnly(readFileSync(CARD, 'utf-8'))).toMatch(/api\.patch\([^)]*\/channel/)
  })
})

describe('② 돈 갈림표는 어드민 전용', () => {
  const src = codeOnly(readFileSync(API, 'utf-8'))

  it('요율은 어드민 채널 API 만 내보낸다', () => {
    expect(src).toContain('loadSplitRates')
  })

  it('소비자·셀러 API 가 PG 준비금을 내보내지 않는다', () => {
    // 새어 나가면 매장이 우리 마진 구조를 보게 된다.
    for (const f of [
      'src/features/seller/api/seller-stores.routes.ts',
      'src/features/group-buy/api/marketing.routes.ts',
    ]) {
      expect(codeOnly(readFileSync(f, 'utf-8')), f).not.toContain('pg_reserve_pct')
    }
  })

  it('카드 컴포넌트가 어드민 페이지 폴더 밖에서 안 쓰인다', () => {
    const page = codeOnly(readFileSync(PAGE, 'utf-8'))
    expect(page).toContain('admin-merchant-commissions/StoreChannelCard')
  })
})

describe('③ 영입 2% 조건이 화면 계산에 있다', () => {
  const src = codeOnly(readFileSync(CARD, 'utf-8'))

  it("직접 입점 + 영입자 지정 둘 다일 때만 2% 를 뺀다", () => {
    // 한쪽만 보면 화면이 "나간다"는데 정산은 0 이 되어 대표가 오판한다.
    expect(src).toMatch(/channel === 'direct' && hasIntroducer/)
  })

  it('채널 미지정이면 계산하지 않고 그 사실을 말한다', () => {
    expect(src).toMatch(/channel === 'direct' \? rates\.direct_pct : channel === 'brokered'/)
    expect(readFileSync(CARD, 'utf-8')).toContain('아직 지정 안 됨')
  })

  it('게이트가 꺼져 있으면 숨기지 않고 알린다', () => {
    expect(readFileSync(CARD, 'utf-8')).toContain('요율에 반영되지 않습니다')
  })
})
