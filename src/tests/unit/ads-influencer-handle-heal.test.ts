import { describe, it, expect } from 'vitest'
import { deriveNaverHandle, naverBlogUrl, NAVER_HANDLE_RE } from '@/features/marketing/api/influencer-handle-heal'
import { MAINT_PHASES, MAINT_SCHEDULE } from '@/features/marketing/api/influencer-maintenance'

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
 * 🔁 이 단계가 **정비 순환에 실제로 배정돼 있는가**.
 *   ⚠️ 2026-07-29: 균등 순환(`% 5`)이 가중 배정표(`MAINT_SCHEDULE`)로 바뀌면서, "정의돼 있다"와
 *   "돌기로 배정돼 있다"가 갈라졌다 — `MAINT_PHASES` 에만 있고 배정표에 없으면 **영원히 안 돈다.**
 *   그래서 여기선 배정표를 본다. cron 리터럴 ↔ 배정표의 전체 일치는 `ads-lane-cadence` 가 지킨다
 *   (한 불변식은 한 자리에서 — 두 곳에 두면 한쪽만 고쳐 놓고 지켜지는 줄 안다).
 */
describe("정비 단계 — 손상 핸들 복구('handle')가 실제로 배정돼 있다", () => {
  it('MAINT_PHASES 에 정의돼 있다', () => {
    expect(MAINT_PHASES).toContain('handle')
  })

  it('🔒 배정표에도 들어 있다 — 정의만 있고 배정이 없으면 조용히 한 번도 안 돈다', () => {
    expect(MAINT_SCHEDULE).toContain('handle')
  })
})
