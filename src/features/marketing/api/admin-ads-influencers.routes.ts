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
import { ensurePerfExtraColumns, personalEmailSqlClause, runReclassifyPool, runYtLiveRefetch, runCategoryRescan } from './influencer-performance'
import { buildCampaignBody, textToHtml, CONSENTED_SEND_MAX, withAdLabel, isNightKST } from './outreach-send'
import { sendEmail } from '@/services/email'
import { classifyCategory } from './influencer-classify'
import { buildInfluencerExportResponse } from './influencer-pool-export'
import { mergeDuplicatePool, reextractPoolContacts } from './influencer-maintenance'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// ── 🎯 인플루언서 공용 풀(자동 수집) 어드민 (2026-07-20, Phase E) ───────────────
//   수집 엔진은 ur-ads 워커 cron. 여기(메인 어드민)는 결과 열람/큐레이션 + 키워드 관리 + 수동 트리거만.
//   ⚠️ 메인 번들 경량 유지 위해 수집/발굴 코드는 import 안 하고 전부 inline SQL(공용 풀 = account_id 0).
const POOL = 0

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
  await ensurePerfExtraColumns(c.env.DB) // channel_published_at(계정 나이) 컬럼 선보강 — 빈목록 레이스 방지
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
  // 이름/핸들 + source_keyword(수집 키워드) 매칭 — "방배" 검색 시 '방배 맛집'으로 찾은 리드도 걸림(지역 시딩 거르기).
  const q = (c.req.query('q') || '').trim().toLowerCase()
  if (q) { where.push('(LOWER(name) LIKE ? OR LOWER(COALESCE(handle,\'\')) LIKE ? OR LOWER(COALESCE(source_keyword,\'\')) LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  // 팔로업 필요 — 팔로업 예정일이 지났거나, 컨택함 상태로 5일+ 무진전(회신/계약 전).
  if (c.req.query('needFollowup') === '1') where.push("((follow_up_at IS NOT NULL AND follow_up_at <= date('now')) OR (status='contacted' AND contacted_at IS NOT NULL AND contacted_at <= datetime('now','-5 days')))")
  // 📥 인바운드 신청만 — 스스로 신청(사전동의)한 리드. 자유 연락 가능.
  if (c.req.query('source') === 'inbound') where.push("source = 'inbound'")
  // 🧹 노이즈 숨김 — 기존 풀에 남은 뉴스·방송·기관·체험단모집·대행 계정 제외(신규는 저장 시점에 이미 필터).
  if (c.req.query('hideNoise') === '1') {
    for (const w of ['뉴스', '신문사', '방송국', '연합뉴스', '체험단', '서포터즈', '기자단', '리뷰어 모집', '마케팅 대행', '광고 대행', '대행사', '구청', '시청']) {
      where.push('name NOT LIKE ?'); binds.push(`%${w}%`)
    }
  }
  const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 200)))
  const offset = Math.max(0, intParam(c.req.query('offset'), 0)) // 페이지네이션 — 풀 전체(1800+) 브라우징
  // 정렬: 기본 'fit'(유어딜 핏 — 스위트스팟 1만~50만 + 네이버블로그 최우선 → 준대형 → 나노 → 초대형).
  //   'subscribers'(구독자순) · 'recent'(최근수집).
  const sort = (c.req.query('sort') || 'fit').trim()
  const orderBy = sort === 'subscribers' ? 'subscriber_count DESC, id DESC'
    : sort === 'recent' ? 'id DESC'
    : sort === 'perf' ? '(recent_avg_views IS NULL) ASC, recent_avg_views DESC, subscriber_count DESC, id DESC' // 📈 최근 평균조회수순(미수집 후순위)
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
  const rows = await c.env.DB.prepare(`SELECT id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, status, memo, category, source_keyword, collected_at, contacted_at, follow_up_at, contact_channel, outreach_draft, source, consented_at, recent_avg_views, recent_avg_comments, recent_posts_30d, email_status, opened_at, replied_at, channel_published_at
    FROM ad_influencer_leads WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset).all().catch(() => null)
  return c.json({ success: true, leads: rows?.results || [], total: totalRow?.n ?? 0, offset, limit })
})

// GET /api/admin/ads/influencer-pool/stats — 누적/최근 실행 통계 + 플랫폼별 카운트
app.get('/influencer-pool/stats', async (c) => {
  await ensureInfluencerSchema(c.env.DB) // 통계도 최신 컬럼(contact_channel/consented_at 등) 참조 — 스키마 선보강(멱등)
  await ensureOutreachColumns(c.env.DB)  // opened/bounced 집계 컬럼 선보강
  const agg = await c.env.DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN platform='youtube' THEN 1 ELSE 0 END) AS youtube,
      SUM(CASE WHEN platform='naver_blog' THEN 1 ELSE 0 END) AS naver_blog,
      SUM(CASE WHEN email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL THEN 1 ELSE 0 END) AS with_contact,
      SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) AS with_email,
      SUM(CASE WHEN platform='youtube' AND email IS NOT NULL THEN 1 ELSE 0 END) AS yt_with_email,
      SUM(CASE WHEN platform='youtube' AND email IS NOT NULL AND (${personalEmailSqlClause()}) THEN 1 ELSE 0 END) AS yt_email_personal,
      SUM(CASE WHEN platform='naver_cafe' THEN 1 ELSE 0 END) AS naver_cafe,
      SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) AS st_new,
      SUM(CASE WHEN status='contacted' THEN 1 ELSE 0 END) AS st_contacted,
      SUM(CASE WHEN status='interested' THEN 1 ELSE 0 END) AS st_interested,
      SUM(CASE WHEN status='contracted' THEN 1 ELSE 0 END) AS st_contracted,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS st_rejected,
      SUM(CASE WHEN status='hold' THEN 1 ELSE 0 END) AS st_hold,
      -- 📊 아웃리치 퍼널: 한 번이라도 컨택한 리드(컨택/관심/계약) = 실제 아웃리치 모수
      SUM(CASE WHEN status IN ('contacted','interested','contracted') THEN 1 ELSE 0 END) AS reached,
      SUM(CASE WHEN status IN ('interested','contracted') THEN 1 ELSE 0 END) AS replied,
      -- 📬 이메일 자동감지(Resend 웹훅): 개봉(engagement)·반송(죽은 주소)
      SUM(CASE WHEN email_status='opened' THEN 1 ELSE 0 END) AS opened,
      SUM(CASE WHEN email_status IN ('bounced','complained') THEN 1 ELSE 0 END) AS bounced,
      -- 컨택 채널 분해(어느 채널이 먹히는지)
      SUM(CASE WHEN contact_channel='email' THEN 1 ELSE 0 END) AS ch_email,
      SUM(CASE WHEN contact_channel='dm' THEN 1 ELSE 0 END) AS ch_dm,
      SUM(CASE WHEN contact_channel='note' THEN 1 ELSE 0 END) AS ch_note,
      SUM(CASE WHEN contact_channel='kakao' THEN 1 ELSE 0 END) AS ch_kakao,
      SUM(CASE WHEN contact_channel='call' THEN 1 ELSE 0 END) AS ch_call,
      SUM(CASE WHEN contact_channel='other' THEN 1 ELSE 0 END) AS ch_other,
      SUM(CASE WHEN contacted_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS contacted7,
      SUM(CASE WHEN (follow_up_at IS NOT NULL AND follow_up_at <= date('now')) OR (status='contacted' AND contacted_at <= datetime('now','-5 days')) THEN 1 ELSE 0 END) AS need_followup,
      SUM(CASE WHEN collected_at >= datetime('now','+9 hours','start of day','-9 hours') THEN 1 ELSE 0 END) AS today, -- '오늘' = KST 자정 기준(롤링 24h 아님)
      SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7
    FROM ad_influencer_leads WHERE account_id = ?`).bind(POOL).first().catch(() => null)
  const stRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_autocollect_stats'").first<{ value: string }>().catch(() => null)
  let run: unknown = null; try { run = stRow?.value ? JSON.parse(stRow.value) : null } catch { run = null }
  // 🛡️ 2026-07-23 전수조사: 자동수집 게이트는 **ur-ads 워커 env** 가 실체(cron 이 그걸 읽음)인데 여기(메인)의
  //   env 를 읽어 "켰는데 안 돌거나/도는데 꺼짐 표시" 양쪽 오류 — 서비스바인딩 health 로 ur-ads 쪽 값을 조회
  //   (실패/미바인딩 시 메인 env 폴백 = 기존 동작).
  let gate = c.env.ADS_AUTO_COLLECT_ENABLED === 'true'
  try {
    if (c.env.ADS?.fetch) {
      const hr = await c.env.ADS.fetch(new Request('https://ur-ads/__ads/health'))
      const hj = await hr.json().catch(() => null) as { gates?: { auto_collect?: boolean } } | null
      if (typeof hj?.gates?.auto_collect === 'boolean') gate = hj.gates.auto_collect
    }
  } catch { /* 폴백 유지 */ }
  // 📊 구글시트 마지막 동기화 상태(무음 실패 가시화) — 있으면 그대로 노출.
  const sheetRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_sheets_last_sync'").first<{ value: string }>().catch(() => null)
  let sheets_sync: unknown = null; try { sheets_sync = sheetRow?.value ? JSON.parse(sheetRow.value) : null } catch { sheets_sync = null }
  return c.json({ success: true, stats: agg || {}, run, gate, sheets_sync })
})

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
  // ⚖️ 동의 강제: consented_at + email 있는 행만 — 미동의/이메일 없는 id 는 조용히 제외(응답에 skipped 로 보고).
  const ph = ids.map(() => '?').join(',')
  const rows = (await c.env.DB.prepare(`SELECT id, name, email FROM ad_influencer_leads
    WHERE account_id = ? AND id IN (${ph}) AND consented_at IS NOT NULL AND email IS NOT NULL`)
    .bind(POOL, ...ids).all<{ id: number; name: string; email: string }>().catch(() => null))?.results || []
  if (!rows.length) return c.json({ success: false, error: '선택한 리드 중 발송 가능한(사전동의 + 이메일 보유) 리드가 없습니다' }, 400)
  let sent = 0; const failedIds: number[] = []; const suppressedIds: number[] = []
  for (const r of rows) {
    const body = buildCampaignBody(template, r.name) // {name} 치환 + 수신거부·전송자정보 강제
    const res = await sendEmail({ to: r.email, subject, html: textToHtml(body) }, c.env.RESEND_API_KEY, c.env.RESEND_FROM, c.env.DB).catch(() => ({ success: false as const, error: 'throw' }))
    if (res.success) {
      sent++
      await c.env.DB.prepare(`UPDATE ad_influencer_leads SET contacted_at = COALESCE(contacted_at, datetime('now')), contact_channel = 'email',
        status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END WHERE id = ? AND account_id = ?`).bind(r.id, POOL).run().catch(() => null)
    } else if ((res as { error?: string }).error === 'suppressed') suppressedIds.push(r.id) // 반송/스팸신고/수신거부 억제 — 재시도 무의미(실패와 구분)
    else failedIds.push(r.id)
  }
  const eligible = new Set(rows.map(r => r.id))
  return c.json({ success: true, sent, failed: failedIds, suppressed: suppressedIds, skipped: ids.filter(id => !eligible.has(id)) })
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
app.get('/influencer-pool/export', async (c) => buildInfluencerExportResponse(c.env.DB, POOL, c.req.query('format') || 'xls'))

// (2026-07-23 전수조사: 구 단발 수집 /influencer-pool/collect 엔드포인트 제거 — UI 는 collect-burst 만 호출,
//  유지되던 두 번째 트리거 경로가 lease 도입 후에도 표면만 넓혀 삭제. 필요 시 collect-burst 가 완전 상위 호환.)

// POST /api/admin/ads/influencer-pool/collect-burst — 🔥 오늘 YT 검색 예산 즉시 소진(버스트)
//   대표 "YT 검색 예산 최대한 바로 다 쓰는 방향". 배경: YT 무료 상한 = 하루 10k units = 검색 100회.
//   워커 한 실행은 30s·서브리퀘스트 한도라 100회를 한 번에 못 쏨(2026-07-20 'Too many subrequests' 사고).
//   병렬 실행은 공유 카운터(ads_yt_search_used)/커서를 경합해 중복 발굴로 쿼터 낭비 → **순차만 안전**.
//   ⇒ 백그라운드에서 수집 런을 연달아(각각 fresh ur-ads 인보케이션 = fresh 예산) 돌려 예산 소진까지 태움.
//   시간/횟수/진전 가드로 워커 과부하·무한루프 차단. 한 클릭에 다 못 태우면 카운터가 영속이라 재클릭/시간당 cron 이 이어받음.
type BurstStats = { youtube_quota_hit?: boolean; yt_budget?: { used?: number; total?: number } }
app.post('/influencer-pool/collect-burst', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const burn = async () => {
    const startedAt = Date.now()
    let prevUsed = -1
    let reason = 'loop_cap' // 🔎 종료 사유 기록(전수조사 — "시작했어요" 이후 블랙박스이던 것 가시화)
    for (let i = 0; i < 40; i++) {
      if (Date.now() - startedAt > 220_000) { reason = 'time_cap'; break } // ⏱️ 시간 예산 — 남은 건 재클릭/cron 이 이어받음
      let body: { chained?: boolean; stats?: BurstStats } | null = null
      try {
        // self-chain 엔드포인트 — ads 에 SELF 바인딩이 있으면 chained=true 로 백그라운드 자가전파(메인 루프 종료).
        const r = await ads.fetch(new Request(`https://ur-ads/__ads/collect-chain?depth=${i}&pu=${prevUsed}`, { method: 'POST' }))
        body = (await r.json().catch(() => null)) as { chained?: boolean; stats?: BurstStats } | null
      } catch { reason = 'fetch_error'; break }
      if (!body) { reason = 'bad_response'; break }
      if (body.chained) { reason = 'chained'; break }          // ads(SELF)가 백그라운드로 자가전파 — 중복발화 방지
      const stats = body.stats
      if (!stats) { reason = 'no_stats'; break }
      if (stats.youtube_quota_hit) { reason = 'quota_hit'; break } // 구글이 초과 선언 — 오늘 끝
      const yb = stats.yt_budget
      if (!yb || typeof yb.used !== 'number' || typeof yb.total !== 'number') { reason = 'busy_or_no_budget'; break } // lease busy 포함
      if (yb.used >= yb.total) { reason = 'budget_done'; break }   // 오늘 예산(기본 100회) 소진 — 완료
      if (yb.used <= prevUsed) { reason = 'no_progress'; break }   // 진전 없음(YT 키워드 소진/YT 불가)
      prevUsed = yb.used
    }
    await c.env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_burst_last', JSON.stringify({ at: new Date().toISOString(), reason, lastUsed: prevUsed })).run().catch(() => null)
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(burn()); return c.json({ success: true, started: true }) }
  await burn().catch(() => null) // 폴백(waitUntil 미지원): 동기 소진
  return c.json({ success: true, started: false })
})

// POST /api/admin/ads/influencer-pool/sheets-sync — 📊 구글시트 수동 동기화(ur-ads 위임, 동기 응답).
//   시트 미러는 수초 내라 결과(행수/에러)를 그대로 전달 — 설정 안내가 사용자에게 보여야 함.
app.post('/influencer-pool/sheets-sync', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  try {
    const r = await ads.fetch(new Request('https://ur-ads/__ads/sheets-sync', { method: 'POST' }))
    const j = await r.json().catch(() => null) as { ok?: boolean; rows?: number; error?: string } | null
    if (j?.ok) return c.json({ success: true, rows: j.rows || 0 })
    return c.json({ success: false, error: j?.error || '동기화 실패' }, 400)
  } catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

export { app as adminAdsInfluencerRoutes }
