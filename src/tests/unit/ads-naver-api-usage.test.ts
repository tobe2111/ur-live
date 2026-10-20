/**
 * 📟 **네이버 오픈API 일일 호출 계측** (2026-08-03 — 대표 질문 *"무료 한도 안에서 쓰고 있는 게 맞나"*).
 *
 * 유튜브(`ads_yt_*`)·카카오(`day_lookups`)는 일별 실사용을 세는데 **네이버만 카운터가 없었다.**
 * 그래서 "한도 안"이라는 답이 측정이 아니라 추정이었다. 추정으로 답하는 자리는 언젠가 틀린다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 실제 호출이 정말 다 세어지는지(런타임). 여기서는 ① 판정 규칙
 *   ② 세 개 fetch 래퍼에 계측이 달려 있는지(배선) ③ 콜마다 D1 을 쓰지 않는지(예산)만 고정한다.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  noteNaverCall, takeNaverCalls, pendingNaverCalls, __resetNaverCallMeter,
  kstDayKey, parseNaverUsed, NAVER_DAILY_QUOTA_CALLS, NAVER_USED_KEY,
} from '@/features/marketing/api/naver-api-usage'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/**
 * 💬 주석을 지운다 — **배선은 코드에서만 판정한다.**
 *   이 헬퍼는 자기 검증에서 태어났다: 래퍼의 `noteNaverCall(url)` 을 **주석 처리**하는 주입을 넣었더니
 *   문자열은 그대로 남아 **초록불**이 떴다. 계측이 죽었는데 가드는 통과 — CLAUDE.md 가
 *   `check-lock-table-symbols` 에 대해 적어 둔 *"주석에만 남아도 통과"* 그 함정이다.
 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const WRAPPERS = [
  'src/features/marketing/api/fetch-with-err.ts',      // 인플루언서 발굴(블로그·카페 검색)
  // 🚚 2026-08-22: B2B 수집의 fetch 래퍼(`laneFetch`)가 `webkr-search.ts` 로 이사했다 —
  //   웹문서 전용 레인(`collect-webkr`)이 같은 함수를 쓰기 때문. company-collect 는 이제 그것을 import 만 한다.
  //   ⚠️ 경로만 옮겼다. 불변식은 그대로 — 네이버 레인의 모든 fetch 래퍼는 계측 게이트를 통과해야 한다.
  'src/features/marketing/api/webkr-search.ts',        // B2B 수집(지역·카카오·웹문서 공용 래퍼)
  'src/features/marketing/api/contact-enrich.ts',      // 연락처 보강(local/webkr)
]
const COLLECT = read('src/features/marketing/api/influencer-auto-collect.ts')
/**
 * 💬 주석을 지운 사본 — **호출 횟수는 코드에서만 센다.**
 *   처음엔 원본에서 셌다가 *"`takeNaverCalls()` 는 회차당 한 번"* 이라고 적은 **내 설명 주석**이
 *   두 번째로 잡혔다. `check-lock-table-symbols`·`check-guard-mutations` 가 경고하는 바로 그 함정
 *   (*"주석에만 남아도 통과"*)의 반대 방향이다 — 여기선 주석 때문에 **정상 코드가 빨간불**이 났다.
 */
const COLLECT_CODE = code(COLLECT)

beforeEach(() => __resetNaverCallMeter())

describe('무엇을 세는가 — 쿼터를 먹는 호출만', () => {
  it('🔒 오픈API 호출만 센다', () => {
    noteNaverCall('https://openapi.naver.com/v1/search/blog.json?query=x')
    expect(pendingNaverCalls()).toBe(1)
  })

  it('🔒 RSS·블로그 본문은 안 센다 — 쿼터를 안 먹는다(한도가 아니라 차단이 리스크인 축)', () => {
    noteNaverCall('https://rss.blog.naver.com/someone.xml')
    noteNaverCall('https://blog.naver.com/someone')
    noteNaverCall('https://dapi.kakao.com/v2/local/search/keyword.json')
    expect(pendingNaverCalls()).toBe(0)
  })

  it('🔒 문자열이 아니면 조용히 무시 — 호출부가 조건 없이 부를 수 있어야 한다', () => {
    for (const v of [null, undefined, 42, {}, new URL('https://openapi.naver.com/x')]) noteNaverCall(v)
    expect(pendingNaverCalls()).toBe(0)
  })
})

describe('가져가며 비운다 — 두 번 세지 않는다', () => {
  it('🔒 take 는 누적을 반환하고 0으로 만든다', () => {
    noteNaverCall('https://openapi.naver.com/a')
    noteNaverCall('https://openapi.naver.com/b')
    expect(takeNaverCalls()).toBe(2)
    expect(takeNaverCalls()).toBe(0) // 같은 회차에서 두 번 부르면 뒤가 0 — 그래서 호출은 1회여야 한다
  })
})

describe('기준일 — 네이버는 KST 자정 리셋 (유튜브의 PT 와 다르다)', () => {
  it('🔒 UTC 15:00 은 이미 다음날 KST 다', () => {
    expect(kstDayKey(Date.parse('2026-08-03T15:00:00Z'))).toBe('2026-08-04')
    expect(kstDayKey(Date.parse('2026-08-03T14:59:00Z'))).toBe('2026-08-03')
  })
})

describe('저장값 파싱 — 날짜가 다르면 0', () => {
  it('🔒 같은 날이면 누적을 잇는다', () => {
    expect(parseNaverUsed('2026-08-03:412', '2026-08-03')).toBe(412)
  })
  it('🔒 다른 날/깨진 값이면 0 — 추측하지 않는다', () => {
    expect(parseNaverUsed('2026-08-02:412', '2026-08-03')).toBe(0)
    expect(parseNaverUsed('rubbish', '2026-08-03')).toBe(0)
    expect(parseNaverUsed(null, '2026-08-03')).toBe(0)
    expect(parseNaverUsed('2026-08-03:-5', '2026-08-03')).toBe(0)
  })
})

describe('🔌 배선 — 자동 레인의 fetch 래퍼 전부에 달려 있다', () => {
  for (const f of WRAPPERS) {
    it(`🔒 ${f.split('/').pop()} 이 계측한다`, () => {
      const src = code(read(f))
      expect(src, '래퍼에서 noteNaverCall 이 사라지거나 주석 처리되면 그 레인 호출이 통째로 계측 밖이 된다').toMatch(/noteNaverCall\(url\)/)
    })
  }

  it('🔒 수집 레인이 기존 batch 에 얹는다 — 계측 때문에 서브리퀘스트가 늘면 안 된다', () => {
    // 읽기는 이미 있는 SETTING_KEYS 로, 쓰기는 이미 있는 writeSettings batch 로 → 추가 왕복 0.
    expect(COLLECT).toMatch(/SETTING_KEYS = \[[^\]]*NAVER_USED_KEY/)
    expect(COLLECT).toMatch(/\[NAVER_USED_KEY, `\$\{naverDay\}:\$\{naverCalls\}`\]/)
    // 별도 flush(읽기1+쓰기1)를 이 레인에서 쓰면 예산 이득이 사라진다.
    expect(COLLECT).not.toMatch(/flushNaverCalls\(/)
  })

  it('🔒 회차당 take 는 정확히 한 번 — 두 번이면 뒤가 0이라 조용히 과소계상된다', () => {
    expect((COLLECT_CODE.match(/takeNaverCalls\(\)/g) || []).length).toBe(1)
  })

  it('🔒 상태줄에 노출된다 — 안 보이면 계측해도 판정에 못 쓴다', () => {
    // ⚠️ 닫는 중괄호까지 고정하지 않는다 — 2026-08-04 에 `target`/`left`(90% 목표·잔량)를 더하면서
    //   이 시험이 깨졌다. 지키려는 건 **노출 여부**지 필드 개수가 아니다.
    expect(COLLECT).toMatch(/naver_api: \{ used: naverCalls, total: NAVER_DAILY_QUOTA_CALLS, day: naverDay/)
  })

  /**
   * 🧺 쿼터는 **앱 단위**라 B2B 몫도 같은 통에 들어가야 총계가 의미를 갖는다.
   *   B2B 레인은 settings batch 가 없어 `flushNaverCalls`(읽기1+쓰기1)를 쓴다 — 누적 0이면 왕복도 0.
   *   여기서 안 비우면 그 인보케이션의 누적은 **그대로 사라진다**(아이솔레이트가 달라 다른 레인이 못 걷어간다).
   */
  it('🔒 B2B 레인도 자기 회차 끝에 비운다 — 안 그러면 그 몫이 유실된다', () => {
    expect(code(read('src/features/marketing/api/company-collect.ts'))).toMatch(/await flushNaverCalls\(DB, Date\.now\(\)\)/)
  })
})

describe('상수', () => {
  it('🔒 네이버 공표 기본 한도 + 키 이름', () => {
    expect(NAVER_DAILY_QUOTA_CALLS).toBe(25_000)
    expect(NAVER_USED_KEY).toBe('ads_naver_api_used')
  })
})
