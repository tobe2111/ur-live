import { describe, it, expect } from 'vitest'
import { buildSendQueueWhere, SEND_QUEUE_ORDER_BY, SEND_QUEUE_PLATFORMS } from '@/features/marketing/api/outreach-queue'
import { resolveBufferTarget } from '@/features/marketing/api/outreach-draft-prefill'

/**
 * ✍ 2026-07-29 초안 프리필 레인의 불변식 잠금.
 *
 *   실측 배경: 발송 가능 **22,533명**인데 접촉 0명이고, 큐 상위 표본 10명은 전원 초안이 없었다.
 *   병목이 수집이 아니라 **사람이 10명마다 AI 를 기다리는 것**이라, 상위 구간 초안을 미리 채운다.
 *
 *   여기서 고정하는 것:
 *     ① 큐와 프리필이 **같은 술어**를 쓴다 — 갈리면 프리필은 돌았는데 화면 상단은 계속 빈 초안이고,
 *        원인이 화면에서 안 보인다(가장 조용한 실패).
 *     ② 프리필은 **빈 초안만** 건드린다 — 사람이 손본 초안을 덮으면 작업물이 사라진다.
 *     ③ 재접촉 방지 조건(status/contacted_at)은 어떤 경로로도 빠지지 않는다 — 빠지면 이미 연락한
 *        사람에게 또 간다(되돌릴 수 없는 사고).
 *     ④ 버퍼 목표는 유한하고 상한이 있다 — 여기가 무한대면 22,533명 전량 AI 생성(=비용 폭주)이 된다.
 */
describe('발송 큐 선별 SSOT — 프리필과 큐가 갈리지 않는다', () => {
  it('① 큐와 프리필이 같은 기본 술어를 공유한다(플래그만 차이)', () => {
    const q = buildSendQueueWhere(0)
    const p = buildSendQueueWhere(0, undefined, { onlyWithoutDraft: true })
    // 프리필은 큐 술어를 **좁히기만** 한다 — 큐에 없는 사람에게 초안이 생기면 안 된다.
    expect(p.where.startsWith(q.where)).toBe(true)
    expect(p.binds).toEqual(q.binds)
  })

  it('② 프리필만 빈 초안 조건을 추가한다(사람이 손본 초안 보호)', () => {
    expect(buildSendQueueWhere(0).where).not.toContain('outreach_draft')
    expect(buildSendQueueWhere(0, undefined, { onlyWithoutDraft: true }).where)
      .toContain("(outreach_draft IS NULL OR outreach_draft = '')")
  })

  it('③ 재접촉 방지·도달채널·제외 조건은 모든 조합에서 유지된다', () => {
    for (const platform of [undefined, 'youtube', 'naver_blog', '', 'bogus', "'; DROP TABLE x--"]) {
      for (const onlyWithoutDraft of [false, true]) {
        const { where } = buildSendQueueWhere(0, platform, { onlyWithoutDraft })
        expect(where).toContain("status = 'new'")
        expect(where).toContain('contacted_at IS NULL')
        expect(where).toContain("(email IS NOT NULL OR instagram IS NOT NULL OR url LIKE 'http%')")
        expect(where).toContain("COALESCE(email_status,'') NOT IN ('bounced','complained')")
        expect(where).toContain('COALESCE(is_brand, 0) = 0')
        expect(where).toContain("platform != 'naver_cafe'")
      }
    }
  })

  it('③-2 허용목록 밖 플랫폼은 SQL 로 새지 않는다(바인드만 사용)', () => {
    // ⚠️ 2026-07-29: 정확 배열 비교(`toEqual([0])`)였는데 노이즈 필터가 바인드를 더하면서 깨졌다.
    //   이 테스트의 의도는 "바인드 개수"가 아니라 **플랫폼 값이 SQL 에 인라인되지 않는다**이므로,
    //   그 의도만 직접 검사하도록 바꾼다(선별 규칙이 늘어도 견딘다).
    const evil = "'; DROP TABLE ad_influencer_leads--"
    const bad = buildSendQueueWhere(0, evil)
    expect(bad.where).not.toContain('DROP')
    expect(bad.where).not.toContain('platform = ?') // 허용목록 밖 → 필터 자체가 안 붙는다
    expect(bad.binds).not.toContain(evil)           // 값도 바인드에 안 실린다
    expect(bad.binds[0]).toBe(0)                    // 풀 계정 id 는 항상 첫 바인드
    for (const p of SEND_QUEUE_PLATFORMS) {
      const ok = buildSendQueueWhere(0, p)
      expect(ok.where).toContain('platform = ?')
      expect(ok.binds).toContain(p) // 값은 항상 바인드로(문자열 보간 금지)
      expect(ok.binds.length).toBe(bad.binds.length + 1) // 플랫폼 바인드 정확히 1개 추가
    }
  })

  it('④ 버퍼 목표는 유한·상한 — 전량 생성(비용 폭주)이 구조적으로 불가하다', () => {
    for (const raw of [undefined, '', 'abc', '0', '-5', 'Infinity', '999999']) {
      const v = resolveBufferTarget(raw)
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(10)
      expect(v).toBeLessThanOrEqual(1000) // 22,533 전량은 어떤 입력으로도 불가
    }
    expect(resolveBufferTarget('250')).toBe(250)
  })

  it('⑤ 정렬은 사람이 먼저 만나는 상단과 같다(점수 높은 순, 미채점 후순위)', () => {
    expect(SEND_QUEUE_ORDER_BY).toContain('(lead_score IS NULL) ASC')
    expect(SEND_QUEUE_ORDER_BY).toContain('lead_score DESC')
  })
})
