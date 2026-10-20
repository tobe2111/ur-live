/**
 * 🧾 **매장 계산대는 카운터 화면이다 — 소비자 액자에 넣지 않는다** (2026-09-28)
 *
 * 대표 신고(PC 스크린샷 첨부): *"`urdeal.kr/store/scan?from=my` QR로 찍으려니 별도 이 페이지가
 * 뜨네? 이게 가장 이상적이야?"*
 *
 * ## 실측 (1440px)
 * 계산대가 **430 액자**에 갇혀 있었고, 좌우 거터를 채운 것이 하필 *소비자 앱 광고*였다 —
 * `유어딜 안전결제` · `매일 새로운 동네 딜` · **`모바일로 보기` QR**.
 * 가게 PC 로 계산하는 사장님에게 "모바일로 보라" 는 QR 을 띄우고 있었다.
 * 형제 화면(`/store/new`·`/store/find`·`/my-store`)은 2026-09-21 에 이미 액자를 벗었는데
 * **계산대만 빠져 있었다** — 규칙이 없어서가 아니라 목록에서 누락된 것이다.
 *
 * ## 그리고 `?from=my` 를 아무도 안 읽고 있었다
 * 마이의 큰 버튼은 `withMyReturn('/store/scan')` 으로 보내는데, 이 화면은 `SellerLayout` 밖이라
 * 그 띠(`BackToMyBar`)가 **붙는 자리가 없었다.** `BackToMyBar` 자신이 머리말에 적어 둔
 * *"페이지마다 붙이면 안 붙인 페이지가 반드시 생긴다"* 의 바로 그 페이지다.
 *
 * ⚠️ **이 시험이 못 하는 것**: 액자가 실제로 벗겨지는지는 렌더 폭의 문제라 jsdom 이 못 잰다.
 *   브라우저 판정: `node scripts/visual-preview.mjs --route=/store/scan --auth=user --stores=1 --pc`
 *   (거터 레일 `aside` 가 0개여야 한다 — 수리 전엔 2개였다.)
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { isFullBleedPcPath } from '@/shared/pc-fullbleed'

const PAGE = readCode('src/pages/StoreScanPage.tsx')

describe('매장 계산대 — PC 액자', () => {
  it('🔴 `/store/scan` 은 PC 에서 액자를 벗는다', () => {
    expect(isFullBleedPcPath('/store/scan')).toBe(true)
  })

  it('형제 화면과 같은 판정이다 (이 기준이 계산대만 비껴가지 않게)', () => {
    for (const p of ['/store/new', '/store/find', '/my-store']) {
      expect(isFullBleedPcPath(p), p).toBe(true)
    }
  })

  it('접두사로 넣지 않았다 — `/store/...` 를 통째로 벗기면 안 된다', () => {
    // 지금은 `/store/scan` 하나만 대상이다. 접두사로 넣으면 앞으로 생길 `/store/*` 가
    // 검토 없이 따라 벗겨진다(이 파일이 `/referral/` 에서 두 번 겪은 함정).
    expect(isFullBleedPcPath('/store/anything-else')).toBe(false)
  })

  it('숨길 하단 고정바가 없다 (pc-fullbleed 등재 조건)', () => {
    expect(PAGE).not.toContain('app-frame-bar')
    expect(readCode('src/components/voucher/VoucherScanner.tsx')).not.toContain('app-frame-bar')
  })
})

describe('매장 계산대 — 마이에서 왔으면 마이로', () => {
  it('🔴 주소의 표시를 읽어 세션에 적는다 (안 적으면 아무도 안 읽는다)', () => {
    expect(PAGE).toContain('noteMyReturn(')
  })

  it('🔴 뒤로 버튼이 마이로 돌려보낸다 — 판정은 SSOT 가 한다', () => {
    expect(PAGE).toContain('shouldOfferMyReturn()')
    expect(PAGE).toMatch(/clearMyReturn\(\)[\s\S]{0,80}assign\(MY_PATH\)/)
  })

  it('마이 주소를 손으로 적지 않는다 (바뀌면 한 곳만 고친다)', () => {
    expect(PAGE).not.toContain("'/user/profile'")
  })

  it('표시가 없으면 종전대로 브라우저 뒤로다 (직접 들어온 사람의 동작 불변)', () => {
    expect(PAGE).toContain('navigate(-1)')
  })
})
