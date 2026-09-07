/**
 * 🎫 교환권 탭 상단 계약 (2026-09-01 — 대표 "나안" 승인)
 *
 * ■ 왜 테스트인가
 *   첫 상품 위에 층이 다섯이었다(잔액 슬래브 · 고아 링크 · 카테고리 칩 · 브랜드 스트립 · 섹션 헤더)
 *   = 약 700px. 그중 둘을 정리했는데, 이런 층은 **하나씩 다시 얹히기 쉽다**(그래서 다섯이 됐다).
 *
 * ■ 불변식
 *   ① 잔액이 0 이면 검정 슬래브를 내지 않는다 — 처음 온 사람에게 "당신은 0" 이 첫 화면이 되면 안 된다.
 *   ② 브랜드 스트립은 기본으로 접힌다 — 다만 **없애지 않는다**(2026-05-19 대표 요청 구조).
 *   ③ 딥링크로 브랜드가 잡혀 있으면 펴서 시작한다 — 접힌 채 선택 상태면 왜 걸러졌는지 알 수 없다.
 *
 * ⚠️ 못 잡는 것: 실제 렌더 높이(그건 미리보기 하네스가 본다) · PC 레이아웃(이 배치는 모바일만 바꿨다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(__dirname, '../../pages/VouchersPage.tsx'), 'utf-8')

describe('교환권 탭 상단', () => {
  it('① 잔액 0 이면 슬래브 대신 한 줄 바 — 잔액 유무로 갈린다', () => {
    // 슬래브는 `dealBalance ?` 삼항의 참 가지 안에만 있어야 한다.
    const i = SRC.indexOf('{dealBalance ? (')
    expect(i).toBeGreaterThan(-1)
    // 🎫 2026-09-02 B안: 검정 슬래브 → 흰 카드(`p-5 … shadow-lift`, 숫자 36px 이 주인공). 표식만 바꿨다.
    const slab = SRC.indexOf('rounded-2xl p-5 bg-white dark:bg-[#1D1F29] shadow-lift', i)
    const elseAt = SRC.indexOf(') : (', i)
    expect(slab).toBeGreaterThan(-1)
    expect(slab).toBeLessThan(elseAt)   // 슬래브가 else 가지로 새지 않았다
  })

  it('② 브랜드 스트립은 접기 토글로 게이트된다(기본은 펼침 — 2026-09-02 B안)', () => {
    expect(SRC).toMatch(/\{brandsOpen && \(/)
    expect(SRC).toMatch(/브랜드로 찾기/)
  })

  it('③ 스트립을 없애지는 않는다 — 펼치면 그대로 나온다', () => {
    expect(SRC).toMatch(/orderedBrands\.map/)
    expect(SRC).toMatch(/setBrandsOpen/)
  })

  it('④ 기본 펼침 — 대표 2026-09-02 "브랜드 펼침 · 로고가 보이게"(09-01 기본 접기를 대체)', () => {
    expect(SRC).toMatch(/const \[brandsOpen, setBrandsOpen\] = useState\(true\)/)
  })
})
