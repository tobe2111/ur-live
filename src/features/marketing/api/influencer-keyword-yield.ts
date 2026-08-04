/**
 * 🎯 **키워드 목적함수 교정 — "몇 명 모았나"에서 "몇 명 연락 가능한가"로** (2026-08-04 대표 지시).
 *
 * 대표 원문: *"이메일 및 연락처 수집율로 기준해서 개선하면 되잖아."*
 *
 * ## 무엇이 틀려 있었나 (라이브 실측)
 * 키워드 밴딧은 이미 잘 돌고 있다 — 해시태그로 후보를 만들고(자동 7,103개), 수확 없으면 스스로 끈다
 * (7,043개 비활성). 문제는 **무엇을 수확으로 세느냐**다. 지금 기준은 `saved`(리드가 풀에 저장됐나)이고,
 * **연락처가 있는지는 안 본다.** 그런데 유어애즈의 지표는 총 인원이 아니라 *"제안 보낼 수 있는 리드 수"*다
 * (CLAUDE.md). 그래서 이런 일이 벌어진다:
 *
 * ```
 *   금천 네일   리드 118건 · 이메일   0건 → barren_streak 0 · yieldPenalty 0 = "우수"
 *   노원 네일   리드  81건 · 이메일   0건 → 마찬가지 "우수"
 *   먹방        리드  50건 · 이메일  33건 (66%)
 * ```
 * **가장 쓸모없는 키워드가 가장 좋은 점수를 받는다.** `yieldPenalty`(found→saved)가 07-29 에 메운
 * 사각지대의 **한 칸 더 안쪽**이다: 그건 "찾았는데 안 남는" 것을 봤고, 이건 "남았는데 못 부르는" 것을 본다.
 *
 * ## ⚠️ 왜 **유튜브에만** 적용하는가 (이걸 안 가르면 우리 백로그를 키워드 탓으로 돌린다)
 * 네이버 블로그의 이메일 확보율(13.2%)은 **키워드 품질보다 우리 처리 상태에 더 좌우된다** —
 * 발굴 시점 보강 상한(`NAVER_COLLECT_ENRICH_MAX`)이 2026-08-04 에 5→1 로 줄었고(PR #1041, 의도된 절약),
 * 나머지는 별도 보강 레인이 나중에 붙인다. 즉 지금 낮게 나오는 네이버 키워드는 *나쁜 키워드*가 아니라
 * **아직 안 훑은 키워드**일 수 있다. 그걸 근거로 벌점을 주면 **우리 백로그를 키워드 탓으로 돌리는 것**이다.
 *
 * 유튜브는 다르다 — 실측상 **보강을 한 번도 안 거친 리드의 33.4%가 이미 이메일을 갖고 있다**
 * (채널 스니펫에 실려 온다). 즉 수집 시점에 답이 나와 있어 **신호가 깨끗하다.**
 * 게다가 유튜브 검색은 **하루 100회**로 가장 희소한 자원이라, 고칠 값어치도 여기가 가장 크다.
 *
 * ## 왜 증분이 아니라 **주기 재계산**인가
 * 저장 시점에 세면 *나중에* 붙는 연락처를 영영 못 센다. 풀을 다시 세면 **언제 붙었든** 반영된다 —
 * 자가 교정이다. 비용도 낮다: 리드 테이블 **1회 스캔**(GROUP BY) + `DB.batch` 1회(= 서브리퀘스트 1).
 * ⚠️ `source_keyword` 에 인덱스가 없으므로 **키워드마다 상관 서브쿼리를 돌리면 안 된다**(302 × 4.9만 스캔).
 *   반드시 한 번 훑어 JS 에서 맞춘다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { runDdlOnce } from './ads-schema-guard'

/** 유튜브 성과 컬럼 — 멱등 ALTER(이미 있으면 D1 이 오류를 내고 `runDdlOnce` 가 삼킨다). */
export const KEYWORD_YIELD_DDL = [
  'ALTER TABLE ad_discovery_keywords ADD COLUMN yt_leads INTEGER DEFAULT 0',
  'ALTER TABLE ad_discovery_keywords ADD COLUMN yt_contacts INTEGER DEFAULT 0',
]

/**
 * 이만큼 모아 본 뒤에야 확보율을 신뢰한다.
 * ⚠️ 낮추면 갓 만든 키워드가 0% 로 낙인찍혀 **탐색이 죽는다**(`YIELD_EVIDENCE_MIN` 과 같은 정신).
 */
export const CONTACT_EVIDENCE_MIN = 40
/** 이 이상이면 정상 — 손대지 않는다. 유튜브 전체 평균이 33.6% 라 그 절반쯤을 바닥으로 둔다. */
export const CONTACT_OK_RATE = 0.15
/**
 * 0% 일 때의 감점. 우선 카테고리 보너스(+50)를 **혼자서** 상쇄하고 남아야 한다 —
 * 그러지 않으면 "우선 카테고리인데 연락처 0%" 인 키워드가 계속 슬롯을 먹는다(실측된 그 상태).
 */
export const CONTACT_PENALTY_MAX = 70

/**
 * 연락처 확보율 감점(순수 함수 — 그래서 시험 가능하다).
 * @returns 0 이상의 감점. 증거가 부족하면 **0**(모르는 것을 벌주지 않는다).
 */
export function contactPenalty(leads: number | null | undefined, contacts: number | null | undefined): number {
  const n = Math.max(0, leads || 0)
  if (n < CONTACT_EVIDENCE_MIN) return 0
  const rate = Math.max(0, contacts || 0) / n
  if (rate >= CONTACT_OK_RATE) return 0
  return Math.round(((CONTACT_OK_RATE - rate) / CONTACT_OK_RATE) * CONTACT_PENALTY_MAX)
}

/** 집계 한 행 — `recomputeKeywordContactYield` 내부 표현(시험이 직접 만들 수 있게 export). */
export interface KeywordYieldRow { keyword: string; leads: number; contacts: number }

/**
 * 리드 풀 → 키워드별 유튜브 성과. **한 번 훑고** 배치 한 번으로 쓴다.
 * @returns 갱신 시도한 키워드 수(관측용 — 0 이면 집계가 비었다는 뜻이라 화면에서 바로 보인다)
 */
export async function recomputeKeywordContactYield(DB: D1Database): Promise<{ keywords: number; scanned: number }> {
  await runDdlOnce(DB, 'ads_ddl_kw_yield_v1', KEYWORD_YIELD_DDL)
  //   ⚠️ 빈 문자열도 '없음'이다 — `email IS NOT NULL` 만 보면 `''` 를 연락처로 센다(이 레포가 반복해 겪은 형태).
  const agg = await DB.prepare(`
    SELECT source_keyword AS keyword, COUNT(*) AS leads,
           SUM(CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) AS contacts
      FROM ad_influencer_leads
     WHERE platform = 'youtube' AND source_keyword IS NOT NULL AND source_keyword <> ''
     GROUP BY source_keyword`).all<KeywordYieldRow>().catch(() => null)
  const rows = agg?.results || []
  if (!rows.length) return { keywords: 0, scanned: 0 }
  // 배치 1회 = 서브리퀘스트 1회. 키워드가 늘어도 비용이 선형으로 늘지 않는다.
  await DB.batch(rows.map(r => DB.prepare(
    'UPDATE ad_discovery_keywords SET yt_leads = ?, yt_contacts = ? WHERE keyword = ?',
  ).bind(Math.max(0, r.leads || 0), Math.max(0, r.contacts || 0), r.keyword))).catch(() => null)
  return { keywords: rows.length, scanned: rows.reduce((a, r) => a + (r.leads || 0), 0) }
}
