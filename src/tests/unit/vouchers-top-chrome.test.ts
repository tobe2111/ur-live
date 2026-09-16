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
  it('① 잔액 0 이면 큰 카드 대신 한 줄 바 — 잔액 유무로 갈린다', () => {
    // 🪙 2026-09-14: 불변식은 그대로인데 **보는 자리가 옮겨갔다.** 잔액 카드가 페이지 인라인에서
    //   `pages/vouchers/DealBalanceCard.tsx` 부품으로 빠졌다(대표 확정 안 A3 — 파일크기 래칫도 겸함).
    //   가드를 푸는 대신 재조준한다. 지키는 것은 여전히 하나: **처음 온 사람에게 "당신은 0" 이
    //   첫 화면이 되면 안 된다**(비로그인도 dealBalance 가 0 이다).
    //   🧮 2026-09-16: 조건이 `if (!balance && !awaiting)` 로 넓어졌다 — 로그인한 사람은 숫자가
    //   오기 전에도 **같은 높이의** 카드를 두고 기다린다(밀림 제거). 불변식은 그대로다:
    //   비로그인(=`loggedIn` 거짓)은 여전히 한 줄 바이고, 거기에 42px 숫자가 없다.
    const CARD = readFileSync(resolve(__dirname, '../../pages/vouchers/DealBalanceCard.tsx'), 'utf-8')
    const zeroAt = CARD.indexOf('if (!balance && !awaiting)')
    expect(zeroAt).toBeGreaterThan(-1)
    expect(CARD).toContain('const awaiting = balance == null && loggedIn')
    const bigAt = CARD.indexOf('text-[42px]')          // 큰 카드의 표식 = 확정된 숫자 크기
    expect(bigAt).toBeGreaterThan(zeroAt)              // 큰 카드는 0 분기 **뒤**에만 있다
    // ⚠️ `toMatch(/<DealBalanceCard balance=\{dealBalance\}/)` 로는 부족하다 — **PC 호출부에도 매치**돼
    //    모바일을 인라인으로 되돌려도 통과한다(주입이 잡았다). 페이지가 잔액 카드를 **직접 그리지
    //    않는다**를 본다: 큰 숫자 표식이 페이지에 나타나면 인라인으로 되돌아간 것이다.
    expect(SRC).not.toMatch(/text-\[42px\]/)
    expect((SRC.match(/<DealBalanceCard\b/g) ?? []).length).toBe(2)   // 모바일 + PC
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
