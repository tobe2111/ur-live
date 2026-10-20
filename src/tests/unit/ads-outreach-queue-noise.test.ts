import { describe, it, expect } from 'vitest'
import { buildSendQueueWhere, OUTREACH_NOISE_WORDS, SEND_QUEUE_ORDER_BY } from '@/features/marketing/api/outreach-queue'

/**
 * 🧹 2026-07-29 — **화면에서 숨긴 사람이 발송 큐에는 나오던** 모순의 회귀 방지.
 *
 *   목록 API 는 `hideNoise=1` 로 뉴스·방송·체험단모집·대행사를 걸렀는데, 발송 큐는 `is_brand` 만 걸렀다.
 *   저장 시점 `isLikelyNoise` 는 **신규 저장분만** 막으므로 기존 풀(실측 ~43명)에는 그대로 남아 있다.
 *   규모는 작지만 **하루 N명이 상한인 수동 발송에서 그 한 자리가 곧 손실**이다
 *   (뉴스 계정에 제휴 제안을 보내는 건 순수 낭비).
 */
describe('buildSendQueueWhere — 이름 기반 노이즈를 큐에서 제외한다', () => {
  it('🔒 노이즈 단어마다 NOT LIKE 조건과 바인드가 붙는다', () => {
    const { where, binds } = buildSendQueueWhere(0)
    for (const w of OUTREACH_NOISE_WORDS) expect(binds).toContain(`%${w}%`)
    const notLikeCount = (where.match(/name NOT LIKE \?/g) || []).length
    expect(notLikeCount).toBe(OUTREACH_NOISE_WORDS.length)
  })

  it('WHERE 의 ? 개수와 바인드 개수가 일치한다(D1 바인딩 오류 방지)', () => {
    for (const platform of [undefined, 'youtube', 'naver_blog', '침입시도']) {
      const { where, binds } = buildSendQueueWhere(0, platform)
      expect((where.match(/\?/g) || []).length).toBe(binds.length)
    }
  })

  it('기존 선별 규칙은 그대로 유지된다(연락 가능·미접촉·바운스/브랜드 제외)', () => {
    const { where } = buildSendQueueWhere(0)
    expect(where).toContain("status = 'new'")
    expect(where).toContain('contacted_at IS NULL')
    expect(where).toContain("url LIKE 'http%'")   // 스킴 있는 url 만 = pickReach 와 같은 기준
    expect(where).toContain("NOT IN ('bounced','complained')")
    expect(where).toContain('COALESCE(is_brand, 0) = 0')
    expect(where).toContain("platform != 'naver_cafe'")
  })

  it('플랫폼 필터는 허용목록만 통과시킨다(임의 문자열 무시)', () => {
    expect(buildSendQueueWhere(0, 'youtube').where).toContain('platform = ?')
    expect(buildSendQueueWhere(0, "'; DROP TABLE--").where).not.toContain('platform = ?')
  })

  it('프리필 전용 옵션은 빈 초안만 고른다(사람이 손본 초안 보호)', () => {
    expect(buildSendQueueWhere(0, undefined, { onlyWithoutDraft: true }).where).toContain('outreach_draft')
    expect(buildSendQueueWhere(0).where).not.toContain('outreach_draft')
  })

  it('정렬은 미채점을 후순위로 둔다 — 저장 시점 채점과 짝을 이룬다', () => {
    expect(SEND_QUEUE_ORDER_BY).toContain('(lead_score IS NULL) ASC')
  })
})
