/**
 * 🧾 파트너 풀 스키마 DDL 이관 (2026-07-29) — `runDdlOnce` 로 옮기며 **문장을 흘리지 않았는지** 고정.
 *
 *   왜 옮겼나: 21개 DDL 을 **매 콜드 인보케이션마다** 실행했다. 무료 플랜 천장이 50~60 인데 스키마에만
 *   21+게이트3 = 24 를 썼다(보강 레인 예산 60 의 40%). 그래서 라운드가 **잡을 예외도 없이** 죽었다.
 *
 *   ⚠️ 이 이관의 유일한 위험: **문장을 하나 빠뜨리면** 새 DB 에서 그 컬럼/인덱스가 안 생기고,
 *   그 사실은 배포 후 'no such column' 으로만 드러난다. 그래서 목록 자체를 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { COMPANY_DDL } from '@/features/marketing/api/company-discovery'
import { PROSPECT_DDL } from '@/features/marketing/api/store-prospects'

describe('COMPANY_DDL', () => {
  it('문장 수가 유지된다(이관 시 흘림 0)', () => {
    // 2026-08-14: `name_verified` 추가로 21 → 22. **의도적 증가만 여기서 올린다** —
    //   이 래칫의 목적은 리팩토링 중 문장이 **조용히 사라지는 것**을 잡는 것이다.
    // 2026-08-27: 읽기 증폭 인덱스 2개(`classify_todo`·`enrich_order`) 추가로 22 → 24.
    //   같은 커밋에서 인덱스 4개가 `company-ddl-indexes.ts` 로 옮겨졌지만 **`...` 로 펼쳐지므로
    //   COMPANY_DDL 의 문장 수는 그대로**다 — 이 래칫이 그 이관에 흘림이 없었음도 함께 증언한다.
    // 2026-08-30: 카카오 스윕 인덱스(`kakao_queue`) 추가로 24 → 25.
    // 2026-08-30(후속): 수집 크롤 대상 인덱스(`crawl_queue`) 추가로 25 → 26.
    //   스윕을 고친 뒤 라이브에서 회차마다 도는 쿼리를 전부 재 봤더니 같은 모양이 하나 더 있었다
    //   (15건 뽑으려고 402,363행). 근거·설계는 `company-ddl-indexes.ts` ④.
    // 2026-08-31: 일자별 유입 인덱스(`collected_at`) 추가로 26 → 27.
    //   그 쿼리가 전수 스캔 + 정렬이었다(실측 461,191행 — 테이블보다 크다). 근거: company-ddl-indexes ⑤.
    // 2026-08-31(후속): 원부 전화 매칭 식 인덱스(`registry_phone`) 추가로 27 → 28.
    //   업체 DB 최대 소비자였다 — 하루 2,270만 행(전체 읽기의 22%). 근거: company-ddl-indexes ⑥.
    // 2026-09-01: 자가-치유 두 건의 부분 인덱스(`masked_email`·`placeholder_address`) 추가로 28 → 30.
    //   고칠 게 없어도 매 회차 전수 스캔이었다(합계 1,898만 행/일). 근거: company-ddl-indexes ⑦⑧.
    expect(COMPANY_DDL).toHaveLength(30)
  })

  it('두 테이블을 만든다 — 리드 본체 + 반송 억제', () => {
    const joined = COMPANY_DDL.join('\n')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS ad_company_leads')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS ad_email_suppress')
  })

  it('🔒 파이프라인이 의존하는 컬럼이 전부 들어 있다(빠지면 라이브에서 no such column)', () => {
    const joined = COMPANY_DDL.join('\n')
    for (const col of [
      'name_norm',          // 원부 이메일 이식 매칭
      'merged_into',        // 중복 병합(삭제 대신 접기)
      'business_no',        // 사업자번호 기준 dedup
      'enrich_checked_at',  // 크롤 재시도 쿨다운
      'kakao_checked_at',   // 전화 스윕 쿨다운
      'classified_v',       // 분류 규칙 버전(소급 재분류)
      'enrich_v',           // 크롤 규칙 버전
      'nps_members',        // 국민연금 규모
      'contact_source',     // 연락처 출처(허위 0 추적)
      'lead_type',          // partner/store/org 판별
    ]) expect(joined).toContain(col)
  })

  it('조회 경로 인덱스가 유지된다(없으면 풀스캔)', () => {
    const joined = COMPANY_DDL.join('\n')
    for (const idx of ['idx_company_leads_tier', 'idx_company_leads_region', 'idx_company_leads_cat', 'idx_company_leads_active', 'idx_company_leads_name_norm'])
      expect(joined).toContain(idx)
  })

  it('DDL 만 담는다 — 데이터 마이그레이션(UPDATE/DELETE)은 여기 들어오면 안 된다', () => {
    // runDdlOnce 는 체크섬이 같으면 **전부 건너뛴다**. 1회성 데이터 정리를 여기 넣으면
    // 체크섬이 바뀔 때마다 다시 돌아 라이브 데이터를 예상 밖으로 건드린다.
    for (const sql of COMPANY_DDL) {
      expect(/^\s*(CREATE TABLE|ALTER TABLE|CREATE INDEX|CREATE UNIQUE INDEX)/i.test(sql.trim())).toBe(true)
    }
  })
})

/** 매장 후보도 같은 이관(9 DDL) — 대표 우선순위(음식점·카페·미용실·숙박)가 얹히는 테이블이라 더 중요하다. */
describe('PROSPECT_DDL', () => {
  it('문장 수가 유지된다', () => {
    expect(PROSPECT_DDL).toHaveLength(9)
  })

  it('🔒 보강 파이프라인이 의존하는 컬럼이 전부 있다', () => {
    const joined = PROSPECT_DDL.join('\n')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS store_prospects')
    for (const col of ['email', 'website', 'enrich_checked_at', 'enrich_v', 'contact_source']) {
      expect(joined).toContain(col)
    }
  })

  it('정렬·필터가 쓰는 인덱스가 유지된다(우선 업종 정렬은 category 인덱스를 탄다)', () => {
    const joined = PROSPECT_DDL.join('\n')
    for (const idx of ['idx_prospects_region', 'idx_prospects_active', 'idx_prospects_newopen']) {
      expect(joined).toContain(idx)
    }
  })

  it('DDL 만 담는다', () => {
    for (const sql of PROSPECT_DDL) {
      expect(/^\s*(CREATE TABLE|ALTER TABLE|CREATE INDEX|CREATE UNIQUE INDEX)/i.test(sql.trim())).toBe(true)
    }
  })
})
