/**
 * ✍ 2026-07-20 유어애즈 — 인플루언서 개인화 제안 초안 일괄 생성 (합법 반자동화).
 *   선택한 리드(최대 10명)의 공개 정보(이름·플랫폼·규모·소개글·수집 키워드)를 근거로
 *   유어딜 제휴 제안 초안을 Claude 1회 호출로 일괄 생성 → 리드 행(outreach_draft)에 저장.
 *
 *   ⚖️ [LEGAL] **생성만, 발송 없음** — 광고성 정보 전송은 정보통신망법상 사전 수신동의 필요.
 *   초안은 사람이 검토·수정 후 1건씩 직접 발송(mailto/복사)하며, 모든 초안에 수신거부 안내를 강제한다.
 *   자동 대량발송·자동 DM 기능은 구조적으로 없음(만들지 않는다 — 2026-07-20 대표 합의).
 */
import { callClaude, parseJsonLoose } from './claude-client'

export interface OutreachLeadInput {
  id: number
  name: string
  platform: string          // youtube | naver_blog | naver_cafe
  subscriber_count: number
  category: string | null
  source_keyword: string | null
  description: string | null
}

export interface OutreachDraft {
  subject: string  // 이메일 제목
  body: string     // 이메일 본문(수신거부 문구 포함)
  dm: string       // DM/쪽지용 짧은 버전(3~4문장)
}

export const OUTREACH_BATCH_MAX = 10
// 모든 이메일 초안 끝에 강제되는 수신거부 안내(법규) — 모델이 빠뜨려도 코드가 붙임.
export const OPT_OUT_LINE = '(더 이상 제안을 원치 않으시면 회신으로 알려주세요. 즉시 중단하겠습니다.)'

const PLATFORM_KO: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버 블로그', naver_cafe: '네이버 카페' }

/** 리드 1명 → 프롬프트에 넣을 컨텍스트 줄(순수 — 테스트 가능). */
export function leadContext(l: OutreachLeadInput): string {
  const plat = PLATFORM_KO[l.platform] || l.platform
  const size = l.platform === 'youtube' && l.subscriber_count > 0 ? ` (구독자 약 ${l.subscriber_count.toLocaleString()}명)` : ''
  const parts = [
    `- id ${l.id}: ${l.name} — ${plat}${size}`,
    l.category ? `  분야: ${l.category}` : '',
    l.source_keyword ? `  발굴 키워드: ${l.source_keyword}` : '',
    l.description ? `  채널 소개: ${l.description.slice(0, 200)}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}

export function outreachSystemPrompt(): string {
  return [
    '너는 유어딜(동네 맛집·카페·뷰티·네일·숙소 공동구매 딜 플랫폼)의 제휴 담당자다.',
    '각 인플루언서의 공개 정보(채널 성격·분야·규모)를 근거로 맞춤 제휴 제안 초안을 쓴다.',
    '사실을 지어내지 마라 — 주어진 정보에 없는 채널 콘텐츠·수치·성과를 언급하지 않는다.',
    '이모지 금지. 과장("최고", "대박") 금지. 정중하고 담백한 한국어. 스팸처럼 보이는 상투어를 피한다.',
    '제안 내용: 유어딜 딜 콘텐츠 제휴/공동 프로모션, 조건 협의 가능, 관심 있으면 회신 요청 — 구체적 금액은 약속하지 않는다.',
    `이메일 body 마지막 줄에 반드시 "${OPT_OUT_LINE}" 를 그대로 넣는다(수신거부 안내 — 법적 필수).`,
    '**아래 JSON만 출력**(코드펜스·설명 없이): {"drafts":[{"id":숫자,"subject":"이메일 제목(40자 이내)","body":"이메일 본문(300~500자, 인사→채널 언급 1문장→제안→회신 요청→수신거부 안내)","dm":"DM/쪽지용 3~4문장(150자 이내, 링크 없이 정중한 첫 인사+제안 한 줄+회신 유도)"}]}',
    '입력된 모든 id 에 대해 drafts 항목을 하나씩 만든다.',
  ].join(' ')
}

export function outreachUserPrompt(leads: OutreachLeadInput[]): string {
  return `아래 인플루언서들에게 보낼 유어딜 제휴 제안 초안을 각각 만들어줘.\n\n${leads.map(leadContext).join('\n')}`
}

/** 초안 일괄 생성 — 1회 호출로 최대 10명. 반환: id → draft 맵(누락 id 는 실패로 간주). */
export async function generateOutreachDrafts(
  apiKey: string | undefined, leads: OutreachLeadInput[],
): Promise<{ ok: boolean; drafts?: Map<number, OutreachDraft>; error?: string }> {
  const batch = leads.slice(0, OUTREACH_BATCH_MAX)
  if (!batch.length) return { ok: false, error: '초안을 만들 리드가 없습니다' }
  const r = await callClaude(apiKey, {
    system: outreachSystemPrompt(), user: outreachUserPrompt(batch),
    maxTokens: Math.min(4000, 400 * batch.length + 400), temperature: 0.7,
  })
  if (!r.ok || !r.text) return { ok: false, error: r.error === 'NOT_CONFIGURED' ? '초안 생성은 ANTHROPIC_API_KEY 설정 후 사용할 수 있습니다.' : (r.error || '생성 실패') }
  const parsed = parseJsonLoose<{ drafts?: Array<{ id?: unknown; subject?: unknown; body?: unknown; dm?: unknown }> }>(r.text)
  if (!parsed?.drafts?.length) return { ok: false, error: '초안 결과를 해석하지 못했습니다. 다시 시도해주세요.' }
  const valid = new Set(batch.map(l => l.id))
  const map = new Map<number, OutreachDraft>()
  for (const d of parsed.drafts) {
    const id = Number(d.id)
    if (!valid.has(id) || map.has(id)) continue // 모델이 지어낸/중복 id 무시
    const subject = String(d.subject || '').trim().slice(0, 100)
    let body = String(d.body || '').trim().slice(0, 2000)
    const dm = String(d.dm || '').trim().slice(0, 500)
    if (!subject || !body) continue
    if (!body.includes(OPT_OUT_LINE)) body = `${body}\n\n${OPT_OUT_LINE}` // 법규 문구 코드 강제
    map.set(id, { subject, body, dm })
  }
  if (!map.size) return { ok: false, error: '유효한 초안이 생성되지 않았습니다. 다시 시도해주세요.' }
  return { ok: true, drafts: map }
}
