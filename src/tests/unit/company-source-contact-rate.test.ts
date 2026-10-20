/**
 * 📊 **수집원별 연락처 보유율** — 계약 (2026-08-02 신설).
 *
 *   왜: 08-02 실측에서 풀 173,824건 중 **86.6%(150,529)가 연락처 없음**이었고, 그걸 채우는 두 레인의
 *   **적중률이 0** 이었다(카카오 전화 스윕 37시도 0발견 · 이메일 보강 hit_rate 0). 즉 "많이 모으고
 *   나중에 채운다"가 작동하지 않는다 — 더 모으면 연락처 없는 리드만 는다.
 *
 *   그때 "통신판매는 대량이나 연락처가 빈약하다"는 판단의 근거가 **표본 하나(`telno: "N/A"`)** 였다.
 *   그 상태로 수집 전략을 바꾸면 정황을 확정으로 읽는 것이고, 같은 날 이미 두 번 그렇게 틀렸다.
 *   ⇒ **세고 나서 정한다.** 이 집계가 그 표다.
 *
 *   ⚠️ 이 시험이 못 보는 것: 실제 수치가 무엇인지는 라이브만 안다. 여기서는 **계약**만 고정한다
 *     (병합행 제외 · 전화/이메일/합집합 셋 다 · 수집원별 · 큰 것부터 20개).
 *
 *   📌 **2026-08-31 재작성** — 집계 8쿼리가 큐브 한 번 스캔으로 합쳐지며, 이 표는 이제
 *     [SQL 의 조건부 합계] + [코드의 접기]로 나뉘어 만들어진다. 그래서 **질의 문자열이 아니라
 *     동작을 본다** — 합성 큐브를 접어 나온 표가 계약대로인지. 문자열 검사였다면 이 이관에서
 *     "지키는 척"만 남았을 것이다(실제로 그렇게 빨간불이 떠서 이렇게 고쳤다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { COMPANY_CUBE_SQL, foldCube, type CubeRow } from '@/features/marketing/api/company-stats-cube'

const CUBE_SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/company-stats-cube.ts'), 'utf8')
const DISCOVERY = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/company-discovery.ts'), 'utf8')

/** 합성 큐브 한 줄 — 필요한 칸만 채우고 나머지는 0. */
const row = (o: Partial<CubeRow>): CubeRow => ({
  c: '?', t: null, lt: 'unknown', src: '?', live: 1, n: 0,
  with_email: 0, with_phone: 0, with_any: 0, held_no_contact: 0, pipeline: 0, recent7: 0, needs_review: 0,
  seg_payback: 0, seg_agency: 0, af_email: 0, af_site_no_email: 0, af_site_tried: 0, af_no_site: 0, ...o,
})

describe('bySource — 수집원별 연락처 보유율', () => {
  it('🔒 **병합된 행을 뺀다** — 중복을 세면 보유율이 부풀어 잘못된 결론으로 간다', () => {
    const out = foldCube([
      row({ src: 'webkr', live: 1, n: 10, with_email: 4, with_phone: 2, with_any: 5 }),
      row({ src: 'webkr', live: 0, n: 90, with_email: 90, with_phone: 90, with_any: 90 }), // 병합행 — 세면 안 된다
    ])
    expect(out.bySource).toEqual([{ source: 'webkr', n: 10, with_phone: 2, with_email: 4, with_any: 5 }])
  })

  it('🔒 전화·이메일·합집합을 **따로** 센다 — 어느 쪽이 부족한지가 처방을 가른다', () => {
    const out = foldCube([row({ src: 'commerce', n: 7, with_email: 1, with_phone: 5, with_any: 6 })])
    expect(out.bySource[0]).toEqual({ source: 'commerce', n: 7, with_phone: 5, with_email: 1, with_any: 6 })
    // 합집합이 각각의 단순 합이 아니어야 한다(둘 다 가진 행이 있다) — SQL 이 그걸 따로 세는 이유다.
    expect(CUBE_SRC).toMatch(/AS with_any/)
  })

  it('수집원별로 묶고 큰 것부터 — 빈 source 도 버리지 않는다(그것도 사실이다)', () => {
    const out = foldCube([
      row({ src: '?', n: 3 }), row({ src: 'webkr', n: 50 }), row({ src: 'local', n: 20 }),
    ])
    expect(out.bySource.map(r => r.source)).toEqual(['webkr', 'local', '?'])
    expect(CUBE_SRC, "빈 문자열/NULL 을 '?' 로 접는 것은 SQL 쪽 계약이다").toMatch(/COALESCE\(NULLIF\(source,''\),'\?'\) AS src/)
  })

  it('🔒 상한 20 — 예전 SQL 의 LIMIT 20 을 접기에서도 지킨다', () => {
    const many = Array.from({ length: 30 }, (_, i) => row({ src: `s${i}`, n: 100 - i }))
    expect(foldCube(many).bySource).toHaveLength(20)
    expect(foldCube(many).bySource[0].source).toBe('s0')
  })

  it('🔗 응답에 실제로 실린다 — 계산만 하고 안 내보내면 아무도 못 본다', () => {
    const ret = DISCOVERY.slice(DISCOVERY.lastIndexOf('return {'))
    expect(ret, 'bySource 가 반환 객체에 없다 — 계산만 하고 안 내보내는 것이다').toMatch(/\bbySource\b/)
    expect(DISCOVERY, '반환 타입에도 있어야 소비처가 쓴다').toMatch(/bySource: SourceContactRate\[\]/)
  })

  it('실패해도 화면이 죽지 않는다(빈 배열 폴백)', () => {
    expect(DISCOVERY).toMatch(/\.catch\(\(\) => null\)\)\?\.results \|\| \[\]/)
    expect(foldCube([]).bySource).toEqual([]) // 큐브가 비어도 표는 빈 배열이지 undefined 가 아니다
  })

  it('🔒 이 표가 오는 쿼리가 실제로 한 번만 훑는다(집계 8번 시절로 돌아가지 않았는가)', () => {
    expect(COMPANY_CUBE_SQL).toMatch(/FROM ad_company_leads GROUP BY 1,2,3,4,5$/)
  })
})
