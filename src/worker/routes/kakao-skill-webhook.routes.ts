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
 *   ② 스킬 URL: https://urdeal.kr/api/cs/kakao-skill + 헤더 x-skill-secret
 *   ③ env `KAKAO_SKILL_SECRET` 등록(같은 값) ④ 채널 챗봇 배포. "상담원 연결"은 오픈빌더의
 *   상담원 전환 블록으로 처리(봇은 폴백 안내만).
 *
 * 🏪 2026-10-10 (대표 "카카오톡으로 유어딜 세팅도 가능해? 이용권 관리같은거" → "이상적으로 진행해줘"):
 *   **매장 관리 명령**을 얹었다 — 셀러 대시보드에서 받은 코드로 `연결 123456` 하면 오늘 판매·사용 대기·
 *   정산 확인, 이용권 사용 처리, 판매 중지/재개. 위의 "완전 read-only" 는 **연결 안 한 사람**에게만
 *   여전히 참이다(FAQ 는 종전 그대로). 연결·좌석·확인 모델: `utils/kakao-bot-store.ts` · 명령: `utils/kakao-bot-commands.ts`.
 *   게이트 둘: `KAKAO_SKILL_SECRET`(이 스킬 자체) + `KAKAO_BOT_STORE_OPS_ENABLED`/`kakao_bot_store_ops_enabled`
 *   (매장 관리, 기본 OFF — 꺼지면 연결·명령은 "준비 중").
 */
import { Hono } from 'hono'
import type { Env } from '../types/env'
import { CS_FAQ_ENTRIES, CS_FAQ_FALLBACK, matchCsFaq } from '../../features/cs/api/cs-faq'
import { isStoreOpsEnabled, hasBotLinkNoDdl, resolveLinkedSeat } from '../utils/kakao-bot-store'
import { parseStoreCommand, runLinkCommand, runStoreCommand, helpText, STORE_QUICK, type BotReply, type BotCtx } from '../utils/kakao-bot-commands'

const app = new Hono<{ Bindings: Env }>()

type KakaoSkillPayload = {
  userRequest?: { utterance?: string; user?: { id?: string; properties?: { botUserKey?: string } } }
}

export const STORE_OPS_NOT_READY = '카카오톡 매장 관리는 준비 중이에요. 곧 열어 드릴게요.'
export const STORE_SEAT_REVOKED = '이 매장을 관리할 권한이 없어져 채팅 연결을 끊었어요. 셀러 대시보드에서 매장을 확인해 주세요.'

/** 오픈빌더 v2.0 simpleText 응답. quick 미지정 = FAQ 퀵리플라이(종전), 빈 배열 = 퀵리플라이 없음. */
function skillResponse(text: string, quick?: readonly string[]) {
  const labels = quick ?? CS_FAQ_ENTRIES.map(e => e.label)
  return {
    version: '2.0',
    template: {
      outputs: [{ simpleText: { text } }],
      ...(labels.length ? {
        quickReplies: labels.slice(0, 10).map(label => ({ label, action: 'message', messageText: label })),
      } : {}),
    },
  }
}
const storeResponse = (r: BotReply) => skillResponse(r.text, r.quick)

/** 봇 사용자 키 — `user.id` 가 정식(채널·봇 단위 고유), 없으면 properties.botUserKey. */
function botUserKeyOf(body: KakaoSkillPayload): string | null {
  const raw = body?.userRequest?.user?.id || body?.userRequest?.user?.properties?.botUserKey
  const k = typeof raw === 'string' ? raw.trim() : ''
  return k && k.length <= 128 ? k : null
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
    const botUserKey = botUserKeyOf(body)
    const DB = c.env.DB

    // 🏪 매장 관리 — 응답 뒤에도 끝나야 할 일(원장·캐시)은 실행 컨텍스트에, 없으면 응답 전에 기다린다.
    const bg: Promise<unknown>[] = []
    const defer = (p: Promise<unknown>) => { try { c.executionCtx.waitUntil(p) } catch { bg.push(p) } }
    const done = async <T,>(v: T): Promise<T> => { if (bg.length) await Promise.allSettled(bg); return v }
    const ctx: BotCtx = { DB, env: c.env as unknown as BotCtx['env'], origin: new URL(c.req.url).origin, defer }

    const cmd = botUserKey && DB ? parseStoreCommand(utterance) : null
    let enabled: boolean | null = null
    if (cmd && botUserKey) {
      enabled = await isStoreOpsEnabled(c.env as { KAKAO_BOT_STORE_OPS_ENABLED?: string }, DB)
      if (!enabled) {
        // 꺼져 있으면 연결·명령은 "준비 중" — 단, 연결 안 한 사람의 FAQ 는 종전 그대로(DDL 없이 확인).
        if (cmd.kind === 'link' || await hasBotLinkNoDdl(DB, botUserKey)) {
          return c.json(skillResponse(STORE_OPS_NOT_READY))
        }
      } else if (cmd.kind === 'link') {
        return c.json(storeResponse(await runLinkCommand(DB, botUserKey, cmd.code)))
      } else {
        const r = await runStoreCommand(ctx, botUserKey, cmd)
        if ('revoked' in r) return c.json(skillResponse(STORE_SEAT_REVOKED))
        if (!('none' in r)) return c.json(storeResponse(await done(r)))
      }
    }

    const matched = matchCsFaq(utterance)
    if (matched) return c.json(skillResponse(matched.answer))

    // 연결된 사장님이 모르는 말을 보내면 FAQ 폴백 대신 명령 안내.
    if (botUserKey && DB) {
      if (enabled === null) enabled = await isStoreOpsEnabled(c.env as { KAKAO_BOT_STORE_OPS_ENABLED?: string }, DB)
      if (enabled) {
        const seat = await resolveLinkedSeat(DB, botUserKey)
        if (seat.kind === 'ok') return c.json(skillResponse(helpText(seat.seat.storeName), STORE_QUICK))
        if (seat.kind === 'revoked') return c.json(skillResponse(STORE_SEAT_REVOKED))
      }
    }
    return c.json(skillResponse(CS_FAQ_FALLBACK))
  } catch {
    // 어떤 오류든 봇은 항상 200 + 폴백 (오픈빌더가 5xx 면 "응답 없음" 노출).
    return c.json(skillResponse(CS_FAQ_FALLBACK))
  }
})

export default app
