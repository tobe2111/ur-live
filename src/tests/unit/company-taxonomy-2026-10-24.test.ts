/**
 * 🧭 **업종 분류 정본 — 전문직은 국가자격 단위** (2026-10-24 대표 지시).
 *
 *   > *"법조계, 뭐 그런 업종 구별이 더 체계적으로 잘 되어야 함. 지금은 정확도가 많이 낮음."*
 *
 *   라이브 실측이 그 말을 뒷받침했다 — 법조계 상호 433건 중 **87%가 틀렸고**(`노무` 215 · `통신판매` 115 ·
 *   `세무사` 15 · `회계` 9 · 대행사 17 …, 정답 `법률` 55), `전문서비스` 안에서 `세무사`(7,517)와
 *   `세무·기장`(5,447)이 **같은 업종 두 칸**이었다(둘 다 상가정보 `M10402`).
 *
 *   아래 상호는 **전부 라이브에서 가져온 실제 값**이다 — 합성 예시로 통과시키면 이 가드는 헛돈다.
 *
 *   ⚠️ 이 검사가 **못 막는 것**: 상호에 자격 표기가 없는 행(예: `마음온심리상담센터`)은 여전히
 *   등록부 라벨을 쓴다. 그건 설계이고, 라이브 정확도는 재분류가 돈 뒤 D1 로 다시 재야 한다.
 */
import { describe, it, expect } from 'vitest'
import {
  classifyProfession, canonSubcategory, refineRegistryLabel,
  PROFESSION_SUBCATEGORIES, PROFESSION_CATEGORY, CANON_SUBCATEGORY, PROFESSION_REFINE_BLOCKED,
} from '@/features/marketing/api/company-taxonomy'
import { classifyLead, CLASSIFY_RULES_VERSION } from '@/features/marketing/api/company-classify'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('상호 → 국가자격 업종', () => {
  it('🩸 노무사가 여는 "노동법률사무소" 를 변호사로 보지 않는다 (순서 함정)', () => {
    expect(classifyProfession('솔숲노동법률사무소')).toBe('노무사')
    expect(classifyProfession('노동법률사무소선의')).toBe('노무사')
    expect(classifyProfession('공인노무사라엘')).toBe('노무사')
    expect(classifyProfession('하원노무사사무소')).toBe('노무사')
    expect(classifyProfession('새김인사노무컨설팅')).toBe('노무사')
  })

  it('🩸 "세무회계사무소" 는 `회계사` 를 부분문자열로 품는다 — 세무사가 먼저다', () => {
    expect(classifyProfession('윤순혁세무회계사무소')).toBe('세무사')
    expect(classifyProfession('클로버세무회계')).toBe('세무사')
    expect(classifyProfession('세무법인택솔플러스동탄')).toBe('세무사')
    expect(classifyProfession('박진성세무회계사무소')).toBe('세무사')
  })

  it('법조계는 변호사로', () => {
    expect(classifyProfession('법무법인광장')).toBe('변호사')
    expect(classifyProfession('변호사김철수법률사무소')).toBe('변호사')
    expect(classifyProfession('법무법인 세종')).toBe('변호사')
  })

  it('🩸 "법무법인" 과 "법무사" 는 갈린다', () => {
    expect(classifyProfession('법무사김영수사무소')).toBe('법무사')
    expect(classifyProfession('법무법인바른')).toBe('변호사')
  })

  it('행정사를 세무사로 보지 않는다 (라이브 오분류)', () => {
    expect(classifyProfession('출입국대표행정사도담행정사사무소')).toBe('행정사')
  })

  it('나머지 자격도 덮는다', () => {
    expect(classifyProfession('특허법인아주')).toBe('변리사')
    expect(classifyProfession('대한회계법인')).toBe('회계사')
    expect(classifyProfession('가온감정평가법인')).toBe('감정평가사')
    expect(classifyProfession('삼정관세법인')).toBe('관세사')
    expect(classifyProfession('에이스손해사정')).toBe('손해사정사')
    expect(classifyProfession('정림건축사사무소')).toBe('건축사')
  })

  it('🩸 일반어 오탐을 내지 않는다 — 옛 bare `기장` 규칙이 부산 기장군을 세무로 분류했다', () => {
    // 라이브 실측: `기장물산(주)` → `전문서비스/세무·기장`
    expect(classifyProfession('기장물산(주)')).toBeNull()
    expect(classifyProfession('기장해녀수산')).toBeNull()
    expect(classifyProfession('기장종합철물')).toBeNull()
    expect(classifyProfession('삼성건축사업부')).toBeNull() // '건축사' 부분문자열
  })

  it('단서가 없으면 아무 말도 하지 않는다(null) — 틀린 라벨을 새로 만들지 않는다', () => {
    expect(classifyProfession('마음온심리상담센터')).toBeNull()
    expect(classifyProfession('아이디어오션')).toBeNull()
    expect(classifyProfession('')).toBeNull()
    expect(classifyProfession(null)).toBeNull()
  })
})

describe('중복 라벨 통합', () => {
  it('전문서비스 — 자격 단위로', () => {
    expect(canonSubcategory('법률')).toBe('변호사')
    expect(canonSubcategory('노무')).toBe('노무사')
    expect(canonSubcategory('세무·기장')).toBe('세무사')
    expect(canonSubcategory('회계')).toBe('회계사')
  })

  it('띄어쓰기·어미 변형을 하나로', () => {
    expect(canonSubcategory('마케팅 대행사')).toBe('마케팅대행')
    expect(canonSubcategory('창업 컨설팅')).toBe('창업컨설팅')
    expect(canonSubcategory('주류 도매')).toBe('주류도매')
    expect(canonSubcategory('주류도매상')).toBe('주류도매')
    expect(canonSubcategory('식자재 유통')).toBe('식자재유통')
    expect(canonSubcategory('업소용 식자재')).toBe('식자재유통')
    expect(canonSubcategory('식자재 마트')).toBe('식자재유통')
    expect(canonSubcategory('커피 원두 납품')).toBe('원두납품')
  })

  it('모르는 값은 버리지 않는다 — 키워드에서 온 라벨도 정보다', () => {
    expect(canonSubcategory('바이럴 마케팅 대행사')).toBe('바이럴 마케팅 대행사')
    expect(canonSubcategory('조달등록')).toBe('조달등록')
    expect(canonSubcategory(null)).toBeNull()
  })

  it('🔒 통합표가 자기 자신을 가리키지 않는다(무한 별칭·헛돌기 방지)', () => {
    for (const [from, to] of Object.entries(CANON_SUBCATEGORY)) {
      expect(from, `${from} → ${to}`).not.toBe(to)
      expect(CANON_SUBCATEGORY[to], `${to} 는 정본이어야 한다(다시 매핑되면 안 됨)`).toBeUndefined()
    }
  })
})

describe('등록부 라벨 정밀화', () => {
  it('거친 등록부 코드를 상호의 자격으로 좁힌다', () => {
    expect(refineRegistryLabel({ company_name: '솔숲노동법률사무소', category: '전문서비스', subcategory: '노무', tier: 5 }))
      .toEqual({ category: '전문서비스', subcategory: '노무사', tier: 5 })
    expect(refineRegistryLabel({ company_name: '출입국대표행정사도담행정사사무소', category: '전문서비스', subcategory: '세무사', tier: 5 }))
      .toEqual({ category: '전문서비스', subcategory: '행정사', tier: 5 })
  })

  it('🔒 통신판매 신고(온라인판매)는 덮지 않는다 — 별개 축의 등록부 사실이다', () => {
    expect(refineRegistryLabel({ company_name: '법무법인광장', category: '온라인판매', subcategory: '통신판매', tier: 4 }))
      .toEqual({ category: '온라인판매', subcategory: '통신판매', tier: 4 })
    expect(PROFESSION_REFINE_BLOCKED.has('온라인판매')).toBe(true)
  })

  it('자격 단서가 없으면 등록부 라벨을 유지하고 통합만 한다', () => {
    expect(refineRegistryLabel({ company_name: '마음온심리상담센터', category: '전문서비스', subcategory: '노무', tier: 5 }))
      .toEqual({ category: '전문서비스', subcategory: '노무사', tier: 5 })
    expect(refineRegistryLabel({ company_name: '대성상사', category: '식자재·납품', subcategory: '주류 도매', tier: 2 }))
      .toEqual({ category: '식자재·납품', subcategory: '주류도매', tier: 2 })
  })
})

describe('classifyLead 배선', () => {
  it('자격 판정이 BIZ_RULES 보다 먼저 — 전문직이 대행사로 가지 않는다', () => {
    const r = classifyLead({ company_name: '법무법인태평양', source: 'local', category: '대행사', subcategory: '마케팅 대행사', tier: 1 })
    expect(r.ok).toBe(true)
    expect(r.category).toBe(PROFESSION_CATEGORY)
    expect(r.subcategory).toBe('변호사')
    expect(r.confidence).toBe('evidence')
  })

  it('🩸 옛 규칙이 세무로 분류했던 기장군 상호가 더는 전문서비스가 아니다', () => {
    const r = classifyLead({ company_name: '기장물산', source: 'local', category: null, subcategory: null })
    expect(r.subcategory).not.toBe('세무사')
    expect(r.subcategory).not.toBe('세무·기장')
  })

  it('키워드 폴백 라벨도 정본으로 통합된다', () => {
    const r = classifyLead({ company_name: '우리기획', source: 'local', category: '대행사', subcategory: '마케팅 대행사', tier: 1 })
    expect(r.subcategory).toBe('마케팅대행')
  })
})

describe('저장 경로 배선 — 등록부 행이 실제로 정밀화돼 저장된다', () => {
  /**
   * 🩸 이 블록은 **주입이 요구해서 생겼다.** 처음엔 순수 모듈과 `classifyLead` 만 재서,
   *   `company-save` 의 `refineRegistryLabel` 호출을 통째로 떼어내도 테스트가 초록이었다
   *   (= 가드가 지키는 척만 함). 등록부 행은 `classifyLead` 의 업종을 쓰지 않으므로
   *   **저장 경로를 실제로 돌려** 바인드되는 값을 봐야 한다.
   */
  /** 최소 D1 스텁 — INSERT 바인드 인자를 모은다. */
  function fakeDb() {
    const inserts: unknown[][] = []
    const mk = (sql: string) => {
      const st = {
        args: [] as unknown[],
        bind(...v: unknown[]) { st.args = v; return st },
        async first<T>(): Promise<T | null> { return ({ n: 0 } as unknown as T) },
        async all<T>() { return { results: [] as T[] } },
        async run() { return { meta: { changes: 1 } } },
        _sql: sql,
      }
      return st
    }
    return {
      inserts,
      prepare: mk,
      async batch(stmts: Array<{ _sql: string; args: unknown[] }>) {
        for (const st of stmts) if (/^INSERT INTO ad_company_leads/.test(st._sql.trim())) inserts.push(st.args)
        return stmts.map(() => ({}))
      },
    }
  }
  const lead = (name: string, subcategory: string) => ({
    company_name: name, category: '전문서비스', subcategory, tier: 5,
    source: 'storeinfo', source_keyword: 'M10307', phone: '051-000-0000',
  })
  const saved = async (name: string, sub: string) => {
    const { saveCompanyLeadsCounted } = await import('@/features/marketing/api/company-save')
    const db = fakeDb()
    await saveCompanyLeadsCounted(db as unknown as D1Database, [lead(name, sub) as never])
    expect(db.inserts.length, 'INSERT 가 한 건도 없으면 이 검사는 헛돈다').toBe(1)
    return { category: db.inserts[0][3], subcategory: db.inserts[0][4] }
  }

  it('🔴 상가정보 `M10307`(노무사) 안의 법조계 사무소가 자격으로 교정돼 저장된다', async () => {
    await expect(saved('솔숲노동법률사무소', '노무사')).resolves.toEqual({ category: '전문서비스', subcategory: '노무사' })
    await expect(saved('법무법인광장', '노무사')).resolves.toEqual({ category: '전문서비스', subcategory: '변호사' })
    await expect(saved('출입국대표행정사도담행정사사무소', '세무사')).resolves.toEqual({ category: '전문서비스', subcategory: '행정사' })
  })

  it('🔒 자격 단서가 없으면 등록부 라벨을 그대로 저장한다(틀린 라벨을 새로 만들지 않는다)', async () => {
    await expect(saved('마음온심리상담센터', '노무사')).resolves.toEqual({ category: '전문서비스', subcategory: '노무사' })
  })
})

describe('정본 집합이 코드 전체에서 일관된다', () => {
  const CLS = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/company-classify.ts'), 'utf8')
  const STORE = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/store-info-collect.ts'), 'utf8')

  it('🔒 BIZ_RULES 에 전문직 라벨이 남아 있지 않다(두 표가 생기면 반드시 갈라진다)', () => {
    for (const dead of ["subcategory: '법률'", "subcategory: '노무'", "subcategory: '세무·기장'", "subcategory: '회계'"]) {
      expect(CLS, `${dead} 는 company-taxonomy 로 옮겨졌다`).not.toContain(dead)
    }
  })

  it('🔒 상가정보 타깃 라벨이 전부 정본이다(라벨 드리프트 재발 차단)', () => {
    const subs = [...STORE.matchAll(/subcategory: '([^']+)'/g)].map(m => m[1])
    expect(subs.length, '타깃 표를 읽지 못하면 이 검사는 헛돈다').toBeGreaterThanOrEqual(9)
    for (const s of subs) expect(canonSubcategory(s), `'${s}' 는 통합 대상이다`).toBe(s)
  })

  it('🔒 규칙 버전이 올라갔다 — 안 올리면 소급 재분류가 영영 안 돈다', () => {
    // 재검사 쿼리가 `classified_v < VERSION` 이고 **시간 폴백이 없다**(company-classify docblock).
    expect(CLASSIFY_RULES_VERSION).toBeGreaterThan(9)
  })

  it('검사 대상이 실제로 존재한다 — 0건 통과를 성공으로 오인하지 않게', () => {
    expect(PROFESSION_SUBCATEGORIES.length).toBe(11)
    expect(Object.keys(CANON_SUBCATEGORY).length).toBeGreaterThanOrEqual(12)
    expect(CLS).toContain('classifyProfession')
  })
})
