import type { D1Database } from '@cloudflare/workers-types'
import { isLikelyNoise, type InfluencerLead } from './influencer-discovery'
import { looksLikeBrandChannel, scoreLead } from './influencer-quality'
import { resolveCategory, classifyCategory } from './influencer-classify'
import { regionFromKeyword } from './influencer-region'
import { sanitizeLeadHandle } from './influencer-handle'

/**
 * 💾 수집 리드 저장 — `influencer-auto-collect.ts` 에서 추출(2026-07-29, 600줄 캡).
 *   수집 엔진 파일은 여러 세션이 계속 블록을 얹는 자리라, "저장" 관심사를 통째로 떼어 성장 여지를 만든다.
 *   동작은 이전과 동일(byte-동일 로직 이동) — 필터·2패스 저장·백필 규칙 전부 그대로.
 */

/** 🎯 유튜브 최소 구독자(대표 지시 2026-07-21) — 미만 채널은 수집 안 함(소형 노이즈 컷). 네이버/카페/티스토리는 지표 없어 무관. */
export const MIN_YT_SUBSCRIBERS = 1000

/**
 * 🚀 일괄 저장(DB.batch) — 청크당 1 batch(Free 한도 보호).
 *   2026-07-20 ①: INSERT OR IGNORE → **컨택 백필 upsert**. 신규는 INSERT, 기존 리드는 이메일/인스타/틱톡/
 *   링크가 **비어있을 때만** 새로 찾은 값으로 채움(늦게 발견된 컨택 자동 반영 — 자가치유). status/memo(수동
 *   큐레이션)·category 는 불변. DO UPDATE 의 WHERE 로 실제 채울 게 있을 때만 change=1 → 중복 인플레 없음.
 */
export async function saveLeadsBatch(
  DB: D1Database, accountId: number, rawLeads: InfluencerLead[],
  meta: { category?: string | null; sourceKeyword?: string | null },
): Promise<number> {
  // 🧹 노이즈(뉴스·방송·기관·대행) 제외 + 🎯 유튜브는 구독자 1000 이상만 수집(대표 지시 — 소형 노이즈 컷).
  //   예외(F-25): 구독자 비공개 채널(API 가 0 반환)은 총조회 200만+ 면 대형으로 보고 통과(discovery 저장 필터와 정합).
  const leads = rawLeads.filter(l => !isLikelyNoise(l.name, l.description)
    && !(l.platform === 'youtube' && (l.subscriber_count || 0) < MIN_YT_SUBSCRIBERS && !((l.subscriber_count || 0) === 0 && (l.view_count || 0) >= 2_000_000)))
  if (!leads.length) return 0
  // 2-패스: ① INSERT OR IGNORE — changes=1 ⟺ **진짜 신규**(백필 UPDATE 를 신규로 오집계하던 버그 방지:
  //   기존 upsert 의 ON CONFLICT DO UPDATE 는 백필도 changes=1 이라 saved 가 부풀어 saved===0 헬스체크를 가림).
  //   ② 이미 있던(changes=0) 행만 별도 UPDATE 로 연락처 백필 — 신규 카운트에 포함 안 함(기존 백필 의미 동일).
  // 📍 활동 지역 — 배치 전체가 같은 수집 키워드라 1회만 계산. '' = 확인했지만 지역 없음(재검사 방지).
  const region = regionFromKeyword(meta.sourceKeyword) ?? ''
  const insSql = `INSERT OR IGNORE INTO ad_influencer_leads
    (account_id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, category, source_keyword, is_brand, last_post_at, category_source, region, lead_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  // 🛡️ 2026-07-23 전수조사(F-32): 기존엔 "채울 컨택이 있을 때만" UPDATE 라 이미 컨택 있는 리드는 구독자수·소개글이
  //   영원히 수집 당시 값(스테일) → 재분류가 낡은 소개글로 판정. 재조우 시 구독자/총조회/소개글은 항상 최신화
  //   (컨택은 COALESCE 빈칸만, status/memo/category 수동 큐레이션 불변).
  const backfillSql = `UPDATE ad_influencer_leads SET
      email = COALESCE(email, ?), instagram = COALESCE(instagram, ?), tiktok = COALESCE(tiktok, ?), links = COALESCE(links, ?),
      subscriber_count = CASE WHEN ? > 0 THEN ? ELSE subscriber_count END,
      view_count = CASE WHEN ? > 0 THEN ? ELSE view_count END,
      description = CASE WHEN ? != '' THEN ? ELSE description END,
      last_post_at = CASE WHEN ? IS NOT NULL AND (last_post_at IS NULL OR last_post_at < ?) THEN ? ELSE last_post_at END
    WHERE account_id = ? AND platform = ? AND channel_id = ?`
  let saved = 0
  const CHUNK = 50
  for (let i = 0; i < leads.length; i += CHUNK) {
    const slice = leads.slice(i, i + CHUNK)
    const insStmts = slice.map(l => {
      const cat = resolveCategory(l.name, l.description, meta.category) // 🏷️ 콘텐츠 신호 우선 분류
      const catSrc = cat ? (classifyCategory(l.name, l.description) ? 'content' : 'keyword') : null // 분류 근거(정확도 가시화)
      // 🚧 핸들 저장 직전 정규화 — 파서가 호스트/스킴 조각을 남기는 경로가 아직 열려 있다.
      //   (현재 코드로 재현: 카페 파서에 블로그 URL → 'blog.naver.com', 외부 URL → 'xxx.tistory.com',
      //    블로그 파서에 외부/무id → 'https:'). 2026-07-28 에 12,357건을 복구했지만(#822) 그건 사후
      //    치료였고, 생성 지점은 여기 하나뿐이라 여기서 막으면 새 플랫폼도 자동으로 같은 규칙을 받는다.
      const handle = sanitizeLeadHandle(l.platform, l)
      const brand = looksLikeBrandChannel(l.name, l.description) ? 1 : 0 // 🏢 브랜드 공식 채널 태깅(삭제 아님 — 숨김 필터용)
      /**
       * 🏅 **저장 시점 즉시 채점**(2026-07-29, #841) — 신규 리드가 큐 뒤에 갇히던 것.
       *   `lead_score` 가 NULL 이면 발송 큐·점수 정렬이 `(lead_score IS NULL) ASC` 로 **미채점을 후순위**로 민다.
       *   점수는 야간 정비(quality 패스)가 4,500명씩 커서로 도는데 38,374명이면 한 바퀴 최대 ~42시간이라,
       *   하루 700명씩 들어오는 신규는 그동안 목록에 안 나온다(발송이 수동이라 그 지연이 곧 손실).
       *   ⇒ scoreLead 는 **순수함수**(DB 왕복 0) — 저장하면서 같이 계산하지 않을 이유가 없다.
       *   측정 전이라 활동성은 중립으로 잡히고, 이후 quality 패스가 실측값으로 덮어쓴다(멱등).
       */
      const { score } = scoreLead({
        platform: l.platform, subscriber_count: l.subscriber_count, email: l.email,
        instagram: l.instagram, links: l.links, category: cat, is_brand: brand,
        url: l.url, last_post_at: l.last_post_at ?? null,
      })
      return DB.prepare(insSql).bind(
        accountId, l.platform, l.channel_id, handle, l.name.slice(0, 120), l.url,
        l.subscriber_count, l.view_count, l.video_count, l.country, l.thumbnail,
        l.email, l.instagram, l.tiktok, l.links, l.description.slice(0, 500),
        cat, meta.sourceKeyword ?? null,
        brand,
        l.last_post_at ?? null, // 📝 블로거 마지막 글 날짜(검색 postdate — RSS 차단 무관 활동 신호)
        catSrc,
        region, // 📍 활동 지역(수집 키워드 접두) — 서비스몰 '지역 맞춤 매칭'의 쿼리 키
        score,  // 🏅 즉시 채점(#841) — NULL 이면 큐 뒤로 밀린다
      )
    })
    const rs = await DB.batch(insStmts).catch(() => null)
    const existing: typeof slice = []
    slice.forEach((l, idx) => { if (rs?.[idx]?.meta?.changes === 1) saved++; else existing.push(l) }) // 신규만 카운트
    if (existing.length) { // 기존 행 백필(신규 아님) — 컨택 빈칸 채움 + 규모/소개글 최신화
      await DB.batch(existing.map(l => {
        const d = l.description.slice(0, 500)
        const lp = l.last_post_at ?? null
        return DB.prepare(backfillSql).bind(
          l.email, l.instagram, l.tiktok, l.links, l.subscriber_count, l.subscriber_count,
          l.view_count, l.view_count, d, d, lp, lp, lp,
          accountId, l.platform, l.channel_id,
        )
      })).catch(() => null)
    }
  }
  return saved
}
