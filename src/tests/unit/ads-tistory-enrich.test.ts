/**
 * 📗 **티스토리 측정 경로 신설** (2026-08-03 — 대표 *"다 해줘"*).
 *
 * 495행 전부가 미측정이었고 **측정 경로가 아예 없었다**. 유입은 ~216/일이라 두면 못 쓰는 행만 쌓인다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 티스토리 RSS·홈이 실제로 무엇을 주는지. 이 환경은 `tistory.com` 이
 *   프록시 CONNECT 403 이라 실물 응답을 한 번도 못 봤다 — 그건 **라이브 diag** 로만 판정된다
 *   (`measured` 0 → RSS 경로 오류 · `contacts` 0 → 홈에 연락처 없음 ⇒ 경로를 접을 것).
 *   여기서 고정하는 건 ① 핸들 도출 ② 낭비 방지 ③ 배선(네이버 무접촉·몫 제한·진단 노출)뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deriveTistoryHandle, tistoryHomeUseful } from '@/features/marketing/api/influencer-tistory-performance'
import { TISTORY_ROOM, tistoryRoom } from '@/features/marketing/api/influencer-tistory-performance'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** 💬 주석 제거 — 배선은 코드에서만 판정한다(주석 처리해도 초록이 뜨던 함정, 같은 날 두 번 밟았다). */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const TIS = read('src/features/marketing/api/influencer-tistory-performance.ts')
const LANE = read('src/features/marketing/api/influencer-enrich-lane.ts')
const NAVER = read('src/features/marketing/api/influencer-performance.ts')

describe('핸들 도출 — handle 이 깨져도 url 에서 되살린다', () => {
  it('🔒 정상 핸들은 그대로', () => {
    expect(deriveTistoryHandle({ handle: 'zomzom', url: 'https://zomzom.tistory.com' })).toBe('zomzom')
    expect(deriveTistoryHandle({ handle: 'AllMightyPapa', url: null })).toBe('allmightypapa')
  })

  it('🔒 핸들이 없거나 쓰레기면 url 서브도메인에서 되살린다', () => {
    expect(deriveTistoryHandle({ handle: null, url: 'https://indp.tistory.com/123' })).toBe('indp')
    expect(deriveTistoryHandle({ handle: 'tistory.com', url: 'https://sdjoon.tistory.com' })).toBe('sdjoon')
    // 호스트가 통째로 handle 에 들어간 손상 형태 — 네이버에서 실제로 났던 클래스다.
    expect(deriveTistoryHandle({ handle: 'tistory', url: 'https://gyungchin.tistory.com' })).toBe('gyungchin')
  })

  it('🔒 어디에도 없으면 null — 측정 불가를 "빈 문자열"로 위장하지 않는다', () => {
    expect(deriveTistoryHandle({ handle: null, url: null })).toBeNull()
    expect(deriveTistoryHandle({ handle: '', url: 'https://blog.naver.com/someone' })).toBeNull()
    expect(deriveTistoryHandle({ handle: 'a', url: null })).toBeNull() // 1자는 티스토리 서브도메인이 아니다
  })
})

describe('홈 fetch 낭비 방지', () => {
  it('🔒 연락처 3종이 다 차 있으면 홈을 안 받는다', () => {
    expect(tistoryHomeUseful({ email: 'a@b.com', instagram: 'x', links: 'https://y' })).toBe(false)
  })
  it('🔒 하나라도 비면 받는다', () => {
    expect(tistoryHomeUseful({ email: 'a@b.com', instagram: 'x', links: null })).toBe(true)
    expect(tistoryHomeUseful({})).toBe(true)
  })
})

describe('🔌 배선', () => {
  it('🔒 네이버 경로를 안 건드린다 — 백로그 20,264행을 가는 가장 값진 레인이다', () => {
    expect(code(NAVER)).not.toMatch(/tistory/i)
  })

  it('🔒 레인이 티스토리를 부르고, 블로거보다 **먼저** 작은 몫만 쓴다', () => {
    const c = code(LANE)
    // 2026-08-04: 몫이 상수 → `tistoryRoom(env)`(기본 0, env 로 복원) 로 바뀌었다. 호출 형태를 따라간다.
    expect(c).toMatch(/enrichTistoryActivity\(DB, budget, tisRoom, slice(, env)?\)/)   // env 는 2026-09-03 재측정 주기용(선택)
    /**
     * 순서가 뒤집히면 블로거가 잔여를 다 가져가 티스토리는 영원히 0이 된다(`naverRoomFromRemaining` 이 전부를 쓴다).
     * ⚠️ **호출부로 앵커한다** — 처음엔 `indexOf('enrichTistoryActivity')` 로 썼는데 그게 맨 위 **import 문**을
     *   먼저 찾아, 순서를 실제로 뒤집는 주입에도 초록이 떴다(import 는 언제나 첫 번째다).
     */
    expect(c.indexOf('enrichTistoryActivity(DB, budget')).toBeGreaterThan(-1)
    expect(c.indexOf('enrichTistoryActivity(DB, budget')).toBeLessThan(c.indexOf('enrichNaverActivity(DB, budget'))
  })

  /**
   * 📉 **2026-08-04: 이 경로를 접었다** — 어제 이 파일이 지키던 "작은 몫이라도 돌려라"가 뒤집혔다.
   *   표본이 397건으로 커지자 이메일 수율 **3.0%**(네이버 26.7% · 유튜브 40.6%). 최근 3일 325행 → 0건.
   *   측정은 정상 동작하고(393/397 글 수 획득) 티스토리 블로거가 연락처를 안 거는 것이라 코드로 못 고친다.
   *   ⇒ 테스트도 방향을 바꾼다: 이제 지킬 것은 "돌 것"이 아니라 **"몰래 되살아나지 말 것"** 이다.
   */
  it('🔒 기본은 0 — 되살리려면 근거와 함께 명시적으로', () => {
    expect(TISTORY_ROOM, '되살리려면 수율이 왜 올랐는지 근거가 먼저다(env ADS_TISTORY_ROOM)').toBe(0)
    expect(tistoryRoom(undefined)).toBe(0)
    expect(tistoryRoom({})).toBe(0)
  })

  it('🔒 env 로는 되살아난다 — 삭제가 아니라 접은 것이다(가역)', () => {
    expect(tistoryRoom({ ADS_TISTORY_ROOM: '2' })).toBe(2)
    expect(tistoryRoom({ ADS_TISTORY_ROOM: '99' })).toBe(5)   // 런어웨이 방지
  })

  it('🔒 0 이면 아예 안 부른다 — 몫만 0 이고 호출은 도는 형태면 D1 왕복이 남는다', () => {
    expect(code(LANE)).toMatch(/if \(tisRoom > 0\) \{/)
  })

  it('🔒 스냅샷에 진단이 실린다 — 프록시 차단 환경에선 이게 유일한 판정 근거다', () => {
    expect(code(LANE)).toMatch(/^\s*tistory,$/m)
  })

  it('🔒 누적 집계에도 합산 — 두 레인을 같은 눈으로 읽는다', () => {
    const c = code(LANE)
    expect(c).toMatch(/total_measured:.*\+ tistory\.measured/)
    expect(c).toMatch(/total_contacts:.*\+ tistory\.contacts/)
  })
})

describe('스탬프 규칙 — 네이버와 같아야 한다(갈라지면 조용히 어긋난다)', () => {
  it('🔒 둘 다 실패면 데이터 없이 스탬프만(0 각인 금지)', () => {
    expect(TIS).toMatch(/rssXml === null && homeText === null/)
    expect(TIS).toMatch(/diag\.failed\+\+/)
  })

  it('🔒 404/410 은 "측정 성공·글 0"(터미널) — 재시도 루프에 가두지 않는다', () => {
    expect(TIS).toMatch(/res\.status === 404 \|\| res\.status === 410/)
  })

  it('🔒 글 본문은 연락처로 쓰지 않는다 — 남의 연락처가 섞여 발송 대상이 오염된다', () => {
    // 소개글(rssIntro)로만 보강하고 rssBody 는 분류에만 쓴다.
    expect(TIS).toMatch(/if \(rssIntro && \(!emailAfter \|\| !instaAfter\)\)/)
    expect(TIS).toMatch(/classifyCategoryByHits\(rssBody\)/)
    expect(TIS).not.toMatch(/pickBusinessEmail\(rssBody\)/)
  })

  it('🔒 창을 못 주면 안 집는다 — 집고 실패하면 스탬프가 찍혀 큐 뒤로 밀린다', () => {
    expect(TIS).toMatch(/canStartBudgetedItem\(budget\.deadline\)/)
    expect(TIS).toMatch(/window_skipped/)
  })

  it('🔒 조회 실패를 삼키지 않는다 — selected:0 이 "큐가 빔"을 확정해야 한다', () => {
    expect(TIS).toMatch(/diag\.query_error =/)
  })
})

/**
 * 🪓 **축을 접으려면 둘 다 접어야 한다** (2026-08-04 라이브 판정에서 드러난 반쪽 상태).
 *
 * 측정 몫만 0 으로 했더니 라이브가 이렇게 됐다:
 * ```
 *   enrich  tistory.tried 0            ← 측정은 멈춤
 *   collect spend_by.tistory 5 · found 17 · saved 7   ← 수집은 계속
 * ```
 * **영원히 측정 안 될 행을 회차당 5 서브리퀘스트 써서 쌓는 상태**다. 접기 전보다 나쁘다.
 */
describe('🪓 수집도 같이 접혔나 — 반쪽이면 더 나쁘다', () => {
  const COLLECT = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('🔒 수집 기본값이 OFF — 되살리려면 명시적으로 false 를 줘야 한다', () => {
    expect(COLLECT).toMatch(/ADS_COLLECT_TISTORY_DISABLED\?: string \}\)\.ADS_COLLECT_TISTORY_DISABLED !== 'false'/)
  })

  it('🔒 OFF 면 발굴 호출 자체를 안 한다 — 몫만 0 이고 호출은 돌면 서브리퀘스트가 남는다', () => {
    expect(COLLECT).toMatch(/if \(hasKakao && !tistoryCollectOff\)/)
  })
})
