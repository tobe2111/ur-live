/**
 * 🧺 2026-10-25 — IndexNow **일회성 전수 제출**(대표 *"코드로 할 수 있는 거 최대한 다 해줘"*).
 *
 * 근거는 `src/shared/seo/indexnow.ts` 의 backfill 머리말. 요약: 변경분만 보내는 설계라 **안 바뀐 페이지는
 * 영원히 한 번도 제출되지 않았다**(실측 476건 중 커서 2026-10-20 이전 전부 + lastmod 없는 90건). 새 도메인이라
 * 빙·네이버가 대부분을 모르고, ChatGPT 검색은 빙 색인을 크게 쓴다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 받는 쪽이 실제로 크롤하는지(200 은 *접수*일 뿐) · 라이브 sitemap 내용 ·
 *    D1 쓰기 실패(표식이 안 서면 다음 날 한 번 더 전수가 간다 — 그쪽이 안전하다).
 */
import { describe, it, expect } from 'vitest'
import {
  INDEXNOW_BACKFILL_KEY, INDEXNOW_BACKFILL_VERSION, INDEXNOW_SPEC_MAX,
  needsIndexNowBackfill, parseSitemapLocs,
} from '@/shared/seo/indexnow'
import { readCode } from '../helpers/source-text'

const XML = '<urlset>'
  + '<url><loc>https://urdeal.kr/</loc></url>'
  + '<url><loc>https://urdeal.kr/pass/1</loc><lastmod>2026-10-01</lastmod></url>'
  + '<url><loc> https://urdeal.kr/region/서울 </loc></url>'
  + '<url><loc>https://urdeal.kr/pass/1</loc><lastmod>2026-10-02</lastmod></url>'
  + '</urlset>'

describe('🧺 IndexNow 전수 제출', () => {
  it('① lastmod 가 없는 URL 도 담는다 (전수의 요점) · 중복 제거 · 순서 보존 · 공백 정리', () => {
    expect(parseSitemapLocs(XML)).toEqual([
      'https://urdeal.kr/', 'https://urdeal.kr/pass/1', 'https://urdeal.kr/region/서울',
    ])
    expect(parseSitemapLocs('')).toEqual([])
    expect(parseSitemapLocs(null)).toEqual([])
  })

  it('② 표식이 현재 버전이면 다시 보내지 않는다 · 비었거나 옛 버전이면 보낸다', () => {
    expect(needsIndexNowBackfill(INDEXNOW_BACKFILL_VERSION)).toBe(false)
    expect(needsIndexNowBackfill(` ${INDEXNOW_BACKFILL_VERSION} `)).toBe(false)
    expect(needsIndexNowBackfill('')).toBe(true)
    expect(needsIndexNowBackfill(null)).toBe(true)
    expect(needsIndexNowBackfill('0')).toBe(true)
  })

  it('③ 상수 — 규격 상한 10,000 · 커서와 다른 키', () => {
    expect(INDEXNOW_SPEC_MAX).toBe(10000)
    expect(INDEXNOW_BACKFILL_KEY).toBe('indexnow_backfill_v')
    expect(INDEXNOW_BACKFILL_KEY).not.toBe('indexnow_cursor')
  })

  it('④ 배선 — 게이트 뒤 · sitemap 의 loc 를 쓴다 · 실패하면 표식을 안 세운다 · 0건이면 안 세운다', () => {
    const c = readCode('src/worker/cron/indexnow-submit.ts')
    const gate = c.indexOf("INDEXNOW_ENABLED !== 'true'")
    const back = c.indexOf('needsIndexNowBackfill(mark?.value)')
    expect(gate).toBeGreaterThan(0)
    expect(back).toBeGreaterThan(gate) // 게이트보다 앞에서 바깥으로 쏘면 안 된다
    const block = c.slice(back, c.indexOf('async function submitChanges', back))
    expect(block).toContain('parseSitemapLocs(xml)')
    expect(block).toContain('.slice(0, INDEXNOW_SPEC_MAX)')
    // 순서: 0건 검사 → 제출 → 실패면 반환 → 그 다음에만 표식
    const empty = block.indexOf('if (!locs.length)')
    const submit = block.indexOf('submitUrls(key, locs)')
    const fail = block.indexOf('if (!ok.ok)')
    const mark = block.indexOf('upsertSetting(DB, INDEXNOW_BACKFILL_KEY')
    expect(empty).toBeGreaterThan(-1)
    expect(submit).toBeGreaterThan(empty)
    expect(fail).toBeGreaterThan(submit)
    expect(mark).toBeGreaterThan(fail)
  })

  it('⑥ 🩸 전수가 실패해도 변경분은 그대로 보낸다 (2026-10-26 — 첫 회차 429)', () => {
    // 종전엔 전수 실패에서 바로 반환해, 전수가 거절되는 동안 변경분 제출까지 통째로 멎었다(에러 0).
    const c = readCode('src/worker/cron/indexnow-submit.ts')
    const back = c.indexOf('needsIndexNowBackfill(mark?.value)')
    const block = c.slice(back, c.indexOf('upsertSetting(DB, INDEXNOW_BACKFILL_KEY', back))
    // 0건 분기와 실패 분기 둘 다 반환 전에 변경분을 보낸다
    expect((block.match(/submitChanges\(DB, key, entries\)/g) || []).length).toBe(2)
    // 정상 경로도 같은 함수 — 변경분 규칙이 두 벌이 되지 않는다
    const tail = c.slice(c.indexOf('upsertSetting(DB, INDEXNOW_BACKFILL_KEY'))
    expect(tail).toMatch(/return `indexnow: \$\{await submitChanges\(DB, key, entries\)\}`/)
    expect((c.match(/planIndexNow\(/g) || []).length).toBe(1)
  })

  it('⑤ 선택 술어를 다시 적지 않는다 (상품·블로그를 직접 쿼리하지 않는다)', () => {
    const c = readCode('src/worker/cron/indexnow-submit.ts')
    expect(c).not.toMatch(/FROM products|FROM blog_posts/)
  })
})
