import { describe, it, expect } from 'vitest'
import { isUnjudgedRound, pickYtKeywords, ytCooldownMs } from '@/features/marketing/api/influencer-keyword-rotation'

/**
 * 🌵 2026-07-29 — **"물어보지도 않고 무수확으로 기록"** 회귀 방지.
 *
 *   라이브 실측(어드민 키워드 API): 활성 키워드 210개 중 62개가 `found_total = 0` 인데, 그 안에
 *   `먹방`·`홈카페`·`뷰티 유튜버`·`코스메틱 추천`·`맛집 브이로그` 가 들어 있었다. 한국에서 가장 많이
 *   검색되는 축들이 진짜로 0 일 리 없다 — 검색이 안 됐던 회차가 '고갈'로 기록된 것이다.
 *
 *   그 기록의 대가는 아래 두 테스트가 보여준다: 점수 −25/회 · 쿨다운 +6h/회 · auto 8회면 영구 비활성.
 *   즉 **잘 되는 키워드를 스스로 은퇴시키는** 자기강화 루프였다.
 */
describe('isUnjudgedRound — 이 회차 결과를 키워드 판정에 써도 되는가', () => {
  const ok = { budgetLeft: 20, searchedOk: 2, ytError: undefined, naverError: undefined }

  it('검색이 성공했고 예산도 남았으면 판정한다(정상 회차 — 고갈 계산이 돌아야 한다)', () => {
    expect(isUnjudgedRound(ok)).toBe(false)
  })

  it('🔒 검색이 한 번도 성공 못 했으면 무판정 — YT 쿼터 소진 + 네이버 실패 클래스', () => {
    expect(isUnjudgedRound({ ...ok, searchedOk: 0 })).toBe(true)
    // ⚠️ 이 경우 예산은 멀쩡하다(우리가 굶은 게 아니라 안 물어본 것) — #851 의 굶주림 조건만으론 못 잡는다.
    expect(isUnjudgedRound({ ...ok, searchedOk: 0, budgetLeft: 40 })).toBe(true)
  })

  it('예산이 바닥났거나 서브리퀘스트 한도를 봤으면 무판정(#851 조건 보존)', () => {
    expect(isUnjudgedRound({ ...ok, budgetLeft: 0 })).toBe(true)
    expect(isUnjudgedRound({ ...ok, ytError: 'Too many subrequests by single Worker invocation' })).toBe(true)
    expect(isUnjudgedRound({ ...ok, naverError: 'Too many subrequests by single Worker invocation' })).toBe(true)
  })

  it('한도가 아닌 평범한 오류는 판정을 막지 않는다(한쪽이 성공했다면 결과는 유효)', () => {
    expect(isUnjudgedRound({ ...ok, searchedOk: 1, naverError: 'HTTP 500' })).toBe(false)
    expect(isUnjudgedRound({ ...ok, searchedOk: 1, ytError: 'QUOTA: 오늘 YT 검색 예산 소진' })).toBe(false)
  })
})

describe('오염된 streak 의 대가 — 왜 무판정이 중요한가', () => {
  const base = { id: 1, keyword: '먹방', category: '푸드', saved_total: 500, last_saved: 0, last_run_at: null }

  it('streak 는 쿨다운을 6h 씩 벌린다 — 은퇴 문턱(8)이면 이미 54시간, 15면 상한 4일', () => {
    expect(ytCooldownMs({ ...base, barren_streak: 0 })).toBe(6 * 3600 * 1000)
    expect(ytCooldownMs({ ...base, barren_streak: 8 })).toBe(54 * 3600 * 1000) // 6h + 8×6h
    expect(ytCooldownMs({ ...base, barren_streak: 15 })).toBe(4 * 24 * 3600 * 1000) // 상한(6h+15×6h=96h)
  })

  it('🔒 streak 가 쌓이면 우선 카테고리 키워드가 무명 키워드에 밀린다', () => {
    const now = Date.parse('2026-07-29T00:00:00Z')
    const ranLongAgo = '2026-07-01 00:00:00' // 둘 다 쿨다운은 지난 상태
    // 점수: (last_saved 0)×3 + min(saved_total,100) + 우선카테고리 50 − streak×25
    //   → streak 6 이면 100 + 50 − 150 = 0 으로, 성과가 1/100 인 무명 키워드(5점)에게도 진다.
    const good = { ...base, id: 1, barren_streak: 6, last_run_at: ranLongAgo }       // 오염된 우량 키워드
    const meh = { id: 2, keyword: '기타태그', category: null, saved_total: 5, last_saved: 0, barren_streak: 0, last_run_at: ranLongAgo }
    const picks = pickYtKeywords([good, meh], 1, now)
    expect(picks[0].id).toBe(2) // ← 오염이 우량 키워드를 밀어낸다(이 역전이 실제로 라이브에서 벌어졌다)
    // 오염이 없었다면 우량 키워드가 이긴다
    expect(pickYtKeywords([{ ...good, barren_streak: 0 }, meh], 1, now)[0].id).toBe(1)
  })
})

/**
 * 🍽️ **기록용 예약분** — 2026-07-29 라이브 실측.
 *
 *   증상: 어드민 수집 진단(`run`)이 05:00 에 멈춰 있는데 리드는 08:00 에도 저장되고 있었다.
 *   레인은 도는데 *자기 기록만* 못 남긴 것 — 발굴 루프가 예산을 0 까지 쓰고, 그 뒤의 D1 쓰기
 *   (키워드 성과·학습상한·스냅샷·리스 해제)가 플랫폼 한도에 걸려 `.catch(() => null)` 로 사라졌다.
 *   실측: `spent 55 = budget_total 55` · `limit_hit: true` · 스냅샷은 3시간 전.
 *
 *   여기서 잠그는 것은 **회계 항등식**이다 — 예약분을 도입해도 밖으로 보고하는 `spent` 와
 *   AIMD 가 학습하는 값이 예전과 같은 의미(시작값 기준 총소비)로 남아야 한다. 안 그러면
 *   백오프가 실제보다 낮게 잡혀 다음 틱이 필요 이상으로 굶는다.
 */
describe('수집 예산 — 기록용 예약분 회계', () => {
  const RESERVE = 8
  const alloc = (budgetTotal: number) => Math.max(6, budgetTotal - RESERVE)
  const spentTotal = (budgetTotal: number, left: number) => (alloc(budgetTotal) - left) + RESERVE

  it('🔒 발굴 배정분은 항상 총예산보다 작다 — 후처리 쓰기 자리가 남는다', () => {
    for (const t of [40, 50, 55, 60]) expect(alloc(t)).toBeLessThan(t)
  })

  it('🔒 완전 소진 시 보고값 = 총예산 (예약분 도입 전과 동일한 회계)', () => {
    for (const t of [40, 50, 55, 60]) expect(spentTotal(t, 0)).toBe(t)
  })

  it('부분 사용도 시작값 기준으로 센다(백오프 방향 보존)', () => {
    expect(spentTotal(55, 47)).toBe(8)   // 발굴 0 + 예약 8
    expect(spentTotal(55, 20)).toBe(35)  // 27 + 8
  })

  it('예산이 아주 작아도 발굴 몫이 음수가 되지 않는다', () => {
    expect(alloc(10)).toBe(6)
    expect(alloc(0)).toBe(6)
  })
})
