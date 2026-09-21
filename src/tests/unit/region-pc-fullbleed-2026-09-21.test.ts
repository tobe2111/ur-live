import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isFullBleedPcPath } from '@/shared/pc-fullbleed'
import { stripComments } from '../helpers/source-text'

/**
 * 🗺️ 지역 페이지 PC 풀너비 — 되돌려-검증 가능한 계약 (2026-09-21).
 *
 * 대표 신고: *"하단에 지역으로 누르니까 … 이 부분도 PC 버전 원래쓰던 것처럼 떠야지"*.
 * 푸터 '지역별 동네딜' 은 **풀너비 PC 홈**에 있는데 거기서 시/도를 누르면 도착하는 지역 페이지가
 * 430px 액자였다 — 같은 흐름 안에서 폭이 1440 → 430 으로 접혔다.
 *
 * 실측(1440px, 수정 전 라이브): `/region`·`/region/부산`·`/region/서울/중구` 셋 다
 * `framed: true` · 본문 430 · 거터 레일 1. 수정 후: `framed: false` · 본문 1440 · 레일 0.
 *
 * 여기서 고정하는 것 넷:
 *   ① 지역 세 라우트가 전부 풀너비 판정을 받는다(깊이 0·1·2).
 *   ② 액자에 남아야 하는 이웃 경로를 접두사가 삼키지 않는다.
 *   ③ 지역 페이지가 PC 전제 마크업을 실제로 갖고 있다 — 풀너비로 풀어도 폰 레이아웃이면 의미가 없다.
 *   ④ 등재 조건: 지역 표면에 `app-frame-bar` 가 없다(pc-fullbleed 가 하단 고정바를 숨기므로,
 *      그런 바를 쓰는 페이지를 등재하면 CTA 가 사라진다 — `/referral` 이 그 이유로 제외돼 있다).
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 실제 픽셀. jsdom 엔 레이아웃이 없어 "1440px 로 펼쳐졌는가"는
 *    브라우저 실측이 판정한다(위 수치가 그것). 여기서는 판정 함수와 마크업 전제만 잠근다.
 */

const read = (p: string) => readFileSync(p, 'utf8')
const visible = (p: string) => stripComments(read(p))

const REGION_PAGE = 'src/pages/region/RegionPage.tsx'
const REGION_INDEX = 'src/pages/region/RegionIndexPage.tsx'

describe('① 지역 라우트 세 깊이가 모두 PC 풀너비', () => {
  it.each([
    ['/region'],
    ['/region/부산'],
    ['/region/서울/중구'],
  ])('%s 는 풀너비다', (route) => {
    expect(isFullBleedPcPath(route)).toBe(true)
  })
})

describe('② 액자에 남아야 하는 이웃을 삼키지 않는다', () => {
  it.each([
    // 상권 리포트는 지역과 이름이 비슷하지만 다른 라우트다(`/area-report/:region`).
    ['/area-report/서울'],
    // 접두사를 `/regi` 처럼 줄이면 가입이 함께 풀린다.
    ['/register'],
    ['/referral'],
  ])('%s 는 풀너비가 아니다', (route) => {
    expect(isFullBleedPcPath(route)).toBe(false)
  })
})

describe('③ 지역 페이지가 PC 전제 마크업을 갖는다', () => {
  it('RegionPage 본문이 1600px 컨테이너 + PC 여백을 쓴다', () => {
    const s = visible(REGION_PAGE)
    expect(s).toContain('max-w-[1600px]')
    expect(s).toMatch(/px-4\s+lg:px-10/)
  })

  it('RegionPage 가 딜 그리드를 PC 모드로 넘긴다', () => {
    // `pc` prop 이 빠지면 풀너비에서 카드가 모바일 한 줄로 늘어진다.
    expect(visible(REGION_PAGE)).toMatch(/<GroupBuyFeed\b[\s\S]{0,120}?\bpc\b/)
  })

  it('RegionIndexPage 허브가 PC 에서 3열로 펼쳐진다', () => {
    expect(visible(REGION_INDEX)).toContain('lg:grid-cols-3')
  })
})

describe('④ 등재 조건 — 하단 고정바(app-frame-bar)가 없다', () => {
  it.each([
    [REGION_PAGE],
    [REGION_INDEX],
    ['src/components/region/RegionLinkGrid.tsx'],
    ['src/pages/main-home/GroupBuyFeed.tsx'],
    ['src/components/main/SiteFooter.tsx'],
  ])('%s 에 app-frame-bar 가 없다', (file) => {
    expect(visible(file)).not.toContain('app-frame-bar')
  })
})

describe('⑤ 배선 — SSOT 한 곳에서만 판정한다', () => {
  it('pc-fullbleed 목록에 지역이 등재돼 있다', () => {
    const s = visible('src/shared/pc-fullbleed.ts')
    expect(s).toMatch(/'\/region'/)
    expect(s).toMatch(/FULLBLEED_PC_PREFIXES[\s\S]{0,200}?'\/region\/'/)
  })

  it('지역 페이지가 액자 여부를 스스로 판정하지 않는다', () => {
    // 페이지가 자기 자리에서 `app-framed`/`pc-fullbleed` 를 직접 건드리기 시작하면
    // 판정이 두 곳으로 갈려 다음 세션이 어느 쪽이 진실인지 모르게 된다.
    for (const f of [REGION_PAGE, REGION_INDEX]) {
      expect(visible(f)).not.toContain('app-framed')
      expect(visible(f)).not.toContain('pc-fullbleed')
    }
  })
})
