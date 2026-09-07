/**
 * 🎯 링크인바이오 보강 조회가 **부분 인덱스를 이름으로 지정**하는지 — 2026-09-06 실사고 고정.
 *
 * ## 무슨 일이 있었나
 * 2026-08-27 에 이 조회를 위해 부분 인덱스(`idx_ad_inf_leads_bio_links`)를 만들어 뒀는데,
 * **계획기가 그걸 고르지 않았다.** 라이브 실측(같은 WHERE, 같은 데이터):
 * ```
 *   계획기 선택   USING INDEX idx_ad_inf_leads_bio (account_id, bio_checked_at)  → 193,898행
 *   이름 지정     USING INDEX idx_ad_inf_leads_bio_links                         →   2,573행
 * ```
 * `bio_checked_at IS NULL` 이 전체의 99.9%라 그 인덱스는 거르는 일을 못 한다.
 *
 * 결과가 **0건**이라(큐 고갈) 상태줄엔 흔적이 없었고, 샤드 4개 × 시간당 30회차가 매번 19만 행을
 * 읽어 **시간당 2,330만 행을 읽고 아무 일도 안 했다**. 그 읽기가 일일 예산을 태워 레인 창이
 * 하루 3시간으로 좁혀졌고, 창 밖 B2B 수집이 통째로 멈췄다.
 *
 * ⚠️ **이 시험이 못 막는 것**: 실제 실행계획은 확인하지 못한다(D1 이 없다). 인덱스 정의가 바뀌어
 *   같은 이름이 다른 컬럼을 담게 되면 이 시험은 초록불인 채 비용만 돌아온다. WHERE 절과 인덱스
 *   조건의 함의 관계를 손대면 라이브에서 `rows_read` 를 다시 잴 것.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const BIO = 'src/features/marketing/api/influencer-bio-enrich.ts'
const SCHEMA = 'src/features/marketing/api/influencer-schema.ts'
const src = readFileSync(BIO, 'utf8')

describe('링크인바이오 보강 — 고갈된 큐를 전수 스캔하지 않는다', () => {
  it('① 조회가 부분 인덱스를 이름으로 지정한다', () => {
    expect(src, '계획기에 맡기면 idx_ad_inf_leads_bio 를 골라 19만 행을 읽는다')
      .toMatch(/INDEXED BY idx_ad_inf_leads_bio_links/)
  })

  it('② 지정이 실패해도 보강은 멈추지 않는다 (fail-open 폴백)', () => {
    // INDEXED BY 는 인덱스가 없으면 문장 자체가 에러다. 인덱스 부재는 느려질 이유는 돼도
    // 보강이 멈출 이유는 못 된다 — 멈추면 연락처 수집이 조용히 0 이 된다.
    expect(src).toMatch(/await pick\(' INDEXED BY idx_ad_inf_leads_bio_links'\) \|\| await pick\(''\)/)
  })

  it('③ WHERE 가 부분 인덱스 조건을 함의한다 (하나만 빠져도 전수 스캔으로 돌아간다)', () => {
    // 부분 인덱스 조건: links IS NOT NULL AND bio_checked_at IS NULL.
    // 둘 중 하나가 WHERE 에서 빠지면 SQLite 는 그 인덱스를 쓸 수 없다고 판단한다.
    const where = src.slice(src.indexOf('const BIO_WHERE'), src.indexOf('type BioRow'))
    expect(where, 'bio_checked_at IS NULL 이 WHERE 에 없다').toContain('bio_checked_at IS NULL')
    expect(where, 'links IS NOT NULL 이 WHERE 에 없다').toContain('links IS NOT NULL')
  })

  it('④ 그 부분 인덱스가 실제로 생성되는 자리에 있다 (이름만 맞고 없으면 매번 폴백)', () => {
    const schema = readFileSync(SCHEMA, 'utf8')
    expect(schema).toMatch(/idx_ad_inf_leads_bio_links/)
    expect(schema, '부분 조건이 빠지면 인덱스가 전체 행을 담아 절약이 사라진다')
      .toMatch(/WHERE links IS NOT NULL AND bio_checked_at IS NULL/)
  })

  it('⑤ 조회가 한 번만 정의된다 — 문장을 복붙하면 한쪽만 고쳐진다', () => {
    expect((src.match(/FROM ad_influencer_leads\s*\$\{hint\}|FROM ad_influencer_leads\$\{hint\}/g) || []).length)
      .toBeGreaterThan(0)
    expect((src.match(/links LIKE '%linktr\.ee%'/g) || []).length,
      'LIKE 목록이 두 벌이면 반드시 갈린다').toBe(1)
  })
})
