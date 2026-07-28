/**
 * 🎯 유어애즈 인플루언서 공용 풀 어드민 — admin-ads.routes.ts 에서 분리(파일크기 상한 준수).
 *   같은 /api/admin/ads 마운트(app.route). 결과 열람/큐레이션 + 키워드 관리 + 수동 트리거.
 *   ⚠️ 공용 풀 = account_id 0. 수집 엔진(ur-ads cron)과 분리 — 여기는 조회/정비만.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import { generateOutreachDrafts, OUTREACH_BATCH_MAX, type OutreachLeadInput } from './influencer-outreach'
import { ensureInfluencerSchema } from './influencer-discovery'
import { ensureOutreachColumns } from './outreach-webhook'
import { ensurePerfExtraColumns, runReclassifyPool, runYtLiveRefetch, runCategoryRescan } from './influencer-performance'
import { ensureQualityColumns, runQualityPass } from './influencer-quality'
import { buildCampaignBody, textToHtml, CONSENTED_SEND_MAX, withAdLabel, isNightKST } from './outreach-send'
import { COLD_SEND_MAX, COLD_COOLDOWN_DAYS, coldDailyKey, evaluateColdGuards } from './outreach-cold'
import { sendEmail } from '@/services/email'
import { classifyCategory } from './influencer-classify'
import { buildInfluencerExportResponse } from './influencer-pool-export'
import { mergeDuplicatePool, reextractPoolContacts } from './influencer-maintenance'
import { getOrCreateClaimCode } from './lead-claim'
import { buildInfluencerPoolStats, ensureRecruitColumn } from './influencer-pool-stats' // ⚠️ 수집 엔진(influencer-auto-collect) import 금지 — 메인 번들 경량 유지

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// ── 🎯 인플루언서 공용 풀(자동 수집) 어드민 (2026-07-20, Phase E) ───────────────
//   수집 엔진은 ur-ads 워커 cron. 여기(메인 어드민)는 결과 열람/큐레이션 + 키워드 관리 + 수동 트리거만.
//   ⚠️ 메인 번들 경량 유지 위해 수집/발굴 코드는 import 안 하고 전부 inline SQL(공용 풀 = account_id 0).
const POOL = 0

// 📨 캠페인 발송 시각 — **중복 발송 차단의 키**. contacted_at 은 COALESCE(최초 1회)라 재발송 판정에 못 쓴다.
const RESEND_COOLDOWN_DAYS = 7
const _campaignColDone = new WeakSet<object>()
async function ensureCampaignColumn(DB: D1Database) {
  if (_campaignColDone.has(DB)) return
  _campaignColDone.add(DB)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN campaign_sent_at TEXT').run().catch(() => null)
}

async function ensureKeywordTable(DB: D1Database) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_discovery_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL UNIQUE, category TEXT,
    active INTEGER NOT NULL DEFAULT 1, hits INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'seed',
    created_at DATETIME DEFAULT (datetime('now')))`).run().catch(() => null)
  // 📊 키워드별 성과 컬럼(수집 엔진 ensureDiscoveryKeywords 와 동일 — 어드민이 먼저 조회해도 안전).
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN found_total INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN saved_total INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN last_saved INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN last_run_at DATETIME').run().catch(() => null)
}

// GET /api/admin/ads/influencer-pool?platform=&category=&hasContact=1&q=&limit=
app.get('/influencer-pool', async (c) => {
  await ensureInfluencerSchema(c.env.DB) // SELECT 가 최신 컬럼(source/consented_at 등) 참조 — 미보강 DB 면 'no such column' 로 빈 목록 → 스키마 선보강(멱등·memoized)
  await ensureOutreachColumns(c.env.DB)  // 아웃리치 자동감지 컬럼(email_status/opened_at/replied_at) — 동일 이유 선보강
  await ensurePerfExtraColumns(c.env.DB) // channel_published_at(계정 나이)·롱폼중앙값 컬럼 선보강 — 빈목록 레이스 방지
  await ensureQualityColumns(c.env.DB)   // is_brand/lead_score — SELECT·필터가 참조
  const where = ['account_id = ?']; const binds: (string | number)[] = [POOL]
  const platform = (c.req.query('platform') || '').trim()
  if (['youtube', 'naver_blog', 'naver_cafe', 'tistory', 'instagram', 'tiktok'].includes(platform)) { where.push('platform = ?'); binds.push(platform) }
  const category = (c.req.query('category') || '').trim()
  if (category) { where.push('category = ?'); binds.push(category) }
  if (c.req.query('hasContact') === '1') where.push('(email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL)')
  if (c.req.query('hasEmail') === '1') where.push('email IS NOT NULL')      // 아웃리치 리스트용(이메일 보유만)
  if (c.req.query('hasInstagram') === '1') where.push('instagram IS NOT NULL')
  const status = (c.req.query('status') || '').trim()   // 아웃리치 상태 필터
  if (['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold'].includes(status)) { where.push('status = ?'); binds.push(status) }
  // 🎯 규모 필터(tier) — 유어딜 딜은 마이크로/중형(1만~50만)이 실전 효율 최고. YT 구독자 기준(네이버블로그는 지표 없어 무관).
  const tier = (c.req.query('tier') || '').trim()
  if (tier === 'nano') where.push('subscriber_count > 0 AND subscriber_count < 10000')
  else if (tier === 'micro') where.push('subscriber_count >= 10000 AND subscriber_count < 100000')
  else if (tier === 'mid') where.push('subscriber_count >= 100000 AND subscriber_count < 500000')
  else if (tier === 'macro') where.push('subscriber_count >= 500000')
  else if (tier === 'sweet') where.push("(platform IN ('naver_blog','naver_cafe','tistory') OR (subscriber_count >= 10000 AND subscriber_count < 500000))")
  // 🔎 검색 — 이름/핸들/수집키워드 + **이메일·카테고리·채널소개**(2026-07-27 대표 "인플루언서 검색도 되게").
  //   소개(description)에 지역·업종이 적힌 채널이 많아, 이걸 빼면 "강남"·"카페" 로 찾아도 0건이 나온다.
  //   여러 단어를 넣으면 **AND**(각 토큰이 어딘가엔 있어야 함) — "강남 카페" 가 둘 다 만족하는 채널만 나오게.
  const qRaw = (c.req.query('q') || '').trim().toLowerCase()
  if (qRaw) {
    for (const tok of qRaw.split(/\s+/).filter(Boolean).slice(0, 5)) {
      where.push(`(LOWER(name) LIKE ? OR LOWER(COALESCE(handle,'')) LIKE ? OR LOWER(COALESCE(source_keyword,'')) LIKE ?
                   OR LOWER(COALESCE(email,'')) LIKE ? OR LOWER(COALESCE(category,'')) LIKE ? OR LOWER(COALESCE(description,'')) LIKE ?)`)
      const like = `%${tok}%`
      binds.push(like, like, like, like, like, like)
    }
  }
  // 팔로업 필요 — 팔로업 예정일이 지났거나, 컨택함 상태로 5일+ 무진전(회신/계약 전).
  if (c.req.query('needFollowup') === '1') where.push("((follow_up_at IS NOT NULL AND follow_up_at <= date('now')) OR (status='contacted' AND contacted_at IS NOT NULL AND contacted_at <= datetime('now','-5 days')))")
  // 📥 인바운드 신청만 — 스스로 신청(사전동의)한 리드. 자유 연락 가능.
  if (c.req.query('source') === 'inbound') where.push("source = 'inbound'")
  // 🧹 노이즈 숨김 — 기존 풀에 남은 뉴스·방송·기관·체험단모집·대행 계정 제외(신규는 저장 시점에 이미 필터).
  if (c.req.query('hideNoise') === '1') {
    for (const w of ['뉴스', '신문사', '방송국', '연합뉴스', '체험단', '서포터즈', '기자단', '리뷰어 모집', '마케팅 대행', '광고 대행', '대행사', '구청', '시청']) {
      where.push('name NOT LIKE ?'); binds.push(`%${w}%`)
    }
    where.push('COALESCE(is_brand, 0) = 0') // 🏢 브랜드 공식 채널(기업 계정)도 함께 숨김 — 태깅만, 삭제 아님
  }
  // 🏢 브랜드 공식 채널만 — 태깅 결과 검수용(오탐 확인 후 memo/status 로 큐레이션).
  if (c.req.query('brandOnly') === '1') where.push('is_brand = 1')
  const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 200)))
  const offset = Math.max(0, intParam(c.req.query('offset'), 0)) // 페이지네이션 — 풀 전체(1800+) 브라우징
  // 정렬: 기본 'fit'(유어딜 핏 — 스위트스팟 1만~50만 + 네이버블로그 최우선 → 준대형 → 나노 → 초대형).
  //   'subscribers'(구독자순) · 'recent'(최근수집).
  const sort = (c.req.query('sort') || 'fit').trim()
  const orderBy = sort === 'subscribers' ? 'subscriber_count DESC, id DESC'
    : sort === 'recent' ? 'id DESC'
    : sort === 'perf' ? '(COALESCE(median_long_views, recent_avg_views) IS NULL) ASC, COALESCE(median_long_views, recent_avg_views) DESC, subscriber_count DESC, id DESC' // 📈 롱폼 중앙값(없으면 평균)순
    : sort === 'score' ? '(lead_score IS NULL) ASC, lead_score DESC, subscriber_count DESC, id DESC' // 🏅 리드 점수순(미채점 후순위)
    : `CASE
         WHEN platform IN ('naver_blog','naver_cafe','tistory') THEN 0
         WHEN subscriber_count >= 10000 AND subscriber_count < 500000 THEN 0
         WHEN subscriber_count >= 500000 AND subscriber_count < 1000000 THEN 1
         WHEN subscriber_count > 0 AND subscriber_count < 10000 THEN 2
         ELSE 3
       END ASC, subscriber_count DESC, id DESC`
  const whereSql = where.join(' AND ')
  // 현재 필터의 전체 건수(페이지네이션 UI "X / Y" + 더보기 판단) — 같은 where/binds 재사용.
  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE ${whereSql}`)
    .bind(...binds).first<{ n: number }>().catch(() => null)
  const rows = await c.env.DB.prepare(`SELECT id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, status, memo, category, source_keyword, collected_at, contacted_at, follow_up_at, contact_channel, outreach_draft, source, consented_at, recent_avg_views, recent_avg_comments, recent_posts_30d, email_status, opened_at, replied_at, channel_published_at, median_long_views, shorts_ratio, is_brand, lead_score, last_post_at, category_source
    FROM ad_influencer_leads WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset).all().catch(() => null)
  return c.json({ success: true, leads: rows?.results || [], total: totalRow?.n ?? 0, offset, limit })
})

// GET /api/admin/ads/influencer-pool/stats — 누적/최근 실행 통계 + 플랫폼별 카운트
//   집계 본문은 `influencer-pool-stats.ts`(SSOT) — 이 라우트는 인증/응답만.
app.get('/influencer-pool/stats', async (c) => c.json({ success: true, ...await buildInfluencerPoolStats(c.env) }))

// PATCH /api/admin/ads/influencer-pool/:id { status?, memo?, follow_up_at? } — 아웃리치 큐레이션
app.patch('/influencer-pool/:id', async (c) => {
  const id = Number(c.req.param('id')); if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const sets: string[] = []; const binds: (string | number)[] = []
  if (typeof b.status === 'string' && ['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold'].includes(b.status)) {
    sets.push('status = ?'); binds.push(b.status)
    if (['contacted', 'interested', 'contracted'].includes(b.status)) sets.push("contacted_at = COALESCE(contacted_at, datetime('now'))")
  }
  if (typeof b.memo === 'string') { sets.push('memo = ?'); binds.push(b.memo.slice(0, 500)) }
  // 컨택 채널(이메일/인스타DM/네이버쪽지/카톡/전화/기타) — 빈 문자열이면 해제.
  if (b.contact_channel !== undefined) {
    const ch = b.contact_channel
    if (ch === null || ch === '') sets.push('contact_channel = NULL')
    else if (typeof ch === 'string' && ['email', 'dm', 'note', 'kakao', 'call', 'other'].includes(ch)) { sets.push('contact_channel = ?'); binds.push(ch) }
    else return c.json({ success: false, error: '컨택 채널 값 오류' }, 400)
  }
  if (b.follow_up_at !== undefined) {
    const f = b.follow_up_at
    if (f === null || f === '') sets.push('follow_up_at = NULL')
    else if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)) { sets.push('follow_up_at = ?'); binds.push(f) }
    else return c.json({ success: false, error: '날짜 형식(YYYY-MM-DD) 오류' }, 400)
  }
  if (!sets.length) return c.json({ success: false, error: '변경 항목 없음' }, 400)
  await c.env.DB.prepare(`UPDATE ad_influencer_leads SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`).bind(...binds, id, POOL).run().catch(() => null)
  return c.json({ success: true })
})

// POST /api/admin/ads/influencer-pool/outreach-drafts { ids } — ✍ 개인화 제안 초안 일괄 생성(최대 10명)
//   ⚖️ 생성만, 발송 없음(정보통신망법 — 발송은 사람이 1건씩 검토 후). 초안은 리드 행(outreach_draft)에 저장.
app.post('/influencer-pool/outreach-drafts', async (c) => {
  await ensureInfluencerSchema(c.env.DB)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const ids: number[] = (Array.isArray(b.ids) ? (b.ids as unknown[]) : []).map(Number).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, OUTREACH_BATCH_MAX)
  if (!ids.length) return c.json({ success: false, error: `초안을 만들 리드를 선택해주세요 (최대 ${OUTREACH_BATCH_MAX}명)` }, 400)
  const ph = ids.map(() => '?').join(',')
  const rows = (await c.env.DB.prepare(`SELECT id, name, platform, subscriber_count, category, source_keyword, description
    FROM ad_influencer_leads WHERE account_id = ? AND id IN (${ph})`).bind(POOL, ...ids)
    .all<OutreachLeadInput>().catch(() => null))?.results || []
  if (!rows.length) return c.json({ success: false, error: '선택한 리드를 찾을 수 없습니다' }, 404)
  const r = await generateOutreachDrafts(c.env.ANTHROPIC_API_KEY, rows)
  if (!r.ok || !r.drafts) return c.json({ success: false, error: r.error || '생성 실패' }, 502)
  // 저장(1 batch) — {subject,body,dm,generated_at} JSON. 재생성 시 덮어씀(초안일 뿐 — 사람 검토가 최종).
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await c.env.DB.batch(Array.from(r.drafts.entries()).map(([id, d]) =>
    c.env.DB.prepare('UPDATE ad_influencer_leads SET outreach_draft = ? WHERE id = ? AND account_id = ?')
      .bind(JSON.stringify({ ...d, generated_at: now }), id, POOL))).catch(() => null)
  const failed = ids.filter((id: number) => !r.drafts!.has(id))
  return c.json({ success: true, generated: r.drafts.size, failed, drafts: Object.fromEntries(Array.from(r.drafts.entries()).map(([id, d]) => [id, { ...d, generated_at: now }])) })
})

// POST /api/admin/ads/influencer-pool/send-consented { ids, subject, body } — 📨 **동의 리드 한정** 자동 발송
//   ⚖️ [LEGAL] 사전 수신동의자(consented_at)에게만 — SQL 이 강제(클라 값 신뢰 X). 콜드 리드 자동 발송 경로 없음.
//   body 의 {name}/{이름} 은 리드 이름으로 치환, 수신거부 안내는 코드가 강제 첨부. 회당 최대 50명(클라가 분할).
app.post('/influencer-pool/send-consented', async (c) => {
  await ensureInfluencerSchema(c.env.DB)
  if (!c.env.RESEND_API_KEY) return c.json({ success: false, error: '발송은 RESEND_API_KEY 설정 후 사용할 수 있습니다 (Cloudflare → ur-live → Variables)' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const ids: number[] = (Array.isArray(b.ids) ? (b.ids as unknown[]) : []).map(Number).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, CONSENTED_SEND_MAX)
  // ⚖️ 야간 광고 전송 제한(KST 21~08시 — 야간 전송은 별도 동의 필요, 인바운드 동의는 야간 동의를 포함하지 않음).
  if (isNightKST(Date.now())) return c.json({ success: false, error: '야간(21시~익일 8시)에는 광고성 메일을 발송할 수 없습니다(정보통신망법 — 야간 전송은 별도 동의 필요). 오전 8시 이후 다시 시도해주세요' }, 400)
  const subject = withAdLabel(String(b.subject || '').trim().slice(0, 140)) // ⚖️ "(광고)" 표기 강제
  const template = String(b.body || '').trim().slice(0, 5000)
  if (!ids.length) return c.json({ success: false, error: '발송할 리드를 선택해주세요' }, 400)
  if (!String(b.subject || '').trim() || template.length < 20) return c.json({ success: false, error: '제목과 본문(20자 이상)을 입력해주세요' }, 400)
  // 🔁 중복 발송 차단(2026-07-27) — 버튼을 다시 누르거나 청크 루프를 재실행하면 **같은 사람에게 같은 메일이
  //   또 갔다**(외부에 직접 피해가 가는 유일한 중복 클릭). 최근 발송자는 조용히 제외하고 응답에 보고.
  //   의도적 재발송(다른 내용)은 body.force 로 통과 — 사람이 명시할 때만.
  await ensureCampaignColumn(c.env.DB)
  const force = b.force === true
  const dedupe = force ? '' : `AND (campaign_sent_at IS NULL OR campaign_sent_at <= datetime('now', '-${RESEND_COOLDOWN_DAYS} days'))`
  // ⚖️ 동의 강제: consented_at + email 있는 행만 — 미동의/이메일 없는 id 는 조용히 제외(응답에 skipped 로 보고).
  const ph = ids.map(() => '?').join(',')
  const rows = (await c.env.DB.prepare(`SELECT id, name, email FROM ad_influencer_leads
    WHERE account_id = ? AND id IN (${ph}) AND consented_at IS NOT NULL AND email IS NOT NULL ${dedupe}`)
    .bind(POOL, ...ids).all<{ id: number; name: string; email: string }>().catch(() => null))?.results || []
  if (!rows.length) return c.json({ success: true, sent: 0, failed: [], suppressed: [], skipped: ids, recent_skipped: ids.length,
    note: force ? '발송 가능한 리드가 없습니다' : `선택한 리드가 모두 최근 ${RESEND_COOLDOWN_DAYS}일 내 발송 대상이거나 발송 조건(사전동의 + 이메일)을 만족하지 않습니다` })
  let sent = 0; const failedIds: number[] = []; const suppressedIds: number[] = []
  for (const r of rows) {
    const body = buildCampaignBody(template, r.name) // {name} 치환 + 수신거부·전송자정보 강제
    const res = await sendEmail({ to: r.email, subject, html: textToHtml(body) }, c.env.RESEND_API_KEY, c.env.RESEND_FROM, c.env.DB).catch(() => ({ success: false as const, error: 'throw' }))
    if (res.success) {
      sent++
      await c.env.DB.prepare(`UPDATE ad_influencer_leads SET contacted_at = COALESCE(contacted_at, datetime('now')), contact_channel = 'email',
        campaign_sent_at = datetime('now'), status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END WHERE id = ? AND account_id = ?`).bind(r.id, POOL).run().catch(() => null)
    } else if ((res as { error?: string }).error === 'suppressed') suppressedIds.push(r.id) // 반송/스팸신고/수신거부 억제 — 재시도 무의미(실패와 구분)
    else failedIds.push(r.id)
  }
  const eligible = new Set(rows.map(r => r.id))
  const skipped = ids.filter(id => !eligible.has(id))
  return c.json({ success: true, sent, failed: failedIds, suppressed: suppressedIds, skipped, recent_skipped: force ? 0 : skipped.length })
})

// POST /api/admin/ads/influencer-pool/send-cold { ids, subject, body } — 📨 **콜드(미동의) 제휴 제안** 발송
//   ⚖️ 2026-07-28 대표 결정으로 신설(그 전까지 "만들지 않는다"였다 — 경위·근거·잔여 리스크는 outreach-cold.ts 헤더).
//   동의 경로(send-consented)와 **분리**한다: 저쪽은 consented_at 강제, 이쪽은 consented_at IS NULL 대상.
//   법정 표시·차단은 동의 경로와 동일하게 코드가 강제((광고) 제목 · 수신거부 · 전송자정보 · 야간금지) +
//   콜드 전용 제동(1일 상한 · 반송 회로차단 · 30일 쿨다운 · force 없음).
app.post('/influencer-pool/send-cold', async (c) => {
  await ensureInfluencerSchema(c.env.DB)
  await ensureOutreachColumns(c.env.DB)
  await ensureCampaignColumn(c.env.DB)
  if (!c.env.RESEND_API_KEY) return c.json({ success: false, error: '발송은 RESEND_API_KEY 설정 후 사용할 수 있습니다 (Cloudflare → ur-live → Variables)' }, 400)
  if (isNightKST(Date.now())) return c.json({ success: false, error: '야간(21시~익일 8시)에는 광고성 메일을 발송할 수 없습니다(정보통신망법). 오전 8시 이후 다시 시도해주세요' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const ids: number[] = (Array.isArray(b.ids) ? (b.ids as unknown[]) : []).map(Number).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, COLD_SEND_MAX)
  const subject = withAdLabel(String(b.subject || '').trim().slice(0, 140))
  const template = String(b.body || '').trim().slice(0, 5000)
  if (!ids.length) return c.json({ success: false, error: '발송할 리드를 선택해주세요' }, 400)
  if (!String(b.subject || '').trim() || template.length < 20) return c.json({ success: false, error: '제목과 본문(20자 이상)을 입력해주세요' }, 400)

  // 🚦 콜드 전용 게이트 — 1일 상한 + 반송 회로차단(둘 다 발송 시도 전에 판단).
  const dayKey = coldDailyKey(Date.now())
  const usedRow = await c.env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(dayKey).first<{ value: string }>().catch(() => null)
  const used = Math.max(0, parseInt(usedRow?.value || '0', 10) || 0)
  const sampleRow = await c.env.DB.prepare(`SELECT COUNT(*) AS sent,
      SUM(CASE WHEN email_status IN ('bounced','complained') THEN 1 ELSE 0 END) AS bad
    FROM ad_influencer_leads
    WHERE account_id = ? AND consented_at IS NULL AND campaign_sent_at IS NOT NULL
      AND campaign_sent_at > datetime('now', '-14 days')`).bind(POOL).first<{ sent: number; bad: number }>().catch(() => null)
  const guard = evaluateColdGuards(used, { sent: Number(sampleRow?.sent) || 0, bad: Number(sampleRow?.bad) || 0 })
  if (!guard.ok) return c.json({ success: false, error: guard.error }, 400)

  // ⚖️ 대상 강제(클라 값 신뢰 X): 미동의 + 이메일 보유 + 반송/신고 이력 없음 + 쿨다운 경과. force 스위치 없음.
  const ph = ids.map(() => '?').join(',')
  const rows = ((await c.env.DB.prepare(`SELECT id, name, email FROM ad_influencer_leads
    WHERE account_id = ? AND id IN (${ph}) AND consented_at IS NULL
      AND email IS NOT NULL AND email != ''
      AND (email_status IS NULL OR email_status NOT IN ('bounced','complained'))
      AND (campaign_sent_at IS NULL OR campaign_sent_at <= datetime('now', '-${COLD_COOLDOWN_DAYS} days'))
    LIMIT ?`).bind(POOL, ...ids, Math.min(ids.length, guard.remaining || 0))
    .all<{ id: number; name: string; email: string }>().catch(() => null))?.results) || []
  if (!rows.length) return c.json({ success: true, sent: 0, failed: [], suppressed: [], skipped: ids, remaining_today: guard.remaining,
    note: `선택한 리드가 모두 발송 조건(이메일 보유 · 미동의 · 반송이력 없음 · 최근 ${COLD_COOLDOWN_DAYS}일 내 미발송)을 만족하지 않습니다` })

  let sent = 0; const failedIds: number[] = []; const suppressedIds: number[] = []
  for (const r of rows) {
    const body = buildCampaignBody(template, r.name) // {name} 치환 + 수신거부·전송자정보 강제
    const res = await sendEmail({ to: r.email, subject, html: textToHtml(body) }, c.env.RESEND_API_KEY, c.env.RESEND_FROM, c.env.DB).catch(() => ({ success: false as const, error: 'throw' }))
    if (res.success) {
      sent++
      await c.env.DB.prepare(`UPDATE ad_influencer_leads SET contacted_at = COALESCE(contacted_at, datetime('now')), contact_channel = 'email',
        campaign_sent_at = datetime('now'), status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END WHERE id = ? AND account_id = ?`).bind(r.id, POOL).run().catch(() => null)
    } else if ((res as { error?: string }).error === 'suppressed') suppressedIds.push(r.id)
    else failedIds.push(r.id)
  }
  // 1일 카운터는 **실제 발송분만** 누적(실패·억제는 안 셈) — 상한이 '보낸 양'을 뜻하도록.
  if (sent > 0) {
    await c.env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(dayKey, String(used + sent)).run().catch(() => null)
  }
  const eligible = new Set(rows.map(r => r.id))
  return c.json({ success: true, sent, failed: failedIds, suppressed: suppressedIds,
    skipped: ids.filter(id => !eligible.has(id)), remaining_today: Math.max(0, (guard.remaining || 0) - sent) })
})

// POST /api/admin/ads/influencer-pool/:id/track-link { target_url } — 🔗 리드별 협찬 추적링크(생성/조회)
//   인플루언서에게 보내는 제안에 이 링크를 넣으면 그 사람이 만든 유입을 클릭수로 확인 가능(성과 기반 매칭의 데이터).
//   멱등: 이미 발급된 리드는 같은 코드를 반환(이미 보낸 링크 불변) + 현재 클릭수 동봉.
app.post('/influencer-pool/:id/track-link', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const lead = await c.env.DB.prepare('SELECT name FROM ad_influencer_leads WHERE id = ? AND account_id = ?')
    .bind(id, POOL).first<{ name: string }>().catch(() => null)
  if (!lead) return c.json({ success: false, error: '리드를 찾을 수 없습니다' }, 404)
  const { getOrCreateLeadTrackLink } = await import('./short-links')
  const r = await getOrCreateLeadTrackLink(c.env.DB, id, String(b.target_url || ''), `협찬추적: ${lead.name}`)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, code: r.code, click_count: r.click_count, created: r.created, name: lead.name })
})

// POST /api/admin/ads/influencer-pool/:id/recruit — 📣 모집 전환(수집 리드 → 신청자) 안내 준비
//   수집만 된 리드는 대행 상품의 재고로 못 쓴다(동의 리드가 아웃리치 자동화의 전제) → 모집 페이지로
//   유도해 **스스로 신청**하게 만드는 것이 풀의 실질 가치를 만드는 단계.
//   여기서는 ① 리드 전용 추적링크(→ /creators/apply) 발급 ② recruited_at 기록(전환율 측정 모수)만 하고,
//   실제 전달은 사람이 공개 채널(인스타 DM·블로그 댓글)로 한다(플랫폼 제재·수신자 선택권 존중).
//   🔗 2026-07-27: 리드의 **현재 퍼널 단계에 맞는 링크**를 준다 — 미신청=신청 링크 / 신청완료=가입 링크
//   (`/creators/start?ic=`, lead-claim) / 가입완료=안내 불필요. 예전엔 신청자에게 400 만 돌려줘 다음 단계가 없었다.
app.post('/influencer-pool/:id/recruit', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
  await ensureRecruitColumn(c.env.DB)
  const lead = await c.env.DB.prepare('SELECT name, consented_at FROM ad_influencer_leads WHERE id = ? AND account_id = ?')
    .bind(id, POOL).first<{ name: string; consented_at: string | null }>().catch(() => null)
  if (!lead) return c.json({ success: false, error: '리드를 찾을 수 없습니다' }, 404)
  const origin = new URL(c.req.url).origin
  if (lead.consented_at) {
    // 이미 신청함 → 다음 단계는 '가입'. 추적 코드가 붙은 시작 링크를 준다(온보딩 메일과 동일 코드 = 이중 집계 없음).
    const linked = await c.env.DB.prepare('SELECT linked_user_id FROM ad_influencer_leads WHERE id = ? AND account_id = ?')
      .bind(id, POOL).first<{ linked_user_id: number | null }>().catch(() => null)
    if (linked?.linked_user_id) return c.json({ success: false, already_joined: true, error: '이미 가입까지 완료한 리드입니다' }, 400)
    const code = await getOrCreateClaimCode(c.env.DB, id).catch(() => null)
    if (!code) return c.json({ success: false, error: '가입 링크 생성 실패' }, 500)
    return c.json({ success: true, mode: 'join', url: `${origin}/creators/start?ic=${code}`, name: lead.name })
  }
  const { getOrCreateLeadTrackLink } = await import('./short-links')
  // 추적링크는 리드당 1개(멱등) — 이미 협찬 추적용으로 발급됐다면 그 코드를 그대로 재사용한다.
  const r = await getOrCreateLeadTrackLink(c.env.DB, id, `${origin}/creators/apply`, `모집: ${lead.name}`)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  await c.env.DB.prepare("UPDATE ad_influencer_leads SET recruited_at = COALESCE(recruited_at, datetime('now')) WHERE id = ? AND account_id = ?")
    .bind(id, POOL).run().catch(() => null)
  return c.json({ success: true, mode: 'apply', code: r.code, url: `${origin}/l/${r.code}`, click_count: r.click_count, name: lead.name })
})

// POST /api/admin/ads/influencer-pool/reextract — 🔗 기존 풀 소개글 재추출(백필, 멱등)
//   신규 추출기(@핸들·키워드형 인스타/틱톡·유튜브/블로그 링크)를 저장된 description 에 재적용 → API 재호출 0.
//   ⚠️ instagram/tiktok 는 비어있을 때만 채움. email 은 비어있으면 채우고, **대행사(비-개인도메인) 저장값은
//   소개글의 개인도메인 메일로 교정**(협찬/MCN 메일 오수집 정정 — 전 플랫폼). links 는 합집합(기존 보존).
app.post('/influencer-pool/reextract', async (c) => {
  const r = await reextractPoolContacts(c.env.DB) // SSOT: influencer-maintenance(야간 cron 과 동일 로직)
  return c.json({ success: true, ...r })
})

// GET /api/admin/ads/influencer-pool/classify-debug?q=세븐일레븐 — 🔎 분류 진단(왜 이 카테고리인가)
//   저장 이름/소개글에 우리 규칙(classifyCategory)을 재적용해, 콘텐츠 신호 매칭인지 vs 키워드 상속인지 드러냄.
app.get('/influencer-pool/classify-debug', async (c) => {
  await ensureInfluencerSchema(c.env.DB)
  const q = (c.req.query('q') || '').trim().toLowerCase()
  if (!q) return c.json({ success: false, error: 'q 파라미터 필요' }, 400)
  const rows = (await c.env.DB.prepare(`SELECT id, platform, name, handle, description, category, source_keyword FROM ad_influencer_leads
      WHERE account_id = ? AND (LOWER(name) LIKE ? OR LOWER(COALESCE(handle,'')) LIKE ?) LIMIT 20`)
    .bind(POOL, `%${q}%`, `%${q}%`).all<{ id: number; platform: string; name: string | null; handle: string | null; description: string | null; category: string | null; source_keyword: string | null }>().catch(() => null))?.results || []
  const results = rows.map(r => {
    const contentCat = classifyCategory(r.name || '', r.description)
    const why = contentCat
      ? (contentCat === r.category ? `콘텐츠 신호=${contentCat}(현재와 동일)` : `콘텐츠 신호=${contentCat}(현재 ${r.category}와 다름 — 재분류로 교정 가능)`)
      : (r.category ? `콘텐츠 신호 없음 → 키워드 상속(source_keyword="${r.source_keyword}") → 라이브 재보정(🧭)으로만 교정` : '미분류')
    return { id: r.id, platform: r.platform, name: r.name, handle: r.handle, stored_category: r.category, content_category: contentCat, source_keyword: r.source_keyword, why, description: (r.description || '').slice(0, 400) }
  })
  return c.json({ success: true, count: results.length, results })
})

// POST /api/admin/ads/influencer-pool/reclassify — 🏷️ 기존 풀 콘텐츠 기반 카테고리 재분류(백필, 멱등)
app.post('/influencer-pool/reclassify', async (c) => {
  await ensureInfluencerSchema(c.env.DB)
  const r = await runReclassifyPool(c.env.DB)
  return c.json({ success: true, ...r })
})

// POST /api/admin/ads/influencer-pool/quality-pass — 🏅 브랜드 태깅 + 리드 점수 재계산(즉시 실행)
//   야간 정비가 매일 자동으로 도는 것과 **같은 함수**(SSOT). 배포 직후처럼 즉시 반영이 필요할 때만 수동 클릭.
//   커서 순환이라 여러 번 눌러도 안전(멱등) — 풀이 크면 몇 번에 걸쳐 전체 수렴.
app.post('/influencer-pool/quality-pass', async (c) => {
  await ensureInfluencerSchema(c.env.DB)
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(runQualityPass(c.env.DB).catch(() => null)); return c.json({ success: true, started: true }) }
  const r = await runQualityPass(c.env.DB)
  return c.json({ success: true, ...r })
})

// POST /api/admin/ads/influencer-pool/recategorize — 🧭 카테고리 전체 재보정(라이브·초경량)
//   channels.list 50개 배치(part=snippet,topicDetails)만으로 전 YT 풀을 한 번에 재보정(≈N/50 콜, 4천개≈85콜).
//   버튼 한 번=전 풀(반복 클릭 불필요). 수십 초 걸려 waitUntil 백그라운드(즉시 started, UI 통계 재조회로 따라잡음).
app.post('/influencer-pool/recategorize', async (c) => {
  await ensureInfluencerSchema(c.env.DB)
  if (!c.env.YOUTUBE_API_KEY) return c.json({ success: false, error: 'YouTube API 키가 설정되어 있지 않습니다' }, 400)
  await ensurePerfExtraColumns(c.env.DB)
  // 📉 '평균 0회' 백로그를 cron 자동 재측정 큐에 올림(1회성 perf_checked_at 리셋). cron progress(perf_checked_at IS NULL)가
  //   시간당 이어받아 실제 조회수로 자동 힐 → 대표는 클릭 불필요. P1-A 수정으로 재측정 시 0 재감염 없음, 진짜 0 은 1회 후 종료.
  await c.env.DB.prepare("UPDATE ad_influencer_leads SET perf_checked_at = NULL WHERE account_id = 0 AND platform = 'youtube' AND recent_avg_views = 0").run().catch(() => null)
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(runCategoryRescan(c.env).catch(() => null)); return c.json({ success: true, started: true }) }
  const r = await runCategoryRescan(c.env) // 폴백(waitUntil 미지원): 동기
  return c.json({ success: true, started: false, ...r })
})

// POST /api/admin/ads/influencer-pool/refetch-live — 🔄 유튜브 라이브 재조회(현재 About 다시 불러 이메일/카테고리 교정)
//   재추출(저장데이터)로 못 고치는 케이스(티벳동생: 현재 About 에만 개인메일) 대응. YouTube units 사용(검색 쿼터 무관).
//   🔥 백그라운드(waitUntil): passes×20 채널 순회는 수십 초 → 동기 대기 시 요청 타임아웃 "실패" 오표시(/collect 동일 클래스). 즉시 started 반환, 완료는 UI 통계 재조회로 따라잡음.
app.post('/influencer-pool/refetch-live', async (c) => {
  await ensureInfluencerSchema(c.env.DB)
  if (!c.env.YOUTUBE_API_KEY) return c.json({ success: false, error: 'YouTube API 키가 설정되어 있지 않습니다' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const passes = Math.max(1, Math.min(10, Number(b.passes) || 5))
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(runYtLiveRefetch(c.env, passes).catch(() => null)); return c.json({ success: true, started: true }) }
  const r = await runYtLiveRefetch(c.env, passes) // 폴백(waitUntil 미지원 환경): 동기 실행
  return c.json({ success: true, started: false, ...r })
})

// POST /api/admin/ads/influencer-pool/merge-duplicates — 중복 리드 통합(1건만 남김)
//   1차: 같은 이메일 / 2차: 같은 인스타 핸들(이메일 없이 유튜브+블로그로 잡힌 동일인 — 인스타는 사람마다 고유).
//   상태 진전(계약>관심>컨택함>신규)·정보 많은 순으로 대표 1건을 남기고 나머지 삭제(대표에 없는 컨택은 보존 백필).
app.post('/influencer-pool/merge-duplicates', async (c) => {
  const DB = c.env.DB
  // 🔥 백그라운드(waitUntil): 4패스 순차 D1 이라 20k+ 풀에선 동기 대기 시 타임아웃. SSOT: influencer-maintenance.
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(mergeDuplicatePool(DB).catch(() => null)); return c.json({ success: true, started: true }) }
  const r = await mergeDuplicatePool(DB)
  return c.json({ success: true, started: false, ...r })
})

// GET /api/admin/ads/seller-match?category=맛집&region=강남 — 🔗 유어딜 셀러 매칭(읽기 전용)
//   인플루언서 카테고리 → 유어딜 이용권 카테고리 매핑 → 그 카테고리 승인 매장 목록 + **지역 커버리지** 반환.
//   region 파라미터(선택): 매장 상품의 시/군구/동(product_regions, 텍스트 LIKE)으로 필터 → 로컬 딜 근접 매칭.
//   ⚠️ 서비스 경계: sellers/products/product_regions 를 **읽기만** 함(변경 0). 매칭 판단은 어드민(사람).
app.get('/seller-match', async (c) => {
  const cat = (c.req.query('category') || '').trim()
  const region = (c.req.query('region') || '').trim().slice(0, 40)
  // 인플루언서 카테고리 → 유어딜 이용권 카테고리.
  const MAP: Record<string, string> = {
    '맛집': 'meal_voucher', '푸드': 'meal_voucher', '외식창업': 'meal_voucher',
    '뷰티': 'beauty_voucher', '네일': 'beauty_voucher',
    '숙소': 'stay_voucher',
  }
  const vcat = MAP[cat]
  if (!vcat) return c.json({ success: true, category: cat, voucher_category: null, region: region || null, sellers: [], note: '이 카테고리는 유어딜 이용권 카테고리(맛집/뷰티/네일/숙소)와 직접 매칭되지 않습니다.' })
  // product_regions(시/군구/동 텍스트 태깅, best-effort — 태깅된 매장만 지역 표시)로 커버리지 집계 + 선택 필터.
  //   region 지정 시 그 지역에 태깅된 매장만(LEFT JOIN + HAVING 으로 지역 없는 매장 제외).
  const regionLike = region ? `%${region}%` : ''
  const havingRegion = region
    ? `HAVING SUM(CASE WHEN pr.region_si LIKE ? OR pr.region_gu LIKE ? OR pr.region_dong LIKE ? THEN 1 ELSE 0 END) > 0`
    : ''
  const sql = `SELECT s.id, COALESCE(NULLIF(s.business_name,''), s.name) AS name,
      COUNT(DISTINCT p.id) AS product_count,
      GROUP_CONCAT(DISTINCT COALESCE(NULLIF(pr.region_gu,''), NULLIF(pr.region_si,''))) AS regions
    FROM sellers s
    JOIN products p ON p.seller_id = s.id AND p.is_active = 1 AND p.category = ?
    LEFT JOIN product_regions pr ON pr.product_id = p.id
    WHERE s.status = 'approved'
    GROUP BY s.id ${havingRegion}
    ORDER BY product_count DESC, s.id DESC LIMIT 100`
  const binds = region ? [vcat, regionLike, regionLike, regionLike] : [vcat]
  const rows = (await c.env.DB.prepare(sql).bind(...binds)
    .all<{ id: number; name: string; product_count: number; regions: string | null }>().catch(() => null))?.results || []
  return c.json({ success: true, category: cat, voucher_category: vcat, region: region || null, sellers: rows })
})

// DELETE /api/admin/ads/influencer-pool/:id
app.delete('/influencer-pool/:id', async (c) => {
  const id = Number(c.req.param('id')); if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  await c.env.DB.prepare('DELETE FROM ad_influencer_leads WHERE id = ? AND account_id = ?').bind(id, POOL).run().catch(() => null)
  return c.json({ success: true })
})

// GET /api/admin/ads/influencer-pool/keywords — 수집 키워드 목록(활성/후보)
app.get('/influencer-pool/keywords', async (c) => {
  await ensureKeywordTable(c.env.DB)
  // 성과순(saved_total) 정렬 — "잘 무는" 키워드가 위로. 지역 시딩 조정용.
  const r = await c.env.DB.prepare('SELECT id, keyword, category, active, hits, source, created_at, found_total, saved_total, last_saved, last_run_at FROM ad_discovery_keywords ORDER BY active DESC, saved_total DESC, hits DESC, id ASC LIMIT 1000').all().catch(() => null)
  return c.json({ success: true, keywords: r?.results || [] })
})

// POST /api/admin/ads/influencer-pool/keywords { keyword, category? } — 키워드 추가
app.post('/influencer-pool/keywords', async (c) => {
  await ensureKeywordTable(c.env.DB)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const kw = String(b.keyword || '').trim()
  if (kw.length < 2 || kw.length > 40) return c.json({ success: false, error: '키워드는 2~40자' }, 400)
  await c.env.DB.prepare("INSERT OR IGNORE INTO ad_discovery_keywords (keyword, category, active, source) VALUES (?, ?, 1, 'manual')")
    .bind(kw, String(b.category || '수동').slice(0, 40)).run().catch(() => null)
  return c.json({ success: true })
})

// PATCH /api/admin/ads/influencer-pool/keywords/:id { active } — 활성/비활성
app.patch('/influencer-pool/keywords/:id', async (c) => {
  const id = Number(c.req.param('id')); if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  await c.env.DB.prepare('UPDATE ad_discovery_keywords SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, id).run().catch(() => null)
  return c.json({ success: true })
})

// GET /api/admin/ads/influencer-pool/export?format=xls|csv — 🎯 풀 전체 다운로드 (2026-07-20 대표 "엑셀 + 카테고리별 분리")
//   실체는 influencer-pool-export.ts(스트리밍 xls/csv 빌더) — 600줄 캡 준수 위해 분리.
//   ?platform=youtube|naver_blog|naver_cafe|… → 매체별 분리 파일(2026-07-28 대표 요청). 없으면 전체(기존).
// GET /influencer-pool/export?format=&platform=&contactable=1&minScore=70 — 📇 내보내기
//   contactable=1: 수기 제휴 제안용 "지금 연락할 사람"만(이메일 보유·브랜드 제외·미접촉·반송이력 없음).
app.get('/influencer-pool/export', async (c) => buildInfluencerExportResponse(
  c.env.DB, POOL, c.req.query('format') || 'xls', c.req.query('platform') || '',
  { contactable: c.req.query('contactable') === '1', minScore: Number(c.req.query('minScore')) },
))


export { app as adminAdsInfluencerRoutes }
