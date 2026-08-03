/**
 * 🪦 **축 줄이기가 자연스러워야 한다** (2026-08-03 대표 지시 *"줄이기도 자연스럽게 만들어줘"*).
 *
 * ## 왜 필요했나
 * 늘리기는 이미 자연스러웠다 — 규칙 하나 추가하면 `CLASSIFIED_CATEGORIES` 가 자동 파생되고,
 * 어드민 필터 누락은 유닛이 막고, 기존 리드도 재분류가 ~2시간 안에 끌어온다(골프 축 222명이 그 증거).
 *
 * **줄이기는 반대였다.** 규칙만 지우면 세 군데에 잔재가 남는다:
 * ```
 *   ① 리드의 카테고리 값 — 아무 규칙도 안 만드는 유령 값으로 영구 잔존
 *   ② 키워드의 카테고리 — 폴백(resolveCategory)이 새 리드에 계속 그 값을 붙임
 *   ③ 수집 슬롯      — 죽은 축 키워드가 희소한 회차(시간당 1회·16픽)를 계속 먹음
 * ```
 * ①만 고치면 ②가 다시 붙여 **영원히 제자리**다. 셋을 한 선언으로 묶는 게 이 기능이다.
 *
 * ## ⚠️ 왜 "규칙에 없으면 지운다"로 일반화하지 않았나
 * `shouldClearCategory` 의 docblock 이 정면으로 경고한다 —
 * *"모르는 값을 지우면 사람이 손으로 고친 분류까지 날린다."*
 * **분류기가 안 만드는 값 ≠ 잘못된 값**이다. 키워드 폴백은 키워드에 적힌 **어떤 문자열이든** 붙일 수 있고
 * 그건 정당한 경로다(라이브 실측: 활성 키워드 카테고리 18종 중 `자동` 은 분류기가 안 만든다).
 * ⇒ 추론이 아니라 **선언**으로 받는다. 사람이 "끝났다"고 말한 것만 지운다 = 원칙 그대로 "아는 경우".
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 은퇴 후 리드가 실제로 비워지는지(그건 라이브 재분류 한 바퀴 뒤에 보인다).
 *   여기서 고정하는 건 "선언하면 세 경로가 전부 따라오는가" 뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  RETIRED_CATEGORIES, CLASSIFIED_CATEGORIES, NON_CATEGORIES,
  shouldClearCategory, resolveCategory,
} from '@/features/marketing/api/influencer-classify'

describe('은퇴 축 — 선언 한 줄로 셋이 따라온다', () => {
  /**
   * ⚠️ 실제 목록은 지금 **비어 있다**(접은 축이 아직 없다). 그래서 `for (const c of RETIRED)` 로만 쓰면
   *   0건을 돌며 **영원히 통과**한다 — 이 레포가 반복해 겪은 헛도는 가드다.
   *   ⇒ 주입구로 **진짜 은퇴 상황을 만들어** 동작을 검사한다.
   */
  const FAKE = new Set(['접은축'])

  it('🔒 ① 은퇴 값을 가진 리드는 비운다', () => {
    expect(shouldClearCategory('접은축', '어떤 채널', '아무 신호 없는 소개글', FAKE)).toBe(true)
    // 은퇴 안 한 값은 그대로 — 비우기가 과하면 멀쩡한 분류가 날아간다.
    expect(shouldClearCategory('맛집', '어떤 채널', '아무 신호 없는 소개글', FAKE)).toBe(false)
  })

  it('🔒 ② 키워드 폴백이 은퇴 값을 다시 안 붙인다 — 없으면 비우기와 영원히 싸운다', () => {
    // 본문 신호가 없을 때만 폴백이 동작하므로, 그 상황을 만들어 확인한다.
    expect(resolveCategory('어떤 채널', '아무 신호 없음', '살아있는축', FAKE)).toBe('살아있는축')
    expect(resolveCategory('어떤 채널', '아무 신호 없음', '접은축', FAKE)).toBeNull()
  })

  it('🔒 기본값은 모듈 상수다 — 주입구가 실수로 "항상 빈 집합"이 되면 은퇴가 무효가 된다', () => {
    const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-classify.ts'), 'utf8')
    expect(src).toMatch(/retired: ReadonlySet<string> = RETIRED_CATEGORIES/)
    expect(src).toMatch(/if \(retired\.has\(stored\)\) return true/)
    expect(src).toMatch(/!NON_CATEGORIES\.has\(kc\) && !retired\.has\(kc\)/)
  })

  it('🔒 ③ 은퇴 축 키워드는 수집 슬롯을 안 먹는다', () => {
    const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
    expect(src).toMatch(/\.filter\(k => !k\.category \|\| !RETIRED_CATEGORIES\.has\(k\.category\)\)/)
    // ⚠️ 행을 지우거나 active=0 으로 만들면 되돌릴 때 성과 이력이 꼬인다 — **선택에서만** 빼야 한다.
    expect(src).not.toMatch(/RETIRED_CATEGORIES[\s\S]{0,80}(DELETE|SET active = 0)/)
  })

  /**
   * 규칙과 은퇴를 동시에 두면 분류기가 붙이고 재분류가 지우는 걸 **매 회차 반복**한다
   * (라이브에선 카테고리가 깜빡이는 것으로 보인다). 둘은 상호배타여야 한다.
   */
  it('🔒 은퇴와 분류 규칙은 상호배타 — 겹치면 매 회차 붙였다 지웠다 한다', () => {
    const both = [...RETIRED_CATEGORIES].filter(c => CLASSIFIED_CATEGORIES.includes(c))
    expect(both, `규칙이 살아있는데 은퇴 선언됨: ${both.join(', ')}`).toEqual([])
  })

  it('🔒 비-카테고리(자동/일반)와도 안 겹친다 — 이미 다른 규칙이 처리한다', () => {
    expect([...RETIRED_CATEGORIES].filter(c => NON_CATEGORIES.has(c))).toEqual([])
  })

  it('📌 은퇴 목록은 집합이다 — 배열이면 중복이 조용히 쌓인다', () => {
    expect(RETIRED_CATEGORIES).toBeInstanceOf(Set)
  })

  /** 살아있는 축은 절대 건드리면 안 된다 — 되돌려-검증의 반대 방향. */
  it('🔒 살아있는 축은 안 비운다', () => {
    expect(CLASSIFIED_CATEGORIES.length).toBeGreaterThan(10)  // 대상 0건이면 통과가 아니다
    for (const c of CLASSIFIED_CATEGORIES) {
      expect(shouldClearCategory(c, 'QR마케터', '체험단 모집 대행합니다'), c).not.toBe(true)
    }
  })
})
