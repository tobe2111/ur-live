/**
 * 📊 인플루언서 공용 풀 통계 페이로드 — `admin-ads-influencers.routes.ts` 에서 분리(2026-07-28, 600줄 캡).
 *   라우트는 인증/응답만 맡고, "무엇을 세는가"는 여기 한곳에 모은다.
 *   ⚠️ 공용 풀 = `ad_influencer_leads.account_id = 0`. 읽기 전용(집계) — 큐레이션/발송은 라우트 소관.
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { ensureInfluencerSchema } from './influencer-discovery'
import { ensureOutreachColumns } from './outreach-webhook'
import { ensurePerfExtraColumns, personalEmailSqlClause } from './influencer-performance'
import { ensureQualityColumns } from './influencer-quality'
import { getFunnelTailStats } from './lead-claim'
import { getAdsPoolDiag } from './ads-pool-diag' // 진단 스탬프(수집/정비/시트/보강 레인) SSOT — 중복 구현 금지

const POOL = 0

/** 📣 모집 캠페인 — 수집 리드에게 신청(동의)을 안내한 시점. 전환율 분모(recruited)/분자(consented) 산출용. */
const _recruitColDone = new WeakSet<object>()
export async function ensureRecruitColumn(DB: D1Database) {
  if (_recruitColDone.has(DB)) return
  _recruitColDone.add(DB)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN recruited_at TEXT').run().catch(() => null)
}

/** 어드민 인플루언서 풀 대시보드 1회 조회 페이로드(집계 + 마지막 실행/정비/보강 스냅샷 + 게이트). */
export async function buildInfluencerPoolStats(env: Env): Promise<Record<string, unknown>> {
  const DB = env.DB
  await ensureInfluencerSchema(DB)  // 통계도 최신 컬럼(contact_channel/consented_at 등) 참조 — 스키마 선보강(멱등)
  await ensureOutreachColumns(DB)   // opened/bounced 집계 컬럼 선보강
  await ensureQualityColumns(DB)    // is_brand/lead_score 집계 선보강
  await ensurePerfExtraColumns(DB)  // last_post_at/pub_checked_at — 아래 보강 진행률이 참조
  await ensureRecruitColumn(DB)     // 📣 recruited_at(모집 전환 분모)
  const agg = await DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN platform='youtube' THEN 1 ELSE 0 END) AS youtube,
      SUM(CASE WHEN platform='naver_blog' THEN 1 ELSE 0 END) AS naver_blog,
      SUM(CASE WHEN email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL THEN 1 ELSE 0 END) AS with_contact,
      SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) AS with_email,
      SUM(CASE WHEN platform='youtube' AND email IS NOT NULL THEN 1 ELSE 0 END) AS yt_with_email,
      SUM(CASE WHEN platform='youtube' AND email IS NOT NULL AND (${personalEmailSqlClause()}) THEN 1 ELSE 0 END) AS yt_email_personal,
      SUM(CASE WHEN platform='naver_cafe' THEN 1 ELSE 0 END) AS naver_cafe,
      -- 📝 블로거 보강 진행률(2026-07-28) — 풀의 74%가 블로거인데 활동성/연락처가 한 번도 측정된 적 없었다.
      --    전용 보강 레인이 실제로 백로그를 줄이는지 이 숫자 하나로 판정한다(줄지 않으면 레인이 안 도는 것).
      SUM(CASE WHEN platform='naver_blog' AND perf_checked_at IS NULL THEN 1 ELSE 0 END) AS nb_unmeasured,
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
      SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7,
      -- 📥 사전동의(자동발송 가능 모수) + 🏢 브랜드 공식 채널 태깅 수 + 🏅 채점 완료 수
      SUM(CASE WHEN consented_at IS NOT NULL THEN 1 ELSE 0 END) AS consented,
      SUM(CASE WHEN is_brand = 1 THEN 1 ELSE 0 END) AS brand_tagged,
      -- 🚫 소개글에 제안 거부를 명시한 리드(발송 큐 제외 대상) — 태깅만, 삭제 아님.
      SUM(CASE WHEN opted_out = 1 THEN 1 ELSE 0 END) AS opted_out,
      SUM(CASE WHEN lead_score IS NOT NULL THEN 1 ELSE 0 END) AS scored,
      SUM(CASE WHEN lead_score >= 70 THEN 1 ELSE 0 END) AS score_hot,
      -- 🏷️ 분류 근거(정확도 가시화): content=이름·소개글 규칙 / topic=유튜브 자체분류 / keyword=수집 키워드 상속(재검증 대상)
      SUM(CASE WHEN category IS NOT NULL THEN 1 ELSE 0 END) AS categorized,
      SUM(CASE WHEN category IS NOT NULL AND category_source = 'content' THEN 1 ELSE 0 END) AS cat_content,
      SUM(CASE WHEN category IS NOT NULL AND category_source = 'topic' THEN 1 ELSE 0 END) AS cat_topic,
      SUM(CASE WHEN category IS NOT NULL AND COALESCE(category_source, 'keyword') = 'keyword' THEN 1 ELSE 0 END) AS cat_keyword,
      -- 📣 모집 전환: 안내한 리드(분모) 대비 실제 신청(동의)한 리드(분자) — 풀이 '쓸 수 있는 재고'로 바뀌는 비율.
      SUM(CASE WHEN recruited_at IS NOT NULL THEN 1 ELSE 0 END) AS recruited,
      SUM(CASE WHEN recruited_at IS NOT NULL AND consented_at IS NOT NULL THEN 1 ELSE 0 END) AS recruit_converted
    FROM ad_influencer_leads WHERE account_id = ?`).bind(POOL).first().catch(() => null)
  // 📊 카테고리별 전환 — "어떤 카테고리가 실제로 회신·계약으로 이어지나"(발송 문구/타겟 조정 근거).
  //   컨택 이력이 있는 카테고리만, 컨택 많은 순 상위 8개.
  const catFunnel = await DB.prepare(`SELECT COALESCE(category, '미분류') AS category,
      COUNT(*) AS total,
      SUM(CASE WHEN status IN ('contacted','interested','contracted') THEN 1 ELSE 0 END) AS reached,
      SUM(CASE WHEN status IN ('interested','contracted') THEN 1 ELSE 0 END) AS replied,
      SUM(CASE WHEN status = 'contracted' THEN 1 ELSE 0 END) AS contracted,
      SUM(CASE WHEN consented_at IS NOT NULL THEN 1 ELSE 0 END) AS consented
    FROM ad_influencer_leads WHERE account_id = ?
    GROUP BY COALESCE(category, '미분류') HAVING reached > 0 ORDER BY reached DESC LIMIT 8`)
    .bind(POOL).all().catch(() => null)
  // 🔗 퍼널 뒷단(가입 → 첫 판매) — 별도 쿼리(적립 원장 조인이라 위 집계와 분리). 실패 시 0.
  const tail = await getFunnelTailStats(DB).catch(() => ({ joined: 0, first_sale: 0 }))
  // 📊 진단 스탬프 묶음(마지막 수집·lease·시트 동기화·야간 정비·📝 보강 레인) — `ads-pool-diag.ts` SSOT.
  const diag = await getAdsPoolDiag(DB)
  // 🛡️ 2026-07-23 전수조사: 자동수집 게이트는 **ur-ads 워커 env** 가 실체(cron 이 그걸 읽음)인데 메인의
  //   env 를 읽어 "켰는데 안 돌거나/도는데 꺼짐 표시" 양쪽 오류 — 서비스바인딩 health 로 ur-ads 쪽 값을 조회
  //   (실패/미바인딩 시 메인 env 폴백 = 기존 동작).
  let gate = env.ADS_AUTO_COLLECT_ENABLED === 'true'
  // 📊 시트 미러 게이트도 같은 health 응답에서 가져온다(추가 왕복 0). 이게 없으면 어드민이 "34시간째
  //   멈춰 있어요 — 매시간 도는 작업입니다"를 **꺼져 있을 때도** 띄운다(2026-07-28: 실제로 그랬다).
  //   '고장'과 '꺼짐'은 다음 행동이 정반대라 반드시 구분돼야 한다.
  let sheetsGate: boolean | null = null
  try {
    if (env.ADS?.fetch) {
      const hr = await env.ADS.fetch(new Request('https://ur-ads/__ads/health'))
      const hj = await hr.json().catch(() => null) as { gates?: { auto_collect?: boolean; sheets_sync?: boolean } } | null
      if (typeof hj?.gates?.auto_collect === 'boolean') gate = hj.gates.auto_collect
      if (typeof hj?.gates?.sheets_sync === 'boolean') sheetsGate = hj.gates.sheets_sync
    }
  } catch { /* 폴백 유지 */ }
  return {
    stats: { ...(agg || {}), ...tail },
    gate,
    sheets_gate: sheetsGate, // null = ur-ads 미바인딩/조회 실패(알 수 없음 — 경고를 단정하지 않는다)
    ...diag,
    category_funnel: catFunnel?.results || [],
  }
}
