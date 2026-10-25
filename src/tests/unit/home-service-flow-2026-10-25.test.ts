/**
 * 🏠 생활 견적 — 오늘의집 흐름 + 사장님 항목 (2026-10-25 대표 "모두 진행해줘").
 * 설계: `docs/design/life-quote-flow-ohouse-ref.md`.
 *
 * 지키는 것:
 *  - 🔒 상세 주소(도로명·동·호수)는 사장님이 **고르기 전엔 안 보인다** — 요청서엔 동까지만, 상세는 따로.
 *  - 로그인은 맨 끝으로 옮겼을 뿐 빠지지 않았다 — 접수 API 는 여전히 로그인(카카오 번호 = 본인 확인).
 *  - 사장님 항목(방역·후드·수리·숙소)이 같은 검증·요약을 거친다.
 *  - 손 없는 날 계산이 음력 9·10·19·20·29·30 과 맞는다.
 *
 * ⚠️ 못 보는 것: 다음 우편번호 화면(외부 스크립트) · 카카오 로그인 왕복 뒤 답이 실제로 남는지(브라우저) ·
 *   시트를 연달아 여는 느낌(그려서 봐야 한다).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readCode } from '../helpers/source-text'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  HOME_SERVICE_CATEGORIES, PRIVATE_ADDRESS_SUFFIX, categoryDef, isSonEomneunDay, requestSummary, validateRequest,
} from '@/shared/home-service'
import { parseRegionFromAddress } from '@/shared/constants/region-slugs'
import { withPrivateDetails } from '@/features/home-service/api/home-service-db'
import { clearDraft, loadDraft, saveDraft } from '@/pages/life/request/draft'

const parse = (s: string) => { const r = parseRegionFromAddress(s); return r ? { sido: r.sido, sigungu: r.sigungu } : null }
const TODAY = '2026-10-25'

/** 각 카테고리에 맞는 정상 입력을 정의에서 만든다(손으로 적으면 정의가 바뀔 때 시험만 낡는다). */
function sampleFor(key: string): Record<string, string> {
  const def = categoryDef(key)!
  const out: Record<string, string> = {}
  for (const f of def.fields) {
    if (!f.required) continue
    if (f.type === 'region') out[f.key] = '부산 금정구 청룡동'
    else if (f.type === 'date') out[f.key] = '2099-01-01'
    else if (f.type === 'number') out[f.key] = '12'
    else if (f.type === 'select') out[f.key] = f.options![0]
    else out[f.key] = '메모'
  }
  return out
}

describe('🏪 사장님 항목 — 같은 검증·요약', () => {
  it('사장님 항목이 먼저, 집이 나중', () => {
    const order = HOME_SERVICE_CATEGORIES.map((d) => d.audience)
    expect(order.indexOf('home')).toBeGreaterThan(order.lastIndexOf('biz'))
    // 🔁 2026-10-25 재조준: 목록을 통째로 박아 두면 카테고리를 더할 때마다 낡는다(대표 "위 업종들도
    //   받아야 해" 로 6종이 늘었다). 지키려던 것은 **선두 순서 보존**(화면 카드 순서 = 이 배열 순서)과
    //   **biz 가 home 보다 앞**(바로 위 줄)이다. 그 둘만 고정하고 뒤에 붙는 것은 열어 둔다.
    const bizKeys = HOME_SERVICE_CATEGORIES.filter((d) => d.audience === 'biz').map((d) => d.key)
    expect(bizKeys.slice(0, 4), '선두 4종의 순서가 바뀌었다 — 생활 페이지 카드 순서가 함께 바뀐다')
      .toEqual(['store_pest', 'kitchen_hood', 'store_repair', 'lodging_clean'])
    expect(bizKeys.length, 'biz 카테고리가 줄었다 — 사장님 항목이 사라지면 그 업종 요청을 못 받는다')
      .toBeGreaterThanOrEqual(10)
  })
  for (const def of HOME_SERVICE_CATEGORIES) {
    it(`${def.label} — 정상 입력이 통과하고 요약에 빈칸(-)이 없다`, () => {
      const v = validateRequest(def.key, sampleFor(def.key), parse, TODAY)
      expect(v.ok).toBe(true)
      if (!v.ok) return
      expect(v.value.regions.length).toBeGreaterThan(0)
      expect(requestSummary(def.key, v.value.details)).not.toMatch(/(^|\s)-(\s|$)/)
    })
  }
  it('함께 신청(crossSell)이 옮기는 칸은 양쪽에 실제로 있다', () => {
    for (const def of HOME_SERVICE_CATEGORIES) {
      if (!def.crossSell) continue
      const to = categoryDef(def.crossSell.to)!
      for (const [toKey, fromKey] of Object.entries(def.crossSell.carry)) {
        expect(to.fields.some((f) => f.key === toKey), `${to.key}.${toKey}`).toBe(true)
        expect(def.fields.some((f) => f.key === fromKey), `${def.key}.${fromKey}`).toBe(true)
      }
    }
  })
  it('선택지 설명은 실제 선택지에만 붙는다', () => {
    for (const def of HOME_SERVICE_CATEGORIES) for (const f of def.fields) {
      for (const k of Object.keys(f.optionHints ?? {})) expect(f.options, `${def.key}.${f.key}`).toContain(k)
    }
  })
})

describe('🔒 상세 주소 — 고르기 전엔 동까지만', () => {
  const base = sampleFor('move')
  it('상세 주소는 privateDetails 로만 가고 요청서엔 동까지만 남는다', () => {
    const v = validateRequest('move', { ...base, from: '부산 금정구 청룡동', ['from' + PRIVATE_ADDRESS_SUFFIX]: '부산 금정구 놀이마당로 26, 1402호' }, parse, TODAY)
    expect(v.ok).toBe(true)
    if (!v.ok) return
    expect(v.value.details.from).toBe('부산 금정구 청룡동')
    expect(JSON.stringify(v.value.details)).not.toContain('1402')
    expect(v.value.privateDetails.from).toContain('1402')
  })
  it('너무 긴 상세 주소는 거절', () => {
    expect(validateRequest('move', { ...base, ['from' + PRIVATE_ADDRESS_SUFFIX]: 'x'.repeat(121) }, parse, TODAY).ok).toBe(false)
  })
  it('사장님 상세 조회는 고른 견적(chosen)일 때만 상세 주소를 읽는다', () => {
    const src = readCode('src/features/home-service/api/home-service-pro.routes.ts')
    expect(src).toMatch(/CASE WHEN q\.status = 'chosen' THEN r\.private_details END AS private_details/)
    expect(src).not.toMatch(/SELECT[^`]*\br\.private_details\b(?!\s*END)/)
  })
  it('덮어쓰기는 요청서에 있는 칸만 — 엉뚱한 키·깨진 값은 무시', () => {
    expect(withPrivateDetails({ from: '서울 강남구 역삼동' }, '{"from":"역삼로 1, 101호","evil":"x"}')).toEqual({ from: '역삼로 1, 101호' })
    expect(withPrivateDetails({ from: 'a' }, 'not json')).toEqual({ from: 'a' })
    expect(withPrivateDetails({ from: 'a' }, null)).toEqual({ from: 'a' })
  })
})

describe('🧺 여러 개 고르기(옮길 큰 짐)', () => {
  const base = sampleFor('move')
  it('있는 것만, 중복 없이', () => {
    const v = validateRequest('move', { ...base, items: '냉장고, 세탁기, 냉장고' }, parse, TODAY)
    expect(v.ok && v.value.details.items).toBe('냉장고, 세탁기')
  })
  it('없는 선택지는 거절 · 비워 두면 통과', () => {
    expect(validateRequest('move', { ...base, items: '냉장고, 우주선' }, parse, TODAY).ok).toBe(false)
    expect(validateRequest('move', base, parse, TODAY).ok).toBe(true)
  })
})

describe('📅 손 없는 날', () => {
  it('2026년 10월 — 9·10·19·20·29·30 (음력 9·10·19·20·29·30)', () => {
    const on = Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => isSonEomneunDay(`2026-10-${String(d).padStart(2, '0')}`))
    expect(on).toEqual([9, 10, 19, 20, 29, 30])
  })
  it('형식이 틀리면 false', () => { expect(isSonEomneunDay('2026-1-1')).toBe(false) })
})

describe('🔑 로그인은 맨 끝 — 빠지지 않았다', () => {
  const app = readCode('src/App.tsx')
  it('요청서는 로그인 없이 열리고, 내 요청·상세는 로그인', () => {
    expect(app).toMatch(/path="\/life\/request\/:category" element=\{<LifeRequestFormPage \/>\}/)
    expect(app).toMatch(/path="\/life\/requests\/:id" element=\{<ProtectedRoute requireUser>/)
  })
  it('접수 API 는 여전히 로그인 + 카카오 번호', () => {
    const src = readCode('src/features/home-service/api/home-service.routes.ts')
    expect(src).toMatch(/homeServiceRoutes\.post\('\/requests', requireAuth\(\)/)
    expect(src).toMatch(/code: 'PHONE_REQUIRED'/)
  })
  it('비로그인이면 답을 남기고 로그인으로 — 돌아올 주소를 싣는다', () => {
    const page = readCode('src/pages/life/LifeRequestFormPage.tsx')
    expect(page).toMatch(/if \(!loggedIn\) \{ saveDraft\(def!\.key, values\); navigate\(loginPathFromHere\(\)\); return \}/)
  })
})

describe('📝 임시 저장', () => {
  beforeEach(() => localStorage.clear())
  it('저장·복원·삭제', () => {
    saveDraft('move', { date: '2099-01-01' })
    expect(loadDraft('move')).toEqual({ date: '2099-01-01' })
    clearDraft('move')
    expect(loadDraft('move')).toEqual({})
  })
  it('하루가 지나면 버린다(남의 기기에 주소가 오래 남지 않게)', () => {
    localStorage.setItem('ur_life_draft_v1:move', JSON.stringify({ at: Date.now() - 25 * 3600 * 1000, values: { from: 'x' } }))
    expect(loadDraft('move')).toEqual({})
    expect(localStorage.getItem('ur_life_draft_v1:move')).toBeNull()
  })
})

describe('🗣️ 시트 제목 조사', () => {
  it('받침에 맞춰 을/를', async () => {
    const { eulReul } = await import('@/pages/life/request/FieldSheets')
    expect(eulReul('이사 날짜')).toBe('이사 날짜를')
    expect(eulReul('출발지')).toBe('출발지를')
    expect(eulReul('가게 주소')).toBe('가게 주소를')
    expect(eulReul('업종')).toBe('업종을')
    expect(eulReul('옮길 큰 짐')).toBe('옮길 큰 짐을')
  })
})

describe('생활 견적 규칙은 홈 첫 화면 묶음(app-home)에 섞이지 않는다', () => {
  it('vite manualChunks 가 shared/home-service 를 app-home 에서 뺀다', () => {
    // `shared/home-*` 규칙이 home-service.ts 까지 잡아, 생활 견적 칸 정의가 홈·FAQ 첫 화면 묶음에 실렸다
    // (2026-10-25 CI surface-budgets: faq +2.2KB · app-home.js +2.1).
    const cfg = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8')
    expect(cfg).toContain("(id.includes('/src/shared/home-') && !id.includes('/src/shared/home-service'))")
  })
})
