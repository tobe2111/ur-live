/**
 * 📮 **보강 큐: 미착수가 재시도보다 먼저다** (2026-10-24 대표 "이메일 수집도 더 잘 되면 좋겠음").
 *
 * ## 무엇이 새고 있었나 (라이브 실측)
 * ```
 *   하루 크롤 1,918회 → 새 이메일 69건 (3.6%)
 *   사유: no_contact 865 · deadline 327 · blocked_host 275 · … · ok 50
 *
 *   사이트 보유 + 이미 시도 + 아직 이메일 없음 : webkr 6,600 · local 2,998   ← 재시도 수율 실측 ~0
 *   한 번도 시도해 본 적 없는 리드            : 16,943 (local 10,953 · storeinfo 4,292 · market 887 …)
 * ```
 * 7일 쿨다운(2026-07-27)은 "상위 200행 매시간 재크롤"을 멈추려고 넣었고 그때는 옳았다. 백로그가
 * 1.7만이 된 지금은 그 쿨다운이 **이미 실패한 행을 처음 보는 행보다 앞에** 돌려보낸다 —
 * 하루 크롤의 약 70%가 그 재시도였다.
 *
 * ## 🩸 처방을 한 번 틀렸다가 측정으로 되돌렸다 (이 파일이 그걸 고정한다)
 * 처음엔 미착수를 **첫 정렬 키**로 올렸다. 그대로 밀면 이메일이 69 → 거의 0 이 됐을 것이다 —
 * 미착수의 **87%가 `commerce`(36만 건, 사이트 0.4%)** 이고 그쪽 크롤 수율은 실측 0 이다.
 * ⇒ 사이트 보유를 1순위로 **유지**하고 그 안에서 미착수를 먼저 본다(실효 대상 2,842건).
 *
 * ## 이 검사가 **못 막는 것**
 * 미착수를 먼저 보는 것이 실제로 이메일을 더 많이 만드는지는 못 잰다(그건 라이브 수율 문제다).
 * 막는 것은 **정렬 키가 조용히 옛 순서로 돌아가는 것**이고, 효과는 배포 후
 * `enrichRollup`(`enriched`·`crawl_reason.ok`)과 `p2.ns_src_*`/`nsok_*` 로 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { noSiteSlotCap, NO_SITE_SLOT_SHARE } from '@/features/marketing/api/enrich-lane'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/enrich-lane.ts'), 'utf8')
/** 대상 선정 쿼리만 떼어 본다 — 파일 전체를 보면 주석의 단어에 걸려 헛돈다. */
const TARGET_SQL = (() => {
  const i = SRC.indexOf('const targets = (await DB.prepare(')
  expect(i, '대상 선정 쿼리를 못 찾으면 이 검사는 아무것도 안 지킨다').toBeGreaterThan(0)
  const j = SRC.indexOf('LIMIT ${targetCap}', i)
  expect(j).toBeGreaterThan(i)
  return SRC.slice(i, j)
})()

describe('보강 대상 정렬', () => {
  it('🔴 정렬 키 순서는 **사이트 보유 → 미착수 → tier1** 이다', () => {
    const order = TARGET_SQL.slice(TARGET_SQL.indexOf('ORDER BY'))
    const iSite = order.indexOf("website IS NOT NULL AND website != '' THEN 0")
    const iVirgin = order.indexOf('enrich_checked_at IS NULL THEN 0')
    const iTier = order.indexOf('tier = 1 THEN 0')
    expect(iSite, '사이트 보유 키가 없다').toBeGreaterThanOrEqual(0)
    expect(iVirgin, '미착수 키가 없다').toBeGreaterThanOrEqual(0)
    expect(iTier, 'tier1 키가 없다').toBeGreaterThanOrEqual(0)
    expect(iSite).toBeLessThan(iVirgin)
    expect(iVirgin).toBeLessThan(iTier)
  })

  it('🩸 미착수를 **첫 키로 올리면 안 된다** — 큐 머리가 수율 0 인 commerce 36만 건이 된다', () => {
    // 2026-10-24 실측(보강 WHERE 전체, enrich_checked_at IS NULL):
    //   commerce 361,984(사이트 1,546) · storeinfo 33,756(70) · local 16,632(277) · market 1,333(0)
    //   webkr 884(884) · nara 731(65)   ⇒ 미착수의 87%가 commerce 다.
    // 그리고 2026-07-29 실측: "크롤로 연락처를 얻은 온라인판매 리드는 한 건도 없다".
    // 이 세션이 처음엔 첫 키로 올렸다가 이 측정으로 되돌렸다 — 그 회귀를 여기서 고정한다.
    const order = TARGET_SQL.slice(TARGET_SQL.indexOf('ORDER BY'))
    expect(order, '미착수가 첫 정렬 키면 수율 0 인 보류 36만 건이 큐를 독식한다')
      .not.toContain('ORDER BY (CASE WHEN enrich_checked_at IS NULL THEN 0 ELSE 1 END)')
  })

  it('🔒 재시도를 버리지 않는다 — 쿨다운/버전 조건은 그대로 WHERE 에 있다', () => {
    // 미착수가 바닥나면 자동으로 재시도로 돌아가야 한다(큐가 비면 수집이 멎는다).
    expect(TARGET_SQL).toContain("enrich_checked_at < datetime('now', '-7 days')")
    expect(TARGET_SQL).toMatch(/COALESCE\(enrich_v, 0\) < \$\{CRAWL_RULES_VERSION\}/)
  })

  it('🔒 사이트 없는 리드의 슬롯 상한은 그대로다(수율 0 인 다수가 예산을 독식하지 않게)', () => {
    expect(NO_SITE_SLOT_SHARE).toBeGreaterThan(0)
    // 🔒 **1 이면 상한이 아니다** — 사이트 보유분(즉시 크롤 = 최고 수율)에 남겨 두는 몫이 0 이 된다.
    expect(NO_SITE_SLOT_SHARE, '상한이 실제로 몫을 남겨야 한다').toBeLessThan(1)
    expect(noSiteSlotCap(100)).toBe(Math.floor(100 * NO_SITE_SLOT_SHARE))
    expect(noSiteSlotCap(0)).toBe(0)
    expect(noSiteSlotCap(1), '대상이 적어도 최소 1건은 보장(탐색 정지 방지)').toBe(1)
  })

  it('📊 출처별 발견 수율 계수가 살아 있다 — 이 변경의 판정 근거다', () => {
    // 2026-07-29 가 "출처별 발견 수율을 아직 재본 적이 없다" 고 남겼고, 미착수 우선이 되면
    //   storeinfo·market 이 처음으로 그 경로에 닿아 이 계수에 값이 생긴다.
    expect(SRC).toContain("bump(`ns_src_${t.source || 'unknown'}`)")
    expect(SRC).toContain("bump(`nsok_${t.source || 'unknown'}`)")
  })

  it('검사 대상이 실제로 존재한다 — 0건 통과를 성공으로 오인하지 않게', () => {
    expect(TARGET_SQL.length).toBeGreaterThan(300)
    expect(TARGET_SQL).toContain('ORDER BY')
    expect(TARGET_SQL).toContain('FROM ad_company_leads')
  })
})
