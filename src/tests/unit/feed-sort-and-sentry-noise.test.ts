/**
 * 🚦 홈 피드 서버 정렬 · 🔇 Sentry 노이즈 필터 계약 (2026-09-03 — 대표 "마저 다 해줘")
 *
 * ■ 못으로 박는 것
 *   ① 홈 피드의 "인기순"이 다시 **로드된 것 안에서만** 돌지 않게 — 서버에 정렬을 넘기는 배선.
 *   ② 그 정렬의 **정의가 화면과 같게** — 서버 ORDER BY 가 클라 soldOf/discountOf 를 미러.
 *   ③ Sentry 가 자기 web-vitals 리포터의 TypeError 를 다시 올려 **쿼터를 태우는 고리**를 끊은 것.
 *      그리고 그 필터가 **우리 코드의 진짜 버그까지 삼키지 않는다**는 것(이게 제일 중요하다).
 *
 * ■ 못 잡는 것: 실제 네트워크 요청 순서 · SQLite 실행 결과(별도 검증) · Sentry SDK 내부 동작.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isNoiseEvent, eventText, type SentryLikeEvent } from '@/lib/sentry-noise'
import { queryKeys } from '@/hooks/queries/queryKeys'

const R = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')
const feed = R('pages/main-home/GroupBuyFeed.tsx')
const route = R('features/group-buy/api/group-buy-public.routes.ts')

describe('홈 피드 — 정렬을 서버로', () => {
  it('page1 과 다음 페이지가 **같은** 정렬 파라미터로 나간다', () => {
    const calls = feed.match(/api\.get\(`\/api\/group-buy\/products\?[^`]+`\)/g) ?? []
    expect(calls.length, '피드 목록 요청이 2곳(page1·loadMore)이어야 한다').toBe(2)
    for (const c of calls) expect(c, `정렬 파라미터 누락: ${c}`).toContain('${feedParams}')
  })

  it('거리순은 sort 가 아니라 near 로 나간다', () => {
    expect(feed).toMatch(/const serverSort = sort === 'near' \? '' : sort/)
    expect(feed).toMatch(/&near=\$\{nearKey\}/)
  })

  it('정렬이 바뀌면 캐시키가 갈리고, 누적 페이지는 버린다', () => {
    expect(feed).toMatch(/queryKeys\.groupBuyList\('active', category, serverSort/)
    expect(feed).toMatch(/setExtraPages\(\[\]\); setReachedEnd\(false\) \}, \[category, serverSort, nearKey\]\)/)
  })

  it('정렬 전환이 빈 화면이 되지 않는다(직전 결과 유지)', () => {
    expect(feed).toMatch(/placeholderData: \(prev\) => prev/)
  })

  it('queryKeys.groupBuyList — 정렬을 주면 키가 갈리고, 안 주면 종전 키 그대로', () => {
    expect(queryKeys.groupBuyList('active', 'all')).toEqual(['group-buy', 'list', 'active', 'all'])
    expect(queryKeys.groupBuyList('active', 'all', 'discount')).toEqual(['group-buy', 'list', 'active', 'all', 'discount'])
  })

  it('서버 정렬 정의가 화면 정의를 미러한다 — 어긋나면 "전체 중 인기순"이 다시 거짓이 된다', () => {
    const wl = route.slice(route.indexOf('ALLOWED_GB_SORT'), route.indexOf('const sortParam'))
    // 인기 = sold_count 우선(클라 soldOf 와 같은 순서). group_buy_current 만 보면 sparse 라 최신순처럼 보인다.
    expect(wl).toMatch(/popular:[^\n]*sold_count[^\n]*group_buy_current/)
    // 할인 = discount_rate 가 비었으면 정가·판매가로 계산(클라 discountOf 폴백과 같은 규칙).
    expect(wl).toMatch(/discount:[^\n]*discount_rate[^\n]*original_price[^\n]*price/)
    for (const k of ['popular', 'newest', 'deadline', 'discount']) {
      expect(wl, `홈 정렬 ${k} 가 서버 화이트리스트에 없다`).toMatch(new RegExp(`\\n\\s+${k}:`))
    }
  })
})

describe('Sentry 노이즈 필터 (실제로 돌린다)', () => {
  const vitalsFrames = { values: [{ type: 'TypeError', value: "Cannot read properties of undefined (reading 'startTime')", stacktrace: { frames: [{ function: 'et.reportAllChanges' }] } }] }

  it('Sentry 자신의 web-vitals TypeError 는 버린다 (429 를 부르는 자기증식 고리)', () => {
    expect(isNoiseEvent({ exception: vitalsFrames } as SentryLikeEvent)).toBe(true)
  })

  it('frames 가 비어도 raw 스택으로 잡는다 (압축 번들)', () => {
    const ev = { exception: { values: [{ type: 'TypeError', value: "Cannot read properties of undefined (reading 'startTime')" }] } } as SentryLikeEvent
    expect(isNoiseEvent(ev, { stack: 'TypeError: …\n    at et.reportAllChanges (<anonymous>:2:19429)' })).toBe(true)
  })

  it('⚠️ 같은 메시지라도 **우리 코드**에서 나면 올린다 — 진짜 버그를 삼키면 안 된다', () => {
    const ours = { exception: { values: [{ type: 'TypeError', value: "Cannot read properties of undefined (reading 'startTime')", stacktrace: { frames: [{ function: 'GroupBuyDetailPage' }] } }] } } as SentryLikeEvent
    expect(isNoiseEvent(ours, { stack: 'at GroupBuyDetailPage (index-abc.js:1:2)' })).toBe(false)
  })

  it('옛 의도(localStorage·NetworkError)가 이제 예외에도 걸린다 — 그전엔 message 만 봐서 헛돌았다', () => {
    expect(isNoiseEvent({ exception: { values: [{ type: 'Error', value: 'localStorage is not available' }] } } as SentryLikeEvent)).toBe(true)
    expect(isNoiseEvent({ exception: { values: [{ type: 'TypeError', value: 'NetworkError when attempting to fetch' }] } } as SentryLikeEvent)).toBe(true)
    expect(eventText({ exception: { values: [{ type: 'Error', value: 'boom' }] } } as SentryLikeEvent)).toBe('Error: boom')
  })

  it('평범한 에러는 그대로 올린다', () => {
    expect(isNoiseEvent({ exception: { values: [{ type: 'TypeError', value: "Cannot read properties of null (reading 'id')" }] } } as SentryLikeEvent)).toBe(false)
  })

  it('개발 환경 이벤트는 버린다(종전 동작 보존)', () => {
    expect(isNoiseEvent({ environment: 'development' } as SentryLikeEvent)).toBe(true)
  })

  it('beforeSend 가 그 SSOT 를 부른다 — 인라인으로 되돌아가면 테스트가 못 본다', () => {
    expect(R('lib/sentry.ts')).toMatch(/beforeSend\(event, hint\) \{\s*\n\s*return isNoiseEvent\(/)
  })
})
