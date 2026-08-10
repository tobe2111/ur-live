/**
 * 🏷️ 이름 치유 소급 — 보강 폭포수의 Phase 3 (2026-07-28 모듈 분리).
 *
 *   대상: **연락처는 이미 있는데 이름만 제목-파편**("데이터 토론"·"insight")인 `source='webkr'` 행.
 *
 *   🩸 **2026-08-10 — 내가 만든 이음매를 내가 막는다.** 08-08 에 "webkr 의 description(=페이지 본문)은
 *   업종 근거가 아니다" 규칙을 넣으면서, 본문에서만 맞던 행들이 `evidence` → **`keyword`** 로 내려갔다.
 *   그런데 이 쿼리는 `confidence='none'` 만 봤다 → **방금 강등시킨 그 행들이 영영 치유 대상이 아니었다.**
 *   그게 대표가 신고한 진흥원(`jepa.kr`) 유형이 계속 남는 이유다: 도메인이 평범한 `.kr` 이고 저장된
 *   이름엔 `진흥원` 이 없어 기관 어휘가 못 잡는데, **사이트가 스스로 선언한 이름**(og:site_name)에는 있다.
 *   ⇒ `keyword`(=검색어로 추정했을 뿐, 근거 없음)도 치유 대상에 넣는다. 실명을 얻으면 아래에서
 *     `classifyLead` 가 다시 돌아 기관이면 `org` 로 내려간다 — 새 규칙 없이 기존 경로가 처리한다.
 *   ⚠️ `evidence`(이름에서 근거를 얻은 행)는 넣지 않는다 — 이미 실명이라 크롤이 낭비다.
 *   Phase 2 는 연락처-없는 행만 돌기 때문에 이 행들은 영영 미치유 → 관리자 '분류 확인 카드'에 계속 쌓인다
 *   (2026-07-27 대표 "분류 확인 카드 수동 부담"). 홈페이지 `og:site_name` 으로 실명 교체 + 실명 기준 재분류.
 *
 *   허위 0: 이름은 **그 사이트가 스스로 선언한 값**만 채택하고, 판단이 안 서면 건드리지 않는다.
 *   비용: 회당 8건 캡(잔여 예산에서만) + 시도 도장 공유(7일 쿨다운).
 */
import type { Env } from '@/worker/types/env'
// FetchBudget 의 선언처는 influencer-discovery(마케팅 레인 공용 타입) — contact-enrich 도 거기서 가져온다.
import type { FetchBudget } from './influencer-discovery'

interface HealDeps {
  DB: Env['DB']
  budget: FetchBudget
  stamp: (id: number) => Promise<void>
  crawlContact: typeof import('./contact-enrich')['crawlContact']
  /** D1 도 서브리퀘스트 — 호출부(company-collect)의 지갑에서 함께 지불해야 학습 분모가 진실이 된다. */
  spendD1: (n?: number) => void
}

/** Phase 3 실행 — 예산이 남아 있고 한도에 안 부딪혔을 때만 호출된다. */
export async function healSuspectNames({ DB, budget, stamp, crawlContact, spendD1 }: HealDeps): Promise<void> {
  const { suspectCompanyName, classifyLead } = await import('./company-classify')
  spendD1()
  const healTargets = (await DB.prepare(`SELECT id, company_name, category, source_keyword, website FROM ad_company_leads
      WHERE source = 'webkr' AND merged_into IS NULL AND status = 'new' AND classify_confidence IN ('none', 'keyword')
        AND website IS NOT NULL AND website != '' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))
        AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now', '-7 days'))
      ORDER BY id DESC LIMIT 8`)
    .all<{ id: number; company_name: string; category: string | null; source_keyword: string | null; website: string }>().catch(() => null))?.results || []
  for (const t of healTargets) {
    // 벽시계도 함께 본다 — 시간이 끝났는데 D1 치유만 계속 돌면 라운드 종료(스냅샷·학습)를 못 마친다.
    if (budget.left <= 2 || budget.limitHit || (!!budget.deadline && Date.now() >= budget.deadline)) break
    if (!suspectCompanyName(t.company_name, t.source_keyword)) { await stamp(t.id); continue } // SQL 근사 필터의 오탐 스킵
    const c = await crawlContact(t.website, budget, undefined, t.category === '미디어')
    if (c.siteName && c.siteName !== t.company_name) {
      // 실명 기준 재분류 — 근거 생기면 업종까지 교정, 아니면 keyword 로 승급(분류 확인 카드에서 탈출).
      const cls = classifyLead({ company_name: c.siteName, category: t.category, source: 'webkr', source_keyword: t.source_keyword })
      if (cls.ok) {
        spendD1()
        await DB.prepare(`UPDATE ad_company_leads SET company_name = ?, category = COALESCE(?, category), subcategory = COALESCE(?, subcategory),
            lead_type = ?, classify_confidence = ? WHERE id = ? AND status = 'new'`)
          .bind(c.siteName.slice(0, 120), cls.confidence === 'evidence' ? cls.category : null, cls.confidence === 'evidence' ? cls.subcategory : null,
            cls.lead_type, cls.confidence === 'none' ? 'keyword' : cls.confidence, t.id).run().catch(() => null)
      }
    }
    if (budget.limitHit) break // 도장 없이 중단(한도 뒤 도장은 7일 쿨다운만 태운다)
    await stamp(t.id)
  }
}
