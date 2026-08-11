import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { autoPromotionRoom } from '@/features/marketing/api/influencer-auto-collect'

/**
 * 🌱 2026-07-29 신규 키워드 승격 자리의 불변식 잠금.
 *
 *   실사고: 자리를 `MAX_ACTIVE_KEYWORDS(200) - 활성전체` 로 셌는데 시드만으로 상한에 닿았다
 *   (라이브 실측 **활성 210 = seed 190 + auto 20**) → `room = 0` 고착 → 신규 키워드가 **영원히**
 *   승격 못 함(`promoted: []`). 수집은 매시간 정상으로 돌면서 고갈된 키워드만 반복 →
 *   `found 332 → saved 3`(99% 중복). "도는데 안 크는" 가장 조용한 실패였다.
 *
 *   여기서 고정하는 것:
 *     ① 자리는 **시드 수와 무관**하다 — 시드가 몇 개든 발굴 쿼터는 남는다(교착 재발 차단).
 *     ② 쿼터를 넘겨 승격하지 않는다 — auto 가 무한 증식하면 검색 예산을 잠식한다.
 *     ③ 음수/NaN 입력에서도 0 이상 유한값(학습 상한이 바닥이거나 카운트 조회가 실패해도 안전).
 */
describe('autoPromotionRoom — 신규 키워드 승격 자리', () => {
  it('① 시드가 아무리 많아도 발굴 자리는 남는다(과거 교착의 직접 재현)', () => {
    // 과거 계산이라면 seed 190 + auto 20 = 210 → room 0. 새 계산은 auto 수만 본다.
    expect(autoPromotionRoom(20, 60)).toBe(40)
    expect(autoPromotionRoom(20, 60)).toBeGreaterThan(0)
  })

  it('② 쿼터를 넘겨 승격하지 않는다(검색 예산 잠식 방지)', () => {
    expect(autoPromotionRoom(60, 60)).toBe(0)
    expect(autoPromotionRoom(120, 60)).toBe(0) // 이미 초과해도 음수 아님
  })

  it('③ 비정상 입력에서도 0 이상 유한값', () => {
    for (const [a, c] of [[Number.NaN, 60], [-5, 60], [10, Number.NaN], [10, -1]] as [number, number][]) {
      const v = autoPromotionRoom(a, c)
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })

  it('④ 회수된 자리는 즉시 재사용된다(불모 auto 은퇴 → 다음 승격)', () => {
    const before = autoPromotionRoom(60, 60) // 꽉 참
    const after = autoPromotionRoom(52, 60)  // barren 8개 은퇴 후
    expect(before).toBe(0)
    expect(after).toBe(8)
  })
})

/**
 * 📈 **키워드 신선도 = 무료 발굴량의 마지막 레버** (2026-08-09 — 대표 "1번(키워드 수율)" 지시).
 *
 *   07-21 발굴 스파이크(12,533/일)의 정체 = 07-20 신규 202개 활성화 **다음날**(첫 회차가 백로그를
 *   수확한다 — 고갈 곡선 실측: 회당 저장 5~14회 14.3 → 30회+ 2.4). 그런데 라이브는 cap 60 이 꽉 차
 *   승격 대기 2,981개(hits≥5)가 밖에서 기다렸다. ⇒ cap 120 + "찾는데 안 남는" auto 수율 은퇴.
 */
describe('키워드 신선도 회전 — cap 상향 + 수율 은퇴', () => {
  const src = () => readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')

  it('🔒 cap 120 — 되돌리면 신선 키워드 유입이 다시 막힌다(승격 대기 수천 개 고착)', async () => {
    const { MAX_AUTO_KEYWORDS } = await import('@/features/marketing/api/influencer-keyword-rotation')
    expect(MAX_AUTO_KEYWORDS).toBe(120)
  })

  it('⚠️ 회차 폭은 별도 상수(차단 리스크 레버) — 값 변경은 대표 승인 사항', async () => {
    const { COLLECT_KEYWORDS_PER_ROUND } = await import('@/features/marketing/api/influencer-keyword-rotation')
    // 6→9: 2026-08-11 대표 승인 "폭 9로 올려" — 해제 조건(측정>유입·차단 0) 충족 실측 후.
    expect(COLLECT_KEYWORDS_PER_ROUND).toBe(9)
  })

  it('🔒 수율 은퇴가 배선돼 있다 — barren 의 drip 사각지대(found 50+ / saved <10)를 슬롯 차원에서 회수', async () => {
    // 임계는 rotation SSOT 조각의 **사실**로 잠근다(2026-08-09 — 소스 리터럴 매칭에서 전환:
    // 은퇴문과 승격 차단이 같은 조각을 봐야 해서 SQL 이 상수로 갔다. 임계를 999999 로 조용히 올리면 여기가 빨간불).
    const { AUTO_RETIRE_WHERE } = await import('@/features/marketing/api/influencer-keyword-rotation')
    expect(AUTO_RETIRE_WHERE.yield).toMatch(/COALESCE\(found_total, 0\) >= 50/)
    expect(AUTO_RETIRE_WHERE.yield).toMatch(/COALESCE\(saved_total, 0\) < 10/)
    // 배선 — 은퇴 batch 가 세 조각을 실제로 쓴다. 수율 문은 LIMIT 3(회차당 상한 = 완만한 회전) 유지.
    const s = src()
    expect(s).toMatch(/\$\{AUTO_RETIRE_WHERE\.yield\} ORDER BY saved_total ASC, found_total DESC LIMIT 3/)
    expect(s).toMatch(/\$\{AUTO_RETIRE_WHERE\.f30\}/)
    expect(s).toMatch(/\$\{AUTO_RETIRE_WHERE\.barren\}/)
  })

  it('🔒 수율 은퇴는 auto 전용 — seed(대표 커버리지 축)를 건드리면 커버리지에 구멍이 난다', () => {
    // 은퇴 UPDATE 3종 전부 source='auto' 가드를 갖는다(seed 를 만지는 은퇴문이 하나라도 생기면 실패).
    const stmts = src().match(/UPDATE ad_discovery_keywords SET active = 0[^)]+/g) || []
    expect(stmts.length).toBeGreaterThanOrEqual(3)
    for (const st of stmts) expect(st, st.slice(0, 80)).toContain("source = 'auto'")
  })
})

/**
 * 🧟 **은퇴↔승격 livelock 차단** (2026-08-09 라이브 실측 — cap 120 개방이 무장시킨 결함).
 *
 *   은퇴는 `active=0` 만 쓰고 `hits` 는 재채굴마다 계속 쌓인다. 승격 후보 쿼리가 `active=0 AND hits>=5`
 *   뿐이면 은퇴자가 `hits DESC` 로 신선 큐(2,907개 대기)를 제치고 재승격되고, 수율/F-30/barren 조건은
 *   전부 평생 카운터라 **다음 회차 시작에 한 번도 안 돌고 다시 은퇴**된다 — 승격 슬롯만 태우는 순환.
 *   실측 좀비 5(재테크 hits 260 · 동작카페 124 · 감성카페 103 · 재테크블로그 56 · 중랑네일 49), 4개가
 *   카테고리 게이트 통과. 수율 은퇴가 도는 한 이 집합은 단조 증가한다.
 */
describe('은퇴↔승격 livelock 차단 — 즉시-재은퇴 클래스는 되살리지 않는다', () => {
  const promoteSrc = () => readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-keyword-promote.ts'), 'utf8')

  it('차단 조각 = 은퇴 3문 전부의 부정 — 하나라도 빠지면 그 클래스가 재승격 루프를 돈다', async () => {
    const { PROMOTE_NOT_RETIRABLE_SQL, AUTO_RETIRE_WHERE } = await import('@/features/marketing/api/influencer-keyword-rotation')
    expect(PROMOTE_NOT_RETIRABLE_SQL.startsWith('NOT (')).toBe(true)
    for (const [k, frag] of Object.entries(AUTO_RETIRE_WHERE)) {
      expect(PROMOTE_NOT_RETIRABLE_SQL, `은퇴 조각 '${k}' 이 차단에서 빠졌다`).toContain(frag)
    }
  })

  it('승격 후보 쿼리가 차단 조각을 배선한다 — 순수함수만 테스트하면 이 클래스를 못 잡는다', () => {
    // 조각이 존재해도 쿼리에 안 실리면 무의미(이 레포가 반복해 겪은 "가드가 있는데 안 돎").
    expect(promoteSrc()).toMatch(/active = 0 AND hits >= \? AND \$\{PROMOTE_NOT_RETIRABLE_SQL\} AND keyword IN/)
  })

  it('🕊️ 가석방 — 은퇴 증거는 낡는다(대표 확정 2026-08-09 "영구 배제가 되면 안된다")', async () => {
    const { AUTO_RETIRE_WHERE, RETIRE_EVIDENCE_FRESH_DAYS } = await import('@/features/marketing/api/influencer-keyword-rotation')
    // 세 조각 전부 신선도 절이 있어야 한다 — 하나라도 빠지면 그 클래스는 다시 영구 배제가 된다.
    const fresh = `last_run_at IS NOT NULL AND last_run_at >= datetime('now','-${RETIRE_EVIDENCE_FRESH_DAYS} days')`
    for (const [k, frag] of Object.entries(AUTO_RETIRE_WHERE)) {
      expect(frag, `은퇴 조각 '${k}' 에 증거 유통기한이 없다 — 차단이 영구가 된다`).toContain(fresh)
    }
    // 창의 범위: 0/음수면 은퇴 자체가 꺼지고(모든 증거가 '낡음'), 과대하면 사실상 영구 배제로 회귀.
    expect(RETIRE_EVIDENCE_FRESH_DAYS).toBeGreaterThanOrEqual(7)
    expect(RETIRE_EVIDENCE_FRESH_DAYS).toBeLessThanOrEqual(90)
  })

  it('조각은 NULL-안전(COALESCE) — bare 비교면 NOT() 3치 논리가 신선 후보 전체를 승격에서 조용히 뺀다', async () => {
    // 미실행 후보는 found/saved/barren 이 NULL 일 수 있다. bare `found_total >= 50` 은 NULL 을 내고
    // `NOT(NULL OR …)` = NULL = 제외 — 차단 가드가 정반대(신선 큐 전멸)로 뒤집힌다.
    // (f30 의 last_run_at 은 `IS NOT NULL` 선행 AND 가 단락시켜 NULL-안전 — 카운터 3컬럼만 검사한다.)
    const { AUTO_RETIRE_WHERE } = await import('@/features/marketing/api/influencer-keyword-rotation')
    for (const frag of Object.values(AUTO_RETIRE_WHERE)) {
      for (const m of frag.matchAll(/\b(found_total|saved_total|barren_streak)\b/g)) {
        const before = frag.slice(Math.max(0, (m.index || 0) - 9), m.index)
        expect(before, `${frag} :: ${m[1]} 이 COALESCE 밖에 있다`).toContain('COALESCE(')
      }
    }
  })
})
