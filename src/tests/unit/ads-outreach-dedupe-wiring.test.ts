/**
 * 🔌 **중복 제거가 실제로 두 경로에 붙어 있는가** — 2026-08-04.
 *
 * `dedupeByEmail` 자체의 동작은 `ads-enrich-yt-priority.test.ts` 가 본다. 여기서 보는 건 **배선**이다.
 * 이 기능이 조용히 죽는 방식은 함수가 틀리는 게 아니라 **한쪽에만 붙어 있는 것**이다:
 * 대표의 실제 발송 동선은 **엑셀 내보내기 → 메일 클라이언트**라, 발송 큐만 고치고 내보내기를 빼면
 * 정작 나가는 경로에는 중복이 그대로 남는다(고친 줄 알고 안 고친 형태).
 *
 * ⚠️ 못 보는 것: 실제 D1 결과에 중복이 있는지. 그건 라이브 쿼리로만 판정한다(실측 130그룹/262행).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** 주석을 지운다 — 이 레포가 반복해 당한 *"주석에만 남아도 통과"* 함정을 피하려면 코드만 봐야 한다. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const QUEUE = code(read('src/features/marketing/api/admin-ads-influencers.routes.ts'))
const EXPORT = code(read('src/features/marketing/api/influencer-pool-export.ts'))

const HELPER = code(read('src/features/marketing/api/outreach-queue.ts'))

describe('발송 큐', () => {
  it('🔒 라우트가 조회를 직접 하지 않고 중복 제거가 든 헬퍼를 쓴다', () => {
    expect(QUEUE).toMatch(/const queue = await fetchSendQueuePage</)
    expect(QUEUE).toMatch(/withOutreachTemplate\(queue\)/)
    // 라우트가 자기 SELECT 를 되살리면 중복 제거를 우회한다 — 그 경로가 다시 생기지 않게 막는다.
    expect(QUEUE).not.toMatch(/FROM ad_influencer_leads WHERE \$\{where\}\s*\n\s*ORDER BY/)
  })

  it('🔒 헬퍼가 응답 전에 거른다', () => {
    expect(HELPER).toMatch(/return dedupeByEmail\(/)
  })

  it('🔒 중복분만큼 목록이 짧아지지 않게 넉넉히 읽고 자른다', () => {
    // limit 을 그대로 읽어서 걸러내면 "20명 주세요" 가 17명이 된다 — 매일 쓰는 화면이라 바로 체감된다.
    expect(HELPER).toMatch(/const fetchN = Math\.min\(200, Math\.max\(1, limit\) \* 2\)/)
    expect(HELPER).toMatch(/\.bind\(\.\.\.binds, fetchN\)/)
    expect(HELPER).toMatch(/\.slice\(0, limit\)/)
  })
})

describe('연락 대상 내보내기 — 대표가 실제로 발송하는 경로', () => {
  it('🔒 contactable 일 때만 거른다', () => {
    expect(EXPORT).toMatch(/const outRows = opts\?\.contactable \? dedupeByEmail\(rows\) : rows/)
  })

  it('🔒 CSV·시트 본문이 **거른 쪽**을 쓴다 — 변수만 만들고 안 쓰면 아무 일도 안 일어난다', () => {
    expect(EXPORT).toMatch(/outRows\.map\(r => cells\(r\)/)          // CSV
    expect(EXPORT).toMatch(/for \(const r of outRows\)/)             // 카테고리별 시트
    expect(EXPORT).toMatch(/rs: outRows/)                            // 전체 시트
    // 페이지 수집 루프(rows.push)와 길이 검사 외에 원본 rows 를 본문에서 다시 쓰면 누수다.
    expect(EXPORT).not.toMatch(/rs: rows\b/)
  })

  it('🔒 전체 내보내기는 **거르지 않는다** — 그건 풀의 사본이라 행이 사라지면 안 된다', () => {
    expect(EXPORT).toMatch(/opts\?\.contactable \? dedupeByEmail/)   // 조건부여야 한다
    expect(EXPORT).not.toMatch(/const outRows = dedupeByEmail\(rows\)/)
  })
})
