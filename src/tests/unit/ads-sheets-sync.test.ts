import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { b64url, SHEET_HEADER, cycleRoom, leadToRow, parseSheetCursor, startCursor, type SheetLead } from '@/features/marketing/api/sheets-sync'

/**
 * 📊 2026-07-21 인플루언서 풀 → 구글시트 동기화 순수부 잠금.
 *   헤더↔행 정렬이 어긋나면 시트 컬럼이 통째로 밀림 — 길이/순서 불변식.
 */
const lead: SheetLead = {
  id: 7, platform: 'youtube', name: '방배미식가', handle: '@bb', url: 'https://youtube.com/@bb',
  subscriber_count: 12000, recent_avg_views: 3400, recent_avg_comments: 21, recent_posts_30d: null,
  email: 'a@b.com', instagram: 'bb_ig', tiktok: null, links: 'https://foo.tistory.com', category: '맛집',
  source_keyword: '방배 맛집', status: 'new', contact_channel: null, contacted_at: null,
  follow_up_at: null, source: 'inbound', consented_at: '2026-07-21 01:00:00', memo: null, collected_at: '2026-07-20 10:00:00',
}

describe('leadToRow ↔ SHEET_HEADER 정렬', () => {
  it('열 개수 일치(밀림 방지)', () => {
    expect(leadToRow(lead).length).toBe(SHEET_HEADER.length)
  })
  it('핵심 열 위치 고정 — ID/이름/이메일/상태/동의일', () => {
    const row = leadToRow(lead)
    expect(row[SHEET_HEADER.indexOf('ID')]).toBe(7)
    expect(row[SHEET_HEADER.indexOf('이름')]).toBe('방배미식가')
    expect(row[SHEET_HEADER.indexOf('이메일')]).toBe('a@b.com')
    expect(row[SHEET_HEADER.indexOf('상태')]).toBe('new')
    expect(row[SHEET_HEADER.indexOf('동의일')]).toBe('2026-07-21 01:00:00')
  })
  it('null 은 빈 문자열(시트에 "null" 문자 노출 방지)', () => {
    const row = leadToRow(lead)
    expect(row[SHEET_HEADER.indexOf('틱톡')]).toBe('')
    expect(row[SHEET_HEADER.indexOf('메모')]).toBe('')
    expect(row[SHEET_HEADER.indexOf('月포스팅')]).toBe('') // perf 미수집 = 빈칸(0 과 구분)
  })
  it('📈 성과 열 — 평균조회/평균댓글 위치 고정', () => {
    const row = leadToRow(lead)
    expect(row[SHEET_HEADER.indexOf('평균조회수')]).toBe(3400)
    expect(row[SHEET_HEADER.indexOf('평균댓글')]).toBe(21)
  })
  it('🏅 2026-07-27 확장 열 — 점수/롱폼중앙값/메일상태/분류근거/제외태그 (기계값 미러)', () => {
    const row = leadToRow({ ...lead, lead_score: 72, median_long_views: 2100, shorts_ratio: 40, is_brand: 1, email_status: 'bounced', last_post_at: '2026-07-19', category_source: 'content' })
    expect(row.length).toBe(SHEET_HEADER.length)
    expect(row[SHEET_HEADER.indexOf('점수')]).toBe(72)
    expect(row[SHEET_HEADER.indexOf('롱폼중앙값')]).toBe(2100)
    expect(row[SHEET_HEADER.indexOf('메일상태')]).toBe('bounced')
    expect(row[SHEET_HEADER.indexOf('분류근거')]).toBe('content')
    expect(row[SHEET_HEADER.indexOf('제외태그')]).toBe('brand')
    // 미채점 리드는 전부 빈칸 + 분류근거는 category 있으면 NULL≈keyword
    const bare = leadToRow(lead)
    expect(bare[SHEET_HEADER.indexOf('점수')]).toBe('')
    expect(bare[SHEET_HEADER.indexOf('제외태그')]).toBe('')
    expect(bare[SHEET_HEADER.indexOf('분류근거')]).toBe('keyword')
  })
  /**
   * 🚫 2026-07-29 — 시트에서 손으로 고를 때도 "제안 사절"을 써 둔 사람이 걸러져야 한다.
   *   거부 명시는 브랜드 추정보다 강한 신호라 같은 칸에서 우선한다(열 추가 없이 미러 유지).
   */
  it('🚫 제외태그는 거부 명시가 브랜드보다 우선한다', () => {
    expect(leadToRow({ ...lead, opted_out: 1 })[SHEET_HEADER.indexOf('제외태그')]).toBe('optout')
    expect(leadToRow({ ...lead, opted_out: 1, is_brand: 1 })[SHEET_HEADER.indexOf('제외태그')]).toBe('optout')
  })
})

describe('b64url — JWT 인코딩', () => {
  it('패딩 없음 + URL-safe 문자만', () => {
    const s = b64url('{"alg":"RS256","typ":"JWT"}')
    expect(s).not.toMatch(/[+/=]/)
    expect(atob(s.replace(/-/g, '+').replace(/_/g, '/'))).toBe('{"alg":"RS256","typ":"JWT"}')
  })
  it('바이너리 입력(서명 바이트) 처리', () => {
    expect(b64url(new Uint8Array([0xfb, 0xff, 0x3e]))).toBe('-_8-')
  })
})

/**
 * 🧱 **커서 미러** — 전량을 한 인보케이션에 담던 것이 CPU 사망의 원인이었다(2026-08-02 라이브).
 *
 *   실측: `ads:sheets-sync` 가 매시간 `Worker exceeded CPU time limit`(ms 29,191).
 *   28k행일 땐 됐고 42k행에서 죽었다 — **성장에 비례해 영구히 실패**하는 형태라,
 *   "가끔 실패"로 보고 재시도로 넘길 수 있는 종류가 아니다.
 *
 *   ⚠️ 이 테스트가 못 막는 것: 실제 CPU 사용량은 코드로 못 본다.
 *     판정은 라이브 하트비트(`ads:sheets-sync` ok)와 `ads_sheets_last_sync.partial` 로 한다.
 */
describe('시트 미러 — 커서로 이어 붙인다', () => {
  const raw = readFileSync(join(process.cwd(), 'src/features/marketing/api/sheets-sync.ts'), 'utf8')
  /**
   * ⚠️ **주석을 걷어내고 코드만 본다.** 첫 판은 이 파일의 docblock 이 옛 구조를 *설명하려고*
   *   `rows.push(leadToRow(l))` 를 인용해 놨는데 가드가 거기 걸렸다 — 근거를 적을수록 가드가
   *   깨지는 형태라 그대로 두면 다음 사람이 주석을 지워서 초록을 만든다(가드가 문서를 이긴다).
   */
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('회차당 몫이 있다 — 없으면 풀이 커질수록 확실히 다시 죽는다', () => {
    expect(src).toMatch(/const ROWS_PER_RUN = [\d_]+/)
    expect(src).toMatch(/while \(wrote < ROWS_PER_RUN\)/)
  })

  it('🚫 전량을 메모리에 쌓지 않는다 — 페이지를 읽는 즉시 기록하고 버린다', () => {
    // 옛 구조의 지문: 전량 배열에 push 해 두고 나중에 slice 로 청크를 떠서 썼다.
    expect(src).not.toMatch(/rows\.push\(leadToRow/)
    expect(src).toMatch(/page\.slice\(i, i \+ CHUNK\)\.map\(leadToRow\)/)
  })

  it('🚫 매 회차 전체 clear 를 하지 않는다 — 사이클이 여러 회차라 시트가 비는 구간이 생긴다', () => {
    expect(src).not.toMatch(/\/values\/\$\{TAB\}:clear/)
  })

  /**
   * 🩹 2026-08-03 라이브 고착 — `ads_sheets_cursor = {off:44000, total:43597}`.
   *   사이클은 시작 시점 total 로만 그리드를 넓히는데(`ensurePoolSheet(total+2)`) 읽기 루프엔 상한이 없어,
   *   도중에 늘어난 몇 행이 그리드 밖으로 나가 400 → 그 자리에 커서 저장 → off 가 0 으로 못 돌아감 →
   *   `ensurePoolSheet` 영영 미호출 → **매 회차 같은 행에서 400**. 미러는 멈추고 회차 예산 한 칸은 계속 탄다.
   *   ⇒ 두 겹으로 막는다: (a) 사이클 상한(`cycleRoom`)으로 애초에 안 넘어가고 (b) 이미 넘어간 커서는 되돌린다.
   */
  it('🩹 스냅샷을 지나친 커서는 새 사이클로 되돌린다 — 안 그러면 그리드가 영영 안 넓어진다', () => {
    // 실측 고착값 그대로
    expect(startCursor({ off: 44000, total: 43597 })).toEqual({ off: 0, total: 0 })
    // 경계: off === total 은 사이클이 끝난 것 → 새 사이클
    expect(startCursor({ off: 12000, total: 12000 })).toEqual({ off: 0, total: 0 })
    // 정상 진행 중인 커서는 건드리지 않는다
    expect(startCursor({ off: 12000, total: 43597 })).toEqual({ off: 12000, total: 43597 })
    // total 미상(0)은 종전대로 — 여기서 0 으로 되돌리면 멀쩡한 이어쓰기가 매번 처음부터 다시 돈다
    expect(startCursor({ off: 12000, total: 0 })).toEqual({ off: 12000, total: 0 })
  })

  it('🧱 사이클은 자기 스냅샷까지만 쓴다 — 도중에 늘어난 행은 다음 사이클 몫', () => {
    expect(cycleRoom(36000, 43597)).toBe(7597)
    expect(cycleRoom(43597, 43597)).toBe(0)   // 여기서 멈춰야 그리드 밖을 안 쓴다
    expect(cycleRoom(44000, 43597)).toBe(0)   // 이미 지나쳤어도 더 쓰지 않는다(음수 금지)
    expect(cycleRoom(0, 0)).toBe(Number.POSITIVE_INFINITY) // 총계 미상이면 상한 없음(종전 동작)
  })

  it('배선 — 루프가 실제로 그 상한을 쓴다(순수함수만 고치고 호출을 빠뜨리면 라이브는 그대로다)', () => {
    expect(src).toMatch(/const room = cycleRoom\(off, total\)/)
    expect(src).toMatch(/Math\.min\(PAGE, ROWS_PER_RUN - wrote, room\)/)
    expect(src).toMatch(/startCursor\(parseSheetCursor\(/)
  })

  it('커서 파싱: 정상값은 그대로, 깨진 값은 0(전량 재시작 = 누락보다 안전한 방향)', () => {
    expect(parseSheetCursor(JSON.stringify({ off: 12000, total: 42256 }))).toEqual({ off: 12000, total: 42256 })
    for (const raw of [null, undefined, '', 'not-json', '{"off":-5}', '{"off":"x"}']) {
      expect(parseSheetCursor(raw as never).off, `raw=${String(raw)}`).toBe(0)
    }
  })
})
