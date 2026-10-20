/**
 * 📊 필드 커버리지 프로브 — 불변식 (2026-07-29 신설).
 *
 *   이 모듈이 왜 생겼나: 같은 날 세 번, **원본 응답이 무엇을 주는지 몰라서** 데이터를 잃었다.
 *   `upteNm` 으로 분류하려 했는데 그 키가 실응답에 없어 15만 건이 상수 라벨로 굳었고,
 *   `"N/A"` 를 값으로 채택해 주소 31.7% 를 잃었고, 지금도 **홈페이지 0.0%** 의 원인을 모른다.
 *
 *   여기서 고정하는 것: ① 채움률이 사실이어야 한다("N/A" 를 채워진 것으로 세면 프로브가 거짓말)
 *   ② 예시 값에 개인정보가 실리면 안 된다(진단은 어드민 화면·핸드오프로 흘러간다)
 *   ③ 등장한 키는 **전부 비어도 기록**된다(그 사실 자체가 우리가 찾던 정보다).
 */
import { describe, it, expect } from 'vitest'
import { fieldCoverage, maskExample, coverageNote } from '@/features/marketing/api/field-coverage'

describe('필드 커버리지', () => {
  it('채움률을 센다 — 값이 있는 행 비율', () => {
    const cov = fieldCoverage([
      { a: 'x', b: '' }, { a: 'y', b: 'v' }, { a: 'z', b: '' }, { a: 'w', b: '' },
    ])
    const a = cov.find(c => c.key === 'a')!, b = cov.find(c => c.key === 'b')!
    expect(a.pct).toBe(100)
    expect(b.pct).toBe(25)
  })

  it('🕳️ "N/A" 는 **채워진 것이 아니다** — 이걸 세면 프로브가 고치려는 그 버그를 반복한다', () => {
    const cov = fieldCoverage([{ domnCn: 'N/A' }, { domnCn: 'N/A' }, { domnCn: 'shop.co.kr' }])
    const d = cov.find(c => c.key === 'domnCn')!
    expect(d.filled).toBe(1)
    expect(d.pct).toBe(33)
    expect(d.ex).toBe('shop.co.kr') // 예시는 **실제 값**이어야 형식 판단이 된다
  })

  it('전부 비어도 키는 남는다 — "이 필드는 오지만 항상 비어 있다"가 우리가 찾던 답이다', () => {
    const cov = fieldCoverage([{ telno: 'N/A' }, { telno: '' }])
    const t = cov.find(c => c.key === 'telno')!
    expect(t.pct).toBe(0)
    expect(t.ex).toBeUndefined()
  })

  it('채움률 내림차순 + 동률은 키 이름순(실행마다 같은 순서)', () => {
    const cov = fieldCoverage([{ zzz: 'v', aaa: 'v', mid: '' }])
    expect(cov.map(c => c.key)).toEqual(['aaa', 'zzz', 'mid'])
  })

  it('상위 N개로 자른다(스냅샷 비대화 방지)', () => {
    const row: Record<string, string> = {}
    for (let i = 0; i < 100; i++) row[`k${i}`] = 'v'
    expect(fieldCoverage([row], 10)).toHaveLength(10)
  })

  it('빈 입력은 빈 결과(0으로 나누지 않는다)', () => {
    expect(fieldCoverage([])).toEqual([])
  })
})

describe('🔐 예시 값 마스킹 — 진단이 새 유출 경로가 되지 않게', () => {
  it('이메일은 첫 글자만 남긴다(도메인은 형식 판단에 필요해 유지)', () => {
    expect(maskExample('hong.gildong@naver.com')).toBe('h***@naver.com')
  })

  it('8자리 이상 숫자(사업자번호·전화·계좌)는 앞 3자리만', () => {
    expect(maskExample('2062144178')).toBe('206******')
    expect(maskExample('02-1234-5678')).toBe('02-1234-5678') // 하이픈으로 끊기면 8자리 연속이 아니다
  })

  it('긴 값은 자른다', () => {
    expect(maskExample('가'.repeat(80), 20)).toHaveLength(21) // 20자 + 말줄임표
  })

  it('평범한 값은 그대로 — 형식을 보려고 만든 기능이다', () => {
    expect(maskExample('서울특별시 광진구 군자동 367-4')).toBe('서울특별시 광진구 군자동 367-4')
  })
})

describe('요약 한 줄', () => {
  it('빈 필드를 먼저 알린다 — 그게 행동 대상이다', () => {
    const note = coverageNote(fieldCoverage([{ a: 'v', domnCn: 'N/A', telno: '' }]))
    expect(note).toContain('빈 필드 2/3')
    expect(note).toContain('domnCn')
  })

  it('전부 채워졌으면 그렇게 말한다', () => {
    expect(coverageNote(fieldCoverage([{ a: 'v' }]))).toBe('전 필드 채워짐(1)')
  })

  it('입력이 없으면 null(할 말이 없으면 아무 말도 하지 않는다)', () => {
    expect(coverageNote([])).toBeNull()
  })
})
