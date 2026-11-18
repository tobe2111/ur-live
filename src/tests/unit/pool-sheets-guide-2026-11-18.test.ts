/**
 * 📌 시트 '안내' 탭 (2026-11-18 대표 *"어떤 식으로 시트를 만지면 되는지 안내 사항을 시트들에 넣어줄 수 있어?
 *    나는 이메일을 보낸 업체들의 행들을 가리려고 하는데."*).
 *
 * 지키는 것
 *   ① 안내 문구가 코드의 사실과 맞다 — 저장되는 열 이름 · 발송기록 탭 이름 · 가리기 방법(필터 보기 · '비어 있음') · 행 숨기기 금지
 *   ② 버전이 같으면 시트에 손대지 않는다(설정 1줄 읽기) · 처음엔 탭을 맨 앞에 만들고 쓴 뒤 버전을 남긴다 · 쓰기 실패면 버전을 안 남긴다
 *   ③ 세 시트(인플루언서 · 파트너 · 매장) 동기화가 모두 부른다
 * ⚠️ 못 보는 것: 구글 시트에서 실제로 보이는 모양(배포 후 시트를 열어 확인).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { guideLines, syncGuideTab, GUIDE_TAB, GUIDE_VERSION, guideKey } from '@/features/marketing/api/pool-sheets-guide'
import { SHEET_HEADER } from '@/features/marketing/api/sheets-sync'
import { POOL_DEFS } from '@/features/marketing/api/pool-sheets-sync'
import { LIST_TAB } from '@/features/marketing/api/pool-sheets-marks'

describe('① 안내 문구가 코드의 사실과 맞다', () => {
  for (const kind of ['influencer', 'company', 'store'] as const) {
    it(`${kind}: 저장 열 · 발송기록 탭 · 가리는 방법 · 금지 사항`, () => {
      const text = guideLines(kind).join('\n')
      const lastCol = kind === 'influencer' ? SHEET_HEADER[SHEET_HEADER.length - 1] : POOL_DEFS[kind].header[POOL_DEFS[kind].header.length - 1]
      expect(lastCol).toBe('이메일 보냄')
      expect(text).toContain(`"${lastCol}"`)
      expect(text).toContain(`"${LIST_TAB}" 탭`)
      expect(text).toMatch(/필터 보기/)
      expect(text).toMatch(/\[비어 있음\]/)
      expect(text).toMatch(/행 숨기기/)
      expect(guideLines(kind).length).toBeLessThanOrEqual(80) // 시트에 80줄을 채워 쓴다
    })
  }
})

describe('② 버전이 같으면 시트에 손대지 않는다', () => {
  afterEach(() => vi.unstubAllGlobals())
  const fakeDb = (store: Map<string, string>) => ({
    prepare: (sql: string) => ({
      bind: (...a: unknown[]) => ({
        first: async <T,>() => (sql.startsWith('SELECT') && store.has(String(a[0])) ? ({ value: store.get(String(a[0])) } as T) : null),
        run: async () => { if (sql.startsWith('INSERT')) store.set(String(a[0]), String(a[1])); return {} },
      }),
    }),
  })
  it('처음: 탭을 맨 앞에 만들고 쓴 뒤 버전을 남긴다 · 다음: 아무것도 안 한다', async () => {
    const calls: Array<{ url: string; body?: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string })
      if (url.includes('fields=sheets.properties(title)')) return new Response(JSON.stringify({ sheets: [{ properties: { title: 'pool' } }] }))
      return new Response('{}')
    }))
    const store = new Map<string, string>()
    const cost = { subreq: 0 }
    expect(await syncGuideTab(fakeDb(store), 'tok', 'SHEET1', 'company', cost)).toBe(true)
    const add = calls.find(c => c.url.endsWith(':batchUpdate'))
    expect(JSON.parse(add!.body!).requests[0].addSheet.properties).toMatchObject({ title: GUIDE_TAB, index: 0 })
    const put = calls.find(c => c.url.includes(encodeURIComponent(`${GUIDE_TAB}!A1:A80`)))
    expect(JSON.parse(put!.body!).values[0][0]).toMatch(/이 시트 사용법/)
    expect(store.get(guideKey('SHEET1'))).toBe(String(GUIDE_VERSION))
    const before = calls.length
    expect(await syncGuideTab(fakeDb(store), 'tok', 'SHEET1', 'company', cost)).toBe(false)
    expect(calls.length).toBe(before)
  })
  it('탭이 이미 있으면 만들지 않고 다시 쓰기만 · 쓰기가 실패하면 버전을 안 남긴다(다음 회차가 다시)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('fields=sheets.properties(title)')) return new Response(JSON.stringify({ sheets: [{ properties: { title: GUIDE_TAB } }] }))
      if (url.endsWith(':batchUpdate')) throw new Error('should not add')
      return new Response('nope', { status: 500 })
    }))
    const store = new Map<string, string>()
    expect(await syncGuideTab(fakeDb(store), 'tok', 'S2', 'store', { subreq: 0 })).toBe(false)
    expect(store.has(guideKey('S2'))).toBe(false)
  })
})

describe('③ 세 시트 모두 부른다', () => {
  it('인플루언서 시트 · 파트너/매장 시트 동기화', () => {
    expect(readFileSync('src/features/marketing/api/sheets-sync.ts', 'utf8')).toMatch(/await syncGuideTab\(DB, token, sheetId, 'influencer', cost\)/)
    expect(readFileSync('src/features/marketing/api/pool-sheets-sync.ts', 'utf8')).toMatch(/await syncGuideTab\(DB, token, sheetId, pool, cost\)/)
  })
})
