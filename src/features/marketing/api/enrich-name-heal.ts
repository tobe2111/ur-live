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
 *   ⚠️ `evidence`(이름에서 근거를 얻은 행)는 **원칙적으로** 넣지 않는다 — 이미 실명이라 크롤이 낭비다.
 *   🔴 **단 하나의 예외(2026-08-13)**: 이름에 **breadcrumb 구분자**(`&gt;`·`>`·`｜`)가 있으면 넣는다.
 *     업종어가 들어 있어 `evidence` 로 분류됐지만 사람이 보면 회사 이름이 아닌 것들이다 —
 *     `현장교육 &gt; 현장교육조회`(edu.sbiz.or.kr) · `성장대로｜인천소상공인종합지원포털`.
 *     ⚠️ **앰퍼샌드(`&amp;`)는 제외한다** — 초안이 엔티티 전체를 잡았다가 `SM C&C 성수`·`S&K세무회계컨설팅`
 *     같은 **진짜 상호 14건**을 오탐한 것을 라이브에서 확인하고 좁혔다.
 *     실측 187건의 `evidence` 중 대부분은 `종합광고대행사 시월기획` 처럼 진짜 상호라 통째로 넣지 않는다.
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
  /**
   * 📊 계수기 — **이 단계엔 계측이 아예 없었다**(2026-08-13 대표 *"실재하는데 업체명이 틀린 경우가 많아"*).
   *   커버리지는 계산할 수 있어도 *"얼마나 빨리 없어지나"* 는 답할 수 없었다: 회차당 8건 캡이고
   *   잔여 예산이 있을 때만 도는데, **몇 번 돌았고 몇 건을 고쳤는지 아무도 안 셌다.**
   *   ⇒ 대표가 "아직도 많다"고 느끼는 이유가 커버리지인지 **속도**인지 이 숫자가 가른다.
   */
  bump?: (k: string) => void
}

/** Phase 3 실행 — 예산이 남아 있고 한도에 안 부딪혔을 때만 호출된다. */
export async function healSuspectNames({ DB, budget, stamp, crawlContact, spendD1, bump }: HealDeps): Promise<void> {
  const { suspectCompanyName, classifyLead } = await import('./company-classify')
  spendD1()
  // 🔴 **`evidence` 인데 페이지 제목인 행도 집는다** (2026-08-13 대표 *"이 불일치 문제는 심각해"*).
  //   기존 조건은 `confidence IN ('none','keyword')` 뿐이라, 업종어가 이름에 들어 있어 **근거 있음**으로
  //   분류된 제목 파편이 통째로 빠졌다 — 실측 187건 중 `현장교육 &gt; 현장교육조회`(edu.sbiz.or.kr) ·
  //   `성장대로｜인천소상공인종합지원포털` 류. **엔티티·제목 구분자를 가진 상호는 없다**(구조적 사실).
  //   ⚠️ `evidence` 전체를 넣지는 않는다 — 그 187건 대부분은 `종합광고대행사 시월기획` 처럼 진짜 상호이고,
  //     다시 크롤하면 예산만 태운다(무료 플랜에선 그게 곧 수집량이다).
  const healTargets = (await DB.prepare(`SELECT id, company_name, category, source_keyword, website FROM ad_company_leads
      WHERE source = 'webkr' AND merged_into IS NULL AND status = 'new'
        AND (classify_confidence IN ('none', 'keyword')
             OR company_name LIKE '%&gt;%' OR company_name LIKE '%&lt;%' OR company_name LIKE '%&quot;%'
             OR company_name LIKE '%|%' OR company_name LIKE '%｜%' OR company_name LIKE '%>%')
        AND website IS NOT NULL AND website != '' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))
        AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now', '-7 days'))
      ORDER BY id DESC LIMIT 8`)
    .all<{ id: number; company_name: string; category: string | null; source_keyword: string | null; website: string }>().catch(() => null))?.results || []
  bump?.('heal_picked')                 // 이번 회차가 Phase 3 에 도달은 했는가(예산이 남았는가)
  for (const t of healTargets) {
    // 벽시계도 함께 본다 — 시간이 끝났는데 D1 치유만 계속 돌면 라운드 종료(스냅샷·학습)를 못 마친다.
    if (budget.left <= 2 || budget.limitHit || (!!budget.deadline && Date.now() >= budget.deadline)) break
    // 🩸 2026-08-10 대표 신고("파트너들 이름이 왜이래") — 여기가 그 원인이었다.
    //   라이브 실측으로 나온 이름들: `가입인사`(당근 커뮤니티 글 제목) · `소상공인 자생력 강화`(사업명) ·
    //   `마케팅 대행`(검색어). 셋 다 괄호도 따옴표도 길지도 않아 `suspectCompanyName` 이 **false** 다.
    //   그 휴리스틱은 "제목처럼 생겼나"를 볼 뿐, **평범하게 생긴 제목**은 못 가른다.
    //
    //   ⇒ 이 쿼리가 이미 고른 것은 `confidence IN ('none','keyword')` = **이름을 믿을 근거가 없는 행**이다.
    //     근거가 없는데 휴리스틱으로 한 번 더 걸러 낼 이유가 없다 — 그냥 **사이트에 직접 물어본다**
    //     (og:site_name). 허위 0 은 유지된다: 채택하는 값은 그 사이트가 스스로 선언한 이름뿐이다.
    //   ⚠️ 비용은 7일 쿨다운 도장(`enrich_checked_at`) + 회당 8건 캡이 막는다 — 같은 행을 반복 크롤하지 않는다.
    bump?.('heal_try')
    const c = await crawlContact(t.website, budget, undefined, t.category === '미디어')
    if (!c.siteName) bump?.('heal_no_sitename')   // 사이트가 자기 이름을 안 밝힌다 = 이 행은 못 고친다
    if (c.siteName && c.siteName !== t.company_name) {
      // 실명 기준 재분류 — 근거 생기면 업종까지 교정, 아니면 keyword 로 승급(분류 확인 카드에서 탈출).
      const cls = classifyLead({ company_name: c.siteName, category: t.category, source: 'webkr', source_keyword: t.source_keyword })
      if (cls.ok) {
        bump?.('heal_renamed')            // 🎯 실제로 이름이 바뀐 건수 — "얼마나 빨리 없어지나"의 분자
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
