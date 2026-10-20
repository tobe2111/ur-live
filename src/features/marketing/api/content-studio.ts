/**
 * 🆕 2026-07-02 유어애즈 — AI 콘텐츠 스튜디오.
 *   블로그 초안 · 인스타/틱톡 콘텐츠 · 광고 문구(네이버 검색광고 소재) · 댓글/리뷰 답변 초안 · 성과분석.
 *   전부 **초안 생성(읽기 전용) — 자동 게시 없음**(플랫폼 API 미연동). 사람이 검토 후 사용.
 *   자체 Claude 보유가 강점(한계비용 낮음). 미설정 시 NOT_CONFIGURED.
 *
 *   ⚠️ 서비스 분리: 소비자 블로그(`blog-ai.ts`)와 무관 — 유어애즈 광고주용 마케팅 콘텐츠 전용.
 *   ⚠️ 대표 피드백: 이모지/AI 티 나는 표현 배제(프롬프트에 명시).
 */
import { callClaude, parseJsonLoose } from './claude-client'

export type ContentType = 'blog' | 'instagram' | 'tiktok' | 'ad_copy'

export interface ContentInput {
  topic: string           // 주제/상품/키워드
  brand?: string          // 브랜드/상호
  audience?: string       // 타겟 고객
  tone?: string           // 톤(전문적/친근한/유쾌한 등)
  keywords?: string       // 강조 키워드(쉼표)
}

export interface AdCopyVariant { title: string; desc: string; titleLen: number; descLen: number; titleOk: boolean; descOk: boolean }
export interface GeneratedContent {
  type: ContentType
  title: string | null
  body: string            // 마크다운/텍스트 본문(사람이 읽는 결과)
  hashtags: string[]      // instagram/tiktok
  variants: AdCopyVariant[] // ad_copy
}

// 네이버 검색광고 소재 규격(사용자-가시 한도) — 제목 15자, 설명 45자.
export const AD_TITLE_MAX = 15
export const AD_DESC_MAX = 45

export const CONTENT_LABEL: Record<ContentType, string> = {
  blog: '블로그 초안', instagram: '인스타그램', tiktok: '틱톡', ad_copy: '광고 문구',
}

const BASE_RULES = [
  '너는 한국 중소상공인·브랜드를 돕는 실전 마케팅 카피라이터다.',
  '주어진 정보만 근거로 자연스럽고 구체적인 한국어 콘텐츠를 쓴다. 사실을 지어내지 마라(가격·수치·수상 등 미확인 정보 금지).',
  '이모지를 쓰지 마라. "~하세요!" 남발, 과장 광고("최고", "1위", "완벽") 같은 AI 티 나는 상투어를 피한다.',
  '광고 관련법(과장·허위 표시 금지)을 존중해 단정적 효능·최상급 표현은 피한다.',
].join(' ')

/** 타입별 시스템 프롬프트(순수 — 테스트 가능). */
export function systemPrompt(type: ContentType): string {
  const t: Record<ContentType, string> = {
    blog: '네이버/구글 SEO 블로그 초안을 쓴다. 출력은 마크다운: 첫 줄 "# 제목", 이어서 150자 내외 도입, ## 소제목 3~5개와 본문(총 700~1000자), 마지막 "## 태그" 줄에 쉼표로 5개. 핵심 키워드를 제목과 첫 문단에 자연스럽게 넣는다.',
    instagram: '인스타그램 피드 캡션을 쓴다. 출력: 첫 줄 훅(1문장), 3~5문장 캡션(줄바꿈 허용), 마지막 줄 CTA. 그 다음 빈 줄 후 "해시태그:" 줄에 관련 해시태그 12~15개(#포함, 공백구분). 캡션은 300자 이내.',
    tiktok: '틱톡 숏폼 대본을 쓴다. 출력 마크다운: "## 훅(0~3초)" 한 문장, "## 대본" 아래 3~5개 씬을 "- (초): 내용" 형식, "## 캡션" 한 줄, 마지막 "해시태그:" 줄에 8~12개(#포함). 첫 3초 훅이 스크롤을 멈추게.',
    ad_copy: '네이버 검색광고 소재(제목/설명)를 만든다. **반드시 아래 JSON만 출력**(설명·코드펜스 없이): {"variants":[{"title":"제목","desc":"설명"}]} — variants 4개. title 15자 이내, desc 45자 이내(한글 공백 포함 글자수). 검색 의도에 맞는 혜택·행동유도. 과장/최상급 금지.',
  }
  return `${BASE_RULES} ${t[type]}`
}

/** 입력 → 유저 메시지(순수). */
export function userPrompt(type: ContentType, input: ContentInput): string {
  const lines = [
    `주제/상품: ${input.topic}`,
    input.brand ? `브랜드/상호: ${input.brand}` : '',
    input.audience ? `타겟 고객: ${input.audience}` : '',
    input.tone ? `톤: ${input.tone}` : '',
    input.keywords ? `강조 키워드: ${input.keywords}` : '',
  ].filter(Boolean)
  return `아래 정보로 ${CONTENT_LABEL[type]} 콘텐츠를 만들어줘.\n${lines.join('\n')}`
}

const charLen = (s: string): number => [...s.trim()].length // 코드포인트 기준 글자수

/** ad_copy 변형 정규화 — 길이 계산 + 규격 통과 여부(초과분은 잘라 저장하되 flag). */
export function normalizeAdCopy(variants: Array<{ title?: unknown; desc?: unknown }>): AdCopyVariant[] {
  return (variants || []).slice(0, 8).map(v => {
    const title = String(v?.title || '').trim()
    const desc = String(v?.desc || '').trim()
    const titleLen = charLen(title), descLen = charLen(desc)
    return { title, desc, titleLen, descLen, titleOk: titleLen > 0 && titleLen <= AD_TITLE_MAX, descOk: descLen > 0 && descLen <= AD_DESC_MAX }
  }).filter(v => v.title || v.desc)
}

/** instagram/tiktok 본문에서 "해시태그:" 줄 추출 → [본문, 해시태그[]]. */
export function extractHashtags(text: string): { body: string; hashtags: string[] } {
  const m = text.match(/(?:^|\n)\s*해시태그\s*[:：]\s*(.+)$/i)
  if (!m) {
    const tags = (text.match(/#[^\s#]+/g) || []).slice(0, 20)
    return { body: text.trim(), hashtags: tags }
  }
  const tags = (m[1].match(/#?[^\s#,]+/g) || []).map(t => (t.startsWith('#') ? t : `#${t}`)).slice(0, 20)
  const body = text.slice(0, m.index).trim()
  return { body, hashtags: tags }
}

/** 블로그 본문 첫 "# 제목" 추출. */
export function extractTitle(text: string): { title: string | null; body: string } {
  const m = text.match(/^\s*#\s+(.+)$/m)
  return { title: m ? m[1].trim() : null, body: text.trim() }
}

/** 콘텐츠 생성 — 타입별 프롬프트 + 파싱/정규화. */
export async function generateContent(apiKey: string | undefined, type: ContentType, input: ContentInput): Promise<{ ok: boolean; content?: GeneratedContent; error?: string }> {
  if (!input.topic?.trim()) return { ok: false, error: '주제(상품/키워드)를 입력해주세요' }
  const r = await callClaude(apiKey, {
    system: systemPrompt(type), user: userPrompt(type, input),
    maxTokens: type === 'blog' ? 2200 : type === 'tiktok' ? 1400 : 1000, temperature: 0.7,
  })
  if (!r.ok || !r.text) return { ok: false, error: r.error || '생성 실패' }
  const content: GeneratedContent = { type, title: null, body: r.text, hashtags: [], variants: [] }
  if (type === 'ad_copy') {
    const parsed = parseJsonLoose<{ variants?: Array<{ title?: string; desc?: string }> }>(r.text)
    content.variants = normalizeAdCopy(parsed?.variants || [])
    if (!content.variants.length) return { ok: false, error: '광고 문구 생성 결과를 해석하지 못했습니다. 다시 시도해주세요.' }
    content.body = content.variants.map((v, i) => `${i + 1}. [${v.title}] ${v.desc}`).join('\n')
  } else if (type === 'instagram' || type === 'tiktok') {
    const ex = extractHashtags(r.text)
    content.body = ex.body; content.hashtags = ex.hashtags
  } else if (type === 'blog') {
    const ex = extractTitle(r.text)
    content.title = ex.title; content.body = ex.body
  }
  return { ok: true, content }
}

// ── 리퍼포징(원문 1개 → 멀티플랫폼 팩) — "하나 올리면 여러 채널" 자동화의 텍스트 파트 ──────
//   유튜브 대본/블로그 글/제품 설명 등 원문을 붙여넣으면 요약 + 채널별 변형을 **한 번의 호출**로.
//   ⚠️ 영상/음성/아바타 생성(ElevenLabs/HeyGen/Runway)은 외부 유료 API — 로드맵(별도 결정).
export interface RepurposePack {
  summary: string
  blog: { title: string; body: string } | null
  instagram: { caption: string; hashtags: string[] } | null
  tiktok: { hook: string; script: string; hashtags: string[] } | null
  ad_copy: AdCopyVariant[]
  seo: { metaTitle: string; metaDescription: string; keywords: string[] } | null
}

export async function generateRepurpose(apiKey: string | undefined, input: { source: string; brand?: string; keywords?: string }): Promise<{ ok: boolean; pack?: RepurposePack; error?: string }> {
  const source = String(input.source || '').trim()
  if (source.length < 20) return { ok: false, error: '원문 콘텐츠를 20자 이상 붙여넣어 주세요' }
  const system = `${BASE_RULES} 너는 하나의 원문 콘텐츠를 여러 채널용으로 리퍼포징하는 편집자다. **아래 JSON만 출력**(코드펜스/설명 없이):
{"summary":"3문장 요약","blog":{"title":"제목","body":"마크다운 700자 내외"},"instagram":{"caption":"300자 이내","hashtags":["#..."]},"tiktok":{"hook":"3초 훅","script":"- (초): 씬 3~5개","hashtags":["#..."]},"ad_copy":{"variants":[{"title":"15자 이내","desc":"45자 이내"}]},"seo":{"metaTitle":"60자 이내","metaDescription":"120자 이내","keywords":["..."]}}
instagram/tiktok 해시태그는 각 10개 내외, ad_copy variants 3개, seo.keywords 5개. 원문에 없는 사실을 지어내지 마라.`
  const user = `${input.brand ? `브랜드: ${input.brand}\n` : ''}${input.keywords ? `강조 키워드: ${input.keywords}\n` : ''}원문 콘텐츠:\n"""${source.slice(0, 6000)}"""`
  const r = await callClaude(apiKey, { system, user, maxTokens: 3000, temperature: 0.7 })
  if (!r.ok || !r.text) return { ok: false, error: r.error || '생성 실패' }
  const p = parseJsonLoose<{
    summary?: string; blog?: { title?: string; body?: string }; instagram?: { caption?: string; hashtags?: string[] }
    tiktok?: { hook?: string; script?: string; hashtags?: string[] }; ad_copy?: { variants?: Array<{ title?: string; desc?: string }> }
    seo?: { metaTitle?: string; metaDescription?: string; keywords?: string[] }
  }>(r.text)
  if (!p) return { ok: false, error: '리퍼포징 결과를 해석하지 못했습니다. 다시 시도해주세요.' }
  const clean = (arr?: string[]): string[] => (arr || []).map(t => String(t).trim()).filter(Boolean).map(t => (t.startsWith('#') || !t ? t : `#${t}`)).slice(0, 15)
  const pack: RepurposePack = {
    summary: String(p.summary || '').trim(),
    blog: p.blog?.body ? { title: String(p.blog.title || '').trim(), body: String(p.blog.body).trim() } : null,
    instagram: p.instagram?.caption ? { caption: String(p.instagram.caption).trim(), hashtags: clean(p.instagram.hashtags) } : null,
    tiktok: p.tiktok?.script ? { hook: String(p.tiktok.hook || '').trim(), script: String(p.tiktok.script).trim(), hashtags: clean(p.tiktok.hashtags) } : null,
    ad_copy: normalizeAdCopy(p.ad_copy?.variants || []),
    seo: p.seo?.metaTitle ? { metaTitle: String(p.seo.metaTitle).trim(), metaDescription: String(p.seo.metaDescription || '').trim(), keywords: (p.seo.keywords || []).map(k => String(k).trim()).filter(Boolean).slice(0, 10) } : null,
  }
  return { ok: true, pack }
}

// ── 댓글/리뷰 답변 초안 ──────────────────────────────────────────────────────
export const REPLY_TONES: Record<string, string> = {
  friendly: '친근하고 따뜻하게', polite: '정중하고 격식 있게', apologetic: '진심으로 사과하고 해결책을 제시하며', concise: '간결하고 명확하게',
}

export async function generateReply(apiKey: string | undefined, input: { comment: string; tone?: string; brand?: string }): Promise<{ ok: boolean; reply?: string; error?: string }> {
  const comment = String(input.comment || '').trim()
  if (!comment) return { ok: false, error: '답변할 댓글/리뷰 내용을 입력해주세요' }
  const toneDesc = REPLY_TONES[input.tone || 'polite'] || REPLY_TONES.polite
  const system = `${BASE_RULES} 너는 브랜드 고객응대 담당자다. 고객의 댓글/리뷰에 대한 **답변 초안 하나**를 ${toneDesc} 작성한다. 2~4문장, 이모지 없이. 불만이면 공감→해결책→후속 안내 순. 칭찬이면 감사→재방문 유도. 개인정보/보상 금액을 함부로 약속하지 마라.`
  const user = `${input.brand ? `브랜드: ${input.brand}\n` : ''}고객 댓글/리뷰:\n"""${comment.slice(0, 800)}"""\n\n위에 대한 답변 초안을 작성해줘.`
  const r = await callClaude(apiKey, { system, user, maxTokens: 500, temperature: 0.6 })
  if (!r.ok || !r.text) return { ok: false, error: r.error || '생성 실패' }
  return { ok: true, reply: r.text.replace(/^["「]|["」]$/g, '').trim() }
}

// ── 성과 분석(콘텐츠 관점) — 실적 데이터 근거로 메시지 분석 + 콘텐츠 방향 제안 ────────
export interface PerfContext {
  connected: boolean
  stats?: { days: number; impCnt: number; clkCnt: number; salesAmt: number; ccnt: number; convAmt: number; ctr: number; cpc: number }
  topKeywords?: Array<{ keyword: string; conv: number; roas: number | null }>
  wasteKeywords?: Array<{ keyword: string; cost: number }>
}

export async function analyzeContentPerformance(apiKey: string | undefined, ctx: PerfContext): Promise<{ ok: boolean; analysis?: string; error?: string }> {
  if (!ctx.connected && !ctx.stats) return { ok: false, error: '분석할 실적 데이터가 없습니다 (광고계정 연동 후 이용)' }
  const system = `${BASE_RULES} 너는 성과 마케팅 분석가다. 주어진 광고 실적 데이터만 근거로 **콘텐츠/메시지 관점**에서 분석한다. 출력 마크다운 섹션: ## 성과 요약 / ## 잘 통하는 메시지·키워드 / ## 콘텐츠 제작 방향(3가지, 어떤 채널에 어떤 주제로) / ## 주의. 전환 잘 되는 키워드는 그 의도를 콘텐츠 주제로 제안하고, 낭비 키워드는 메시지 재점검을 권한다.`
  const user = `아래는 한 광고주의 실적 데이터다.\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\``
  const r = await callClaude(apiKey, { system, user, maxTokens: 1500 })
  if (!r.ok || !r.text) return { ok: false, error: r.error || '분석 실패' }
  return { ok: true, analysis: r.text }
}

// ── 콘텐츠 라이브러리(생성물 저장) ───────────────────────────────────────────
const LIBRARY_CAP = 200
const _schemaDone = new WeakSet<object>()
export async function ensureContentSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    body TEXT NOT NULL,
    meta TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_content_acct ON ad_content(account_id, id)').run().catch(() => null)
}

export interface ContentRow { id: number; type: string; title: string | null; body: string; meta: string | null; created_at: string }

export async function saveContent(DB: D1Database, accountId: number, item: { type: string; title?: string | null; body: string; meta?: unknown }): Promise<{ ok: boolean; error?: string }> {
  await ensureContentSchema(DB)
  const body = String(item.body || '').trim()
  if (!body) return { ok: false, error: '저장할 내용이 없습니다' }
  const cnt = await DB.prepare('SELECT COUNT(*) AS c FROM ad_content WHERE account_id = ?').bind(accountId).first<{ c: number }>().catch(() => null)
  if ((Number(cnt?.c) || 0) >= LIBRARY_CAP) return { ok: false, error: `보관함은 최대 ${LIBRARY_CAP}개입니다. 오래된 항목을 삭제해주세요.` }
  await DB.prepare('INSERT INTO ad_content (account_id, type, title, body, meta) VALUES (?, ?, ?, ?, ?)')
    .bind(accountId, String(item.type || 'blog').slice(0, 20), item.title ? String(item.title).slice(0, 200) : null, body.slice(0, 8000), item.meta ? JSON.stringify(item.meta).slice(0, 4000) : null)
    .run().catch(() => null)
  return { ok: true }
}

export async function listContent(DB: D1Database, accountId: number, type?: string): Promise<ContentRow[]> {
  await ensureContentSchema(DB)
  const stmt = type
    ? DB.prepare('SELECT id, type, title, body, meta, created_at FROM ad_content WHERE account_id = ? AND type = ? ORDER BY id DESC LIMIT 100').bind(accountId, type)
    : DB.prepare('SELECT id, type, title, body, meta, created_at FROM ad_content WHERE account_id = ? ORDER BY id DESC LIMIT 100').bind(accountId)
  const r = await stmt.all<ContentRow>().catch(() => null)
  return r?.results || []
}

export async function deleteContent(DB: D1Database, accountId: number, id: number): Promise<void> {
  await ensureContentSchema(DB)
  await DB.prepare('DELETE FROM ad_content WHERE account_id = ? AND id = ?').bind(accountId, id).run().catch(() => null)
}
