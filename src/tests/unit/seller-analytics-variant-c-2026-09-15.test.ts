/**
 * 📊 셀러 매출 분석 — 안 C (2026-09-15 대표 확정 *"안 C로 가자"*).
 *
 * 시안 갤러리에서 세 안을 나란히 놓고 고른 결과를 실제 페이지에 옮긴 것이다. 이 테스트가 지키는 것은
 * **그 선택의 요지** 셋이고, 전부 "되돌리면 원래 문제로 돌아간다" 는 형태다:
 *
 *   ① 잴 것이 없으면 재는 도구를 안 그린다 — 0 다섯 개 + 컨트롤 12개가 대표가 실제로 본 화면이었다.
 *   ② "한 번도 안 팖" 과 "이 기간에만 없음" 을 구분한다 — 섞으면 60일 전에 판 사람에게 거짓말이 된다.
 *   ③ 기능이 안 줄었다 — 탭 6개가 전부 남아 있어야 한다(구조만 바꾼 것이지 삭제가 아니다).
 *
 * ⚠️ 이 테스트가 못 막는 것: 안 C 가 **좋은 선택인지**. 그건 라이브에서 대표가 판정할 일이다.
 *    그리고 렌더 결과(간격·줄바꿈)도 못 본다 — `scripts/visual-preview.mjs` 가 그 몫이다.
 *
 * 주입 매니페스트: scripts/mutations/seller-analytics-variant-c.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const PAGE = read('src/pages/SellerAnalyticsPage.tsx')
const OVERVIEW = read('src/pages/seller-analytics/AnalyticsOverview.tsx')
const EMPTY = read('src/pages/seller-analytics/NoSalesYet.tsx')
const KO = JSON.parse(readFileSync('public/locales/ko/translation.json', 'utf8'))

describe('① 잴 것이 없으면 재는 도구를 안 그린다', () => {
  it('전 기간 판매 0 이면 빈 화면을 그린다 (요약/차트가 아니라)', () => {
    expect(PAGE).toMatch(/!everSold \? <NoSalesEver \/>/)
  })
  it('빈 화면에는 지금 할 수 있는 일이 하나 있다 (이용권 등록)', () => {
    expect(EMPTY).toMatch(/to="\/seller\/meal-voucher\/new"/)
  })
  it('기간 안에 판매가 없으면 큰 0 과 빈 차트를 안 그린다', () => {
    expect(OVERVIEW).toMatch(/const windowEmpty = p\.revenue === 0 && p\.orders === 0/)
    expect(OVERVIEW).toMatch(/windowEmpty \? \(\s*<NoSalesInWindow/)
  })
  it('그래도 기간 선택은 남는다 — 안 그러면 다른 기간으로 갈 길이 없다', () => {
    // 🩸 이 검사는 두 번 고쳤다.
    //   ① 첫 판은 삼항을 끼워 넣어 두 쪽 다 -1 이어도 통과할 수 있었다 → 존재부터 못 박는다.
    //   ② 그 다음 판은 **순서만** 봤는데, 주입이 곧바로 구멍을 보여 줬다: 세그먼트를 그 자리에 두고
    //      `hidden={windowEmpty}` 만 붙이면 화면에서는 사라지는데 순서 검사는 초록이었다.
    //      ⇒ 세그먼트가 windowEmpty 에 **의존하지 않는지**까지 본다.
    const segAt = OVERVIEW.indexOf('role="group"')
    const emptyAt = OVERVIEW.indexOf('{windowEmpty ? (')
    expect(segAt).toBeGreaterThan(-1)
    expect(emptyAt).toBeGreaterThan(segAt)
    expect(OVERVIEW).toContain('onClick={() => p.onDays(d)}')
    expect(OVERVIEW.slice(segAt, emptyAt)).not.toContain('windowEmpty')
  })
})

describe('② 두 가지 "없음" 을 구분한다', () => {
  it('"한 번도 안 팖" 판정은 전 기간 집계(total_buyers)로 한다', () => {
    // 기간 합계로 판정하면 60일 전에 판 사람에게 "아직 판매가 없어요" 라고 말하게 된다.
    expect(PAGE).toMatch(/const everSold = !!detailedData && detailedData\.total_buyers > 0/)
  })
  it('기간 전용 문구가 따로 있다 (온보딩 문구 재사용 금지)', () => {
    expect(EMPTY).toMatch(/windowEmptyTitle/)
    expect(EMPTY).toMatch(/noSalesTitle/)
    expect(KO.seller.analyticsView.windowEmptyTitle).toContain('{{days}}')
  })
})

describe('③ 기능이 안 줄었다 — 탭 6개 전부 살아 있다', () => {
  it('안쪽 화면 다섯이 목록의 줄로 남아 있다', () => {
    for (const v of ['customers', 'products', 'commission', 'monthly', 'funnel']) {
      expect(OVERVIEW, v).toContain(`key: '${v}'`)
    }
  })
  it('안쪽 화면에서 요약으로 돌아오는 길이 있다 (탭 버튼 줄이 사라졌으므로)', () => {
    expect(PAGE).toMatch(/tab !== 'revenue' && \(/)
    expect(PAGE).toMatch(/onClick=\{\(\) => setTab\('revenue'\)\}/)
  })
  it('페이지가 다섯 화면을 여전히 렌더한다', () => {
    for (const v of ['customers', 'products', 'commission', 'monthly', 'funnel']) {
      expect(PAGE, v).toContain(`tab === '${v}'`)
    }
  })
})

describe('④ 질문은 하나만 — 기간', () => {
  it('내용 앞에 서던 탭 버튼 여섯 줄이 없어졌다', () => {
    // 종전엔 [탭 6] → [기간 3] 을 먼저 묻고 그 답이 전부 0 으로 갔다.
    expect(PAGE).not.toMatch(/seller\.revenueChart/)
    expect(PAGE).not.toMatch(/추천 Commission/)
  })
  it('기간은 7·30·90 세 개 그대로다', () => {
    expect(OVERVIEW).toMatch(/\[7, 30, 90\]\.map/)
  })
})

describe('⑤ 문구가 여섯 언어에 다 있다', () => {
  it('6개 로케일 전부 seller.analytics 를 갖는다', () => {
    for (const lang of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const j = JSON.parse(readFileSync(`public/locales/${lang}/translation.json`, 'utf8'))
      expect(j.seller?.analyticsView?.noSalesTitle, lang).toBeTruthy()
      expect(j.seller?.analyticsView?.windowEmptyTitle, lang).toBeTruthy()
    }
  })
})
