/**
 * 💬 2026-07-19 카카오채널 CS 자동응답 봇 — 카카오 i 오픈빌더 스킬 서버 (운영 자동화 백로그 ③).
 *
 * 카카오톡 채널 챗봇(오픈빌더)의 "스킬"이 POST 로 호출하는 webhook.
 * 유저 발화(utterance)를 FAQ SSOT(`features/cs/api/cs-faq.ts`)와 키워드 매칭해
 * 오픈빌더 v2.0 응답(simpleText + quickReplies)으로 답한다. **완전 read-only** —
 * DB 조회 0, 개인정보 접근 0, 정적 FAQ 텍스트만 반환.
 *
 * 🔒 게이트(기본 OFF — 머지 = 라이브 무접촉):
 *   env `KAKAO_SKILL_SECRET` 미설정 → 404 (봇 비활성).
 *   설정 시 → 요청 헤더 `x-skill-secret` 일치해야 응답 (오픈빌더 스킬 설정에서 커스텀 헤더 등록).
 *
 * 활성 절차(대표 액션): ① 카카오 비즈니스 → 챗봇(오픈빌더) 생성 → 시나리오 폴백 블록에 스킬 연결
 *   ② 스킬 URL: https://live.ur-team.com/api/cs/kakao-skill + 헤더 x-skill-secret
 *   ③ env `KAKAO_SKILL_SECRET` 등록(같은 값) ④ 채널 챗봇 배포. "상담원 연결"은 오픈빌더의
 *   상담원 전환 블록으로 처리(봇은 폴백 안내만).
 */
import { Hono } from 'hono'
import type { Env } from '../types/env'
import { CS_FAQ_ENTRIES, CS_FAQ_FALLBACK, matchCsFaq } from '../../features/cs/api/cs-faq'

const app = new Hono<{ Bindings: Env }>()

type KakaoSkillPayload = {
  userRequest?: { utterance?: string }
}

/** 오픈빌더 v2.0 simpleText 응답 (+ FAQ 퀵리플라이). */
function skillResponse(text: string) {
  return {
    version: '2.0',
    template: {
      outputs: [{ simpleText: { text } }],
      quickReplies: CS_FAQ_ENTRIES.map(e => ({
        label: e.label,
        action: 'message',
        messageText: e.label,
      })),
    },
  }
}

app.post('/api/cs/kakao-skill', async (c) => {
  const secret = (c.env as Env & { KAKAO_SKILL_SECRET?: string }).KAKAO_SKILL_SECRET
  // 게이트: 시크릿 미설정 = 봇 비활성 (404 — 존재 자체 비노출).
  if (!secret) return c.json({ success: false, error: 'not found' }, 404)
  if (c.req.header('x-skill-secret') !== secret) {
    return c.json({ success: false, error: 'forbidden' }, 403)
  }

  try {
    // 페이로드 크기 방어 (오픈빌더 요청은 수 KB 수준).
    const raw = await c.req.text()
    if (raw.length > 64_000) return c.json(skillResponse(CS_FAQ_FALLBACK))
    let body: KakaoSkillPayload = {}
    try { body = JSON.parse(raw) as KakaoSkillPayload } catch { /* 폴백 응답 */ }

    const utterance = String(body?.userRequest?.utterance || '').slice(0, 500)
    const matched = matchCsFaq(utterance)
    return c.json(skillResponse(matched ? matched.answer : CS_FAQ_FALLBACK))
  } catch {
    // 어떤 오류든 봇은 항상 200 + 폴백 (오픈빌더가 5xx 면 "응답 없음" 노출).
    return c.json(skillResponse(CS_FAQ_FALLBACK))
  }
})

export default app
