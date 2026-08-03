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
 *   ⚠️ 이 시험이 못 보는 것: 실제 수치가 무엇인지는 라이브만 안다. 여기서는 **질의의 모양**만 고정한다
 *     (병합행 제외 · 전화/이메일/합집합 셋 다 · 수집원별).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/company-discovery.ts'), 'utf8')
const Q = (() => {
  const i = SRC.indexOf('const bySource = ')
  expect(i, 'bySource 집계를 못 찾았다 — 이 시험이 헛돌고 있다').toBeGreaterThan(-1)
  return SRC.slice(i, i + 900)
})()

describe('bySource — 수집원별 연락처 보유율', () => {
  it('🔒 **병합된 행을 뺀다** — 중복을 세면 보유율이 부풀어 잘못된 결론으로 간다', () => {
    expect(Q).toMatch(/WHERE merged_into IS NULL/)
  })

  it('🔒 전화·이메일·합집합을 **따로** 센다 — 어느 쪽이 부족한지가 처방을 가른다', () => {
    expect(Q, '전화').toMatch(/phone IS NOT NULL AND phone != ''/)
    expect(Q, '이메일').toMatch(/email IS NOT NULL AND email != ''/)
    expect(Q, '합집합(with_any)').toMatch(/AS with_any/)
  })

  it('수집원별로 묶고 큰 것부터 — 빈 source 도 버리지 않는다(그것도 사실이다)', () => {
    expect(Q).toMatch(/COALESCE\(NULLIF\(source,''\),'\?'\) AS source/)
    expect(Q).toMatch(/GROUP BY 1 ORDER BY n DESC/)
  })

  it('🔗 응답에 실제로 실린다 — 계산만 하고 안 내보내면 아무도 못 본다', () => {
    // ⚠️ 2026-08-03: 원래 `byCategory, byTier, byLeadType, bySource,` **순서 문자열**로 앵커했는데,
    //   반환 목록에 `byDay` 가 하나 끼자 깨졌다(기능은 멀쩡한데 시험만 빨강 = 낡은 지도).
    //   지켜야 할 것은 이웃 순서가 아니라 **"bySource 가 반환에 실린다"** 이므로 그 의미로 잡는다.
    const ret = SRC.slice(SRC.lastIndexOf('return {'))
    expect(ret, 'bySource 가 반환 객체에 없다 — 계산만 하고 안 내보내는 것이다').toMatch(/\bbySource\b/)
    expect(SRC, '반환 타입에도 있어야 소비처가 쓴다').toMatch(/bySource: SourceContactRate\[\]/)
  })

  it('실패해도 화면이 죽지 않는다(빈 배열 폴백)', () => {
    expect(Q).toMatch(/\.catch\(\(\) => null\)\)\?\.results \|\| \[\]/)
  })
})
