/**
 * 🌱 검색 결과 시드 (2026-11-10 — 라이브 폰 `/search?q=돈가스` LCP 3.7s: 결과가 앱 부팅 뒤 한 왕복 더 기다렸다).
 *
 * 지키는 것:
 *   ① 시드 경로 = 훅의 첫 장 요청과 **글자 하나 다르지 않다**(q · page=1 · limit=50 · scope 순서) · 2자 미만이면 없다
 *   ② 워커: `/search` 에 SEARCH 슬롯 · 그 슬롯만 마감(700ms) · `<script>` 에 검색어·범위 표식
 *   ③ 읽기: 같은 검색어·범위일 때만 돌려주고 **한 번 읽고 지운다** · 다르면 null(그리고 지운다 — 다른 검색어에 재사용 금지)
 *   ④ 훅이 시드를 `initialData` 로 쓴다(캐시가 비었을 때만 — React Query 의 규칙)
 * ⚠️ 못 보는 것: 실제 D1 응답 시간(마감 700ms 가 적정한지는 배포 뒤 `X-SSR-Status: SEARCH:*` 분포로 본다).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { SEARCH_PAGE_SIZE, SEARCH_SEED_ID, SEARCH_SEED_DEADLINE_MS, searchSeedPath, searchScopeOf, searchSeedAttrs, readSearchSeed } from '@/shared/search-page'

const HOOK = stripComments(readFileSync('src/hooks/useSearch.ts', 'utf8'))
const W = readFileSync('src/worker/index.ts', 'utf8') // ⚠️ stripComments 금지(source-text 머리말)

describe('① 시드 경로 = 훅 요청', () => {
  it('q · page · limit · scope 순서 · 인코딩 · 기본 범위 voucher', () => {
    expect(searchSeedPath('?q=%EB%8F%88%EA%B0%80%EC%8A%A4')).toBe(`/api/search?q=%EB%8F%88%EA%B0%80%EC%8A%A4&page=1&limit=${SEARCH_PAGE_SIZE}&scope=voucher`)
    expect(searchSeedPath('?q=a&scope=exchange')).toBe('')
    expect(searchSeedPath('?q=ab&scope=exchange')).toBe(`/api/search?q=ab&page=1&limit=${SEARCH_PAGE_SIZE}&scope=exchange`)
    expect(searchSeedPath('?scope=exchange')).toBe(''); expect(searchSeedPath('')).toBe('')
    expect(searchScopeOf('?scope=exchange')).toBe('exchange'); expect(searchScopeOf('?scope=x')).toBe('voucher')
    expect(SEARCH_PAGE_SIZE).toBe(50)
  })
  it('훅이 같은 상수·같은 순서로 요청하고 시드를 initialData 로 쓴다', () => {
    expect(HOOK).toContain("import { SEARCH_PAGE_SIZE, readSearchSeed } from '@/shared/search-page'")
    expect(HOOK).toContain("new URLSearchParams({ q: query, page: String(pageParam), limit: String(SEARCH_PAGE_SIZE), scope })")
    expect(HOOK).toContain('readSearchSeed<SearchApiBody>(query, scope)')
    expect(HOOK).toContain('initialData: seed ? { pages: [toSearchResult(seed)], pageParams: [1] } : undefined')
    expect(HOOK).toContain('initialDataUpdatedAt: seed ? Date.now() : undefined')
  })
})

describe('② 워커', () => {
  it('SEARCH 슬롯 · 마감 · 표식', () => {
    expect(W).toContain("} else if (url.pathname === '/search' && searchSeedPath(url.search)) { ssrTarget = { slot: 'SEARCH', path: searchSeedPath(url.search) };")
    expect(W).toContain("ssrTarget.slot === 'SEARCH' ? withSeedDeadline(seedP, SEARCH_SEED_DEADLINE_MS)"); expect(W).toContain('const seedP = fetchSsrPayload(ssrTarget, origin0, c.env, ssrWaitUntil(c));')
    expect(W).toContain("${ssrSlot === 'SEARCH' ? searchSeedAttrs(url.search) : ''}")
    expect(SEARCH_SEED_DEADLINE_MS).toBeLessThanOrEqual(1000)
    expect(searchSeedAttrs('?q=%EB%8F%88%22%3C&scope=exchange')).toBe(' data-q="돈&quot;&lt;" data-scope="exchange"')
  })
})

describe('③ 읽기', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  const plant = (q: string, scope: string, body = '{"success":true,"data":[{"id":1}],"pagination":{"total":1,"page":1,"limit":50}}') => {
    const el = document.createElement('script'); el.id = SEARCH_SEED_ID; el.type = 'application/json'; el.setAttribute('data-q', q); el.setAttribute('data-scope', scope); el.textContent = body; document.body.appendChild(el)
  }
  it('같은 검색어·범위 → 본문, 읽은 뒤 사라진다', () => {
    plant('돈가스', 'voucher')
    const r = readSearchSeed<{ data: unknown[] }>('돈가스', 'voucher')
    expect(r?.data.length).toBe(1); expect(document.getElementById(SEARCH_SEED_ID)).toBeNull()
    expect(readSearchSeed('돈가스', 'voucher')).toBeNull()
  })
  it('다른 검색어나 범위 → null, 그래도 지운다', () => {
    plant('돈가스', 'voucher'); expect(readSearchSeed('돈까스', 'voucher')).toBeNull(); expect(document.getElementById(SEARCH_SEED_ID)).toBeNull()
    plant('돈가스', 'voucher'); expect(readSearchSeed('돈가스', 'exchange')).toBeNull()
  })
  it('깨진 JSON · data 가 배열이 아님 → null', () => {
    plant('a', 'voucher', '{bad'); expect(readSearchSeed('a', 'voucher')).toBeNull()
    plant('a', 'voucher', '{"success":false}'); expect(readSearchSeed('a', 'voucher')).toBeNull()
  })
})
