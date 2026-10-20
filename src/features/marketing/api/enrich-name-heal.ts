/**
 * 🏷️ 이름 치유 소급 — 보강 폭포수의 Phase 3 (2026-07-28 모듈 분리).
 *
 *   대상: **연락처는 이미 있는데 이름만 제목-파편**("데이터 토론"·"insight")인 `source='webkr'` 행.
 *
 *   🩸 **2026-08-10 — 내가 만든 이음매를 내가 막는다.** 08-08 규칙 변경으로 본문에서만 맞던 행이
 *   `evidence` → `keyword` 로 내려갔는데 이 쿼리는 `none` 만 봤다 → 방금 강등시킨 행이 영영 치유 밖.
 *
 *   🔴 **2026-08-14 — 신뢰도 필터를 통째로 버렸다** (대표 *"최대한 이상적으로 끝까지"*).
 *   `keyword` 를 넣고 `evidence` 를 뺀 것도, 제목 구분자만 예외로 넣은 것도 **미봉책이었다**:
 *   실측 778건 중 **158건이 `evidence` 라는 이유로 영영 확인 대상 밖**이었다(`골목상권 분포`).
 *   `evidence` 는 *"이름에 업종어가 있다"* 는 뜻이지 *"진짜 상호다"* 가 아니다 — 페이지 제목에도
 *   업종어는 흔하다. ⇒ **webkr 은 이름 출처가 검색결과 제목이므로 신뢰도로 거를 근거가 처음부터 없다.**
 *   **전수 1회** 확인으로 바꾸고, `name_verified` 도장이 '정확히 한 번'을 보장한다(총 크롤 = 행 수).
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
        AND COALESCE(name_verified, 0) = 0
        AND website IS NOT NULL AND website != '' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))
      ORDER BY id DESC LIMIT 8`)
    .all<{ id: number; company_name: string; category: string | null; source_keyword: string | null; website: string }>().catch(() => null))?.results || []
  bump?.('heal_picked')                 // 이번 회차가 Phase 3 에 도달은 했는가(예산이 남았는가)
  const verified: number[] = []         // 이번 회차에 '확인 완료' 도장을 찍을 id (숫자만 — 문자열 보간 안전)
  for (const t of healTargets) {
    // 벽시계도 함께 본다 — 시간이 끝났는데 D1 치유만 계속 돌면 라운드 종료(스냅샷·학습)를 못 마친다.
    if (budget.left <= 2 || budget.limitHit || (!!budget.deadline && Date.now() >= budget.deadline)) break
    // 🩸 2026-08-10 대표 신고("파트너들 이름이 왜이래") — 여기가 그 원인이었다.
    //   라이브 실측으로 나온 이름들: `가입인사`(당근 커뮤니티 글 제목) · `소상공인 자생력 강화`(사업명) ·
    //   `마케팅 대행`(검색어). 셋 다 괄호도 따옴표도 길지도 않아 `suspectCompanyName` 이 **false** 다.
    //   그 휴리스틱은 "제목처럼 생겼나"를 볼 뿐, **평범하게 생긴 제목**은 못 가른다.
    //
    //   ⇒ **webkr 은 이름 출처가 검색결과 제목이라 신뢰할 근거가 처음부터 없다.** 그래서 분류 신뢰도로
    //     거르지 않고 **전수 1회** 사이트에 직접 물어본다(og:site_name). 허위 0 은 유지된다:
    //     채택하는 값은 그 사이트가 스스로 선언한 이름뿐이다.
    //   ⚠️ 비용은 `name_verified` 도장(행당 정확히 1회) + 회당 8건 캡이 막는다 — 총 크롤 = webkr 행 수.
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
    if (budget.limitHit) break // 도장 없이 중단(한도 뒤 도장은 재시도 기회만 태운다)
    // 🏷️ **판정이 났을 때만 확인 도장** — 한도·시간에 잘린 크롤은 사이트의 문제가 아니라 우리 사정이라
    //   도장을 찍으면 그 행은 **영영 미확인으로 굳는다**(전수 1회의 '1회'를 빈손으로 써 버린다).
    if (c.reason !== 'subreq_limit' && c.reason !== 'deadline') verified.push(t.id)
    await stamp(t.id)
  }
  // 확인 도장은 **한 번에** 쓴다(회차당 D1 1회) — 행마다 쓰면 8건에 8쿼리, 무료 플랜에선 그게 곧 수집량이다.
  if (verified.length) {
    spendD1()
    await DB.prepare(`UPDATE ad_company_leads SET name_verified = 1 WHERE id IN (${verified.join(',')})`).run().catch(() => null)
  }
}
