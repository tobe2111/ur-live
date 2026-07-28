import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { deriveNaverHandle, naverBlogUrl, NAVER_HANDLE_RE } from '@/features/marketing/api/influencer-handle-heal'
import { MAINT_PHASES } from '@/features/marketing/api/influencer-maintenance'

/**
 * 🩹 2026-07-28 — 네이버 블로거 핸들 복구의 불변식 잠금.
 *
 *   실측 배경(어드민 API 로 라이브 행 직접 조회): 블로거 28,049명 중 **약 12,357명**이
 *   `handle='blog.naver.com'` · `channel_id='blog.naver.com/zq333'` 형태로 저장돼 있었다.
 *   네이버 검색 API 가 `bloggerlink` 를 스킴 없이 주는데, `ensureScheme()`(F-22) 이전 파서가
 *   `^https?://…blog\.naver\.com/` 로만 잘라내 **호스트가 핸들 자리에 남은** 레거시다.
 *
 *   ⚠️ 이게 왜 잠글 가치가 있나: 보강 레인은 형식 밖 핸들을 **측정 없이 스탬프만 찍고 넘긴다**.
 *   선택 순서가 미측정 우선이라 큐 앞머리가 통째로 이 행들이었고, 결과적으로 **정상 블로거 15,692명은
 *   한 번도 차례가 오지 않았다**(라운드마다 `naver.tried:0`). 파싱 규칙이 약해지면 그 정지 상태로 돌아간다.
 */
describe('deriveNaverHandle — 저장된 행에서 진짜 블로그 id 복구', () => {
  it('① 라이브에서 관측된 손상 형태를 살린다 (스킴 없음 → 호스트가 핸들 자리)', () => {
    expect(deriveNaverHandle({ handle: 'blog.naver.com', channel_id: 'blog.naver.com/zq333', url: 'blog.naver.com/zq333' })).toBe('zq333')
    expect(deriveNaverHandle({ handle: 'blog.naver.com', channel_id: 'blog.naver.com/jabby-', url: 'blog.naver.com/jabby-' })).toBe('jabby-')
    expect(deriveNaverHandle({ handle: 'blog.naver.com', channel_id: 'blog.naver.com/narmi750001', url: null })).toBe('narmi750001')
  })

  it('② 정상 행은 그대로 반환한다 — 쓸데없는 write 를 만들지 않는다', () => {
    expect(deriveNaverHandle({ handle: 'kimswaaa', channel_id: 'https://blog.naver.com/kimswaaa', url: 'https://blog.naver.com/kimswaaa' })).toBe('kimswaaa')
    expect(deriveNaverHandle({ handle: 'tae_kim_', channel_id: 'https://blog.naver.com/tae_kim_', url: null })).toBe('tae_kim_')
  })

  it('③ 표기 변형(m. 서브도메인 · http · 포스트 링크)도 흡수한다', () => {
    expect(deriveNaverHandle({ handle: null, channel_id: 'https://m.blog.naver.com/citytable', url: null })).toBe('citytable')
    expect(deriveNaverHandle({ handle: '', channel_id: 'http://blog.naver.com/dollwoo', url: null })).toBe('dollwoo')
    expect(deriveNaverHandle({ handle: 'blog.naver.com', channel_id: 'https://blog.naver.com/PostView.naver?blogId=sb3858&logNo=1', url: null })).toBe('sb3858')
    expect(deriveNaverHandle({ handle: null, channel_id: 'https://blog.naver.com/nonelily/223456789', url: null })).toBe('nonelily')
  })

  it('④ 어디서도 못 뽑으면 null — 허위 핸들로 fetch 를 낭비하지 않는다', () => {
    expect(deriveNaverHandle({ handle: 'blog.naver.com', channel_id: 'blog.naver.com', url: 'blog.naver.com' })).toBeNull()
    expect(deriveNaverHandle({ handle: null, channel_id: null, url: null })).toBeNull()
    expect(deriveNaverHandle({ handle: 'blog.naver.com', channel_id: 'https://cafe.naver.com/somecafe', url: null })).toBeNull()
    // 한글 id 는 RSS/모바일홈이 받지 않는다 — 살릴 수 없으면 살리지 않는 것이 맞다.
    expect(deriveNaverHandle({ handle: null, channel_id: 'https://blog.naver.com/한글아이디', url: null })).toBeNull()
  })

  it('⑤ 복구값은 보강 레인이 쓰는 형식 규칙을 항상 만족한다(불일치 = 다시 스킵된다)', () => {
    for (const cid of ['blog.naver.com/zq333', 'https://m.blog.naver.com/citytable', 'https://blog.naver.com/nonelily/22345']) {
      const h = deriveNaverHandle({ handle: 'blog.naver.com', channel_id: cid, url: null })
      expect(h, cid).not.toBeNull()
      expect(NAVER_HANDLE_RE.test(h as string), cid).toBe(true)
      expect(naverBlogUrl(h as string)).toBe(`https://blog.naver.com/${h}`)
    }
  })
})

/**
 * 🔁 정비 단계 순환의 이중 정의 잠금.
 *   ur-ads cron 은 `hourUTC % PHASES.length` 로 단계를 고르는데, 그 배열이 소스에 **리터럴로 복제**돼 있다
 *   (워커 번들에 정적 import 를 안 넣으려는 의도적 중복). 한쪽에만 단계를 추가하면 새 단계가 **영원히
 *   실행되지 않는다** — 조용한 실패라 관측조차 안 된다. 그래서 두 정의의 일치를 기계가 지킨다.
 */
describe('정비 단계 — MAINT_PHASES ↔ ur-ads cron 순환 배열 일치', () => {
  it('cron 의 PHASES 리터럴이 MAINT_PHASES 와 같은 순서·같은 개수다', () => {
    const src = readFileSync('src/worker-ads/index.ts', 'utf8')
    const m = /const PHASES = \[([^\]]+)\] as const/.exec(src)
    expect(m, 'ur-ads cron 의 PHASES 리터럴을 찾지 못했다').toBeTruthy()
    const literal = (m as RegExpExecArray)[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    expect(literal).toEqual(MAINT_PHASES)
  })

  it("손상 핸들 복구('handle')가 순환에 포함돼 있다", () => {
    expect(MAINT_PHASES).toContain('handle')
  })
})
