/**
 * 💓 2026-10-14 — **cron 침묵 판정은 한 규칙이다.**
 *
 * 라이브 실측(어드민 `/api/admin/cron-heartbeats`, 143행)에서 같은 질문에 답이 **세 벌**이었다:
 *
 *     getCronHealth (헬스 게이트)      age > max_gap_min + verdict   →  0건  (ok: true)
 *     HeartbeatCards (어드민 카드)      행의 stale + 유령 제외         →  0건
 *     /cron-heartbeats 의 data.stale   age > 24h **고정** + verdict   →  6건  ← 전부 거짓
 *
 * 거짓 6건은 전부 **허용 간격이 7.2일인 주간 작업**이고 나이는 2.6일이었다
 * (`payouts-generate` · `weekly-cohort-report` · `weekly-metrics-summary` · `weekly-tier-batch` ·
 * `blog-ai-draft` · `user-id-backfill-sweep`). 주간 작업은 7일 중 6일이 "24h 초과" 라
 * **구조적으로 거의 항상** 그 목록에 뜬다.
 *
 * 🩸 **피해 범위는 화면이 아니라 API 독자다**(첫 서술을 정정했다). 실측: 목록 화면은 `data.stale` 을
 * 가져오기만 하고 `HeartbeatCards` 에 **넘기지 않는다**(Props 에 없다) · 카드 화면은 행의 `stale` 로
 * 직접 판정한다 · 로그 화면은 `items` 를 `ads:` 로 걸러 그리므로 그 6건이 **오늘은 안 보인다**.
 * ⇒ 거짓 6건을 실제로 읽는 쪽은 **이 API 를 ground truth 로 읽는 자동화·세션**이고, 그게 두 번
 * 오진을 만들었다. 그리고 로그 화면은 `stale` **이름 목록을 거르지 않으므로**, `ads:` 레인에
 * 주간 주기가 생기는 날 거짓 색이 바로 뜬다(잠복 — ⑦이 그 전제를 고정한다).
 *
 * 피해는 가정이 아니다. `admin-system-monitoring.routes.ts` 주석이 2026-08-08 에
 * *"두 세션이 이 목록을 읽고 '레인 4개 침묵' 으로 보고했지만 진짜는 하나뿐이었다"* 고 적어 뒀고,
 * 2026-10-14 에 한 세션이 **같은 오진을 재현했다**(6건을 침묵으로 보고 + 승계된 `d1-backup`
 * (72.8일)을 결함으로 올릴 뻔했다 — 실제로는 `d1-backup-chunked` 로 정상 승계).
 * 그리고 `AutoRunLog.tsx` 주석은 *"매시간짜리와 주 1회짜리를 같은 잣대로 판정하면 정상인 것을
 * 빨갛게 칠한다"* 고 **요구사항을 적어 두고** 바로 그렇게 하는 서버 필드를 믿고 있었다.
 *
 * 🔑 판정 재료는 **이미 행에 있었다** — `max_gap_min`(작업이 신고한 주기, 없으면 cron 식에서 유도)과
 * 그것으로 계산된 `stale`. 게이트와 카드는 그걸 쓰는데 그 한 줄만 안 썼다.
 *
 * ## 이 시험이 못 보는 것
 * - 라이브 D1 의 실제 하트비트 값(여기선 합성 행으로 규칙만 판정한다).
 * - 화면이 그 목록을 실제로 어떤 색으로 그리는지(레이아웃은 브라우저만 안다).
 * - `max_gap_min` 자체가 맞는지 — 그건 `cron-expected.test.ts` 의 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from './../helpers/source-text'

const ROUTE = 'src/features/admin/api/admin-system-monitoring.routes.ts'
const GATE = 'src/worker/utils/cron-heartbeat.ts'
const PAGE = 'src/pages/AdminSystemMonitoringPage.tsx'
const CARDS = 'src/pages/admin-system-monitoring/HeartbeatCards.tsx'
const LOG = 'src/pages/admin/influencer-pool/AutoRunLog.tsx'

const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))

/** 라우트의 `stale` 선언 한 줄만 떼어낸다(파일 전체를 보면 주석·다른 필드에 걸린다). */
function staleLine(): string {
  const s = code(ROUTE)
  const i = s.indexOf('const stale = items.filter')
  expect(i, '`const stale = items.filter` 선언이 사라졌다 — 앵커를 다시 조준할 것').toBeGreaterThan(-1)
  return s.slice(i, s.indexOf('\n', i))
}

type Beat = { name: string; age_minutes: number | null; max_gap_min: number | null; verdict?: string; stale?: boolean | null }

/** 라우트가 쓰는 것과 **같은 술어** — 행이 계산해 둔 `stale` + 유령 제외. */
const staleNames = (items: Beat[]) =>
  items.filter(i => i.stale === true && (i.verdict ?? 'judge') === 'judge').map(i => i.name)

/** 라이브(2026-10-14) 모양을 그대로 옮긴 탐침. `stale` 은 행이 계산하는 규칙(age > max_gap_min). */
function probe(): Beat[] {
  const mk = (name: string, age: number, gap: number, verdict = 'judge'): Beat =>
    ({ name, age_minutes: age, max_gap_min: gap, verdict, stale: age > gap })
  return [
    // 주간 작업 — 나이 2.6일, 허용 7.2일. **침묵이 아니다.**
    mk('payouts-generate', 3774, 10440),
    mk('weekly-cohort-report', 3774, 10440),
    mk('weekly-metrics-summary', 3774, 10440),
    mk('weekly-tier-batch', 3774, 10440),
    mk('blog-ai-draft', 3774, 10440),
    mk('user-id-backfill-sweep', 3774, 10440),
    // 150분 주기 작업이 정상으로 돌고 있다.
    mk('cache-prewarm', 7, 150),
    // 유령 — 승계·은퇴라 나이가 많아도 경보가 아니다.
    mk('d1-backup', 104857, 10440, 'superseded'),
    mk('group-buy-deadline-push', 56000, 10, 'retired'),
    // 🔴 진짜 침묵 — 150분 주기인데 3일 조용하다.
    mk('kt-alpha-voucher-retry', 4320, 150),
  ]
}

describe('cron 침묵 판정은 한 규칙 (2026-10-14)', () => {
  it('① 어드민 목록이 고정 임계값을 다시 재지 않는다', () => {
    const line = staleLine()
    expect(line, '`60 * 24` 같은 고정 임계가 돌아왔다 — 주간 작업이 상시 거짓 경보가 된다')
      .not.toMatch(/60\s*\*\s*24/)
    expect(line, '임계값을 숫자로 다시 쓰지 말 것 — 행의 `stale` 을 쓴다')
      .not.toMatch(/age_minutes\s*\??\?*\s*[^)]*>\s*\d/)
    expect(line, '행이 계산해 둔 `stale` 을 쓰지 않는다').toMatch(/i\.stale\s*===\s*true/)
    expect(line, '유령(superseded·retired) 제외가 사라졌다').toMatch(/verdict/)
  })

  it('② 게이트와 같은 재료로 판정한다 — 행의 stale 은 max_gap_min 에서 나온다', () => {
    const g = code(GATE)
    // 행 계산: stale = age > limit, limit = 작업 신고 주기 ?? cron 식 유도
    expect(g, '행의 `stale` 이 `max_gap_min` 과 무관해졌다').toMatch(/stale:\s*\(limit\s*!=\s*null[\s\S]{0,60}age\s*>\s*limit/)
    expect(g, '허용 간격이 작업 신고값 → cron 식 폴백 순서가 아니다').toMatch(/const\s+limit\s*=\s*gap\s*\?\?\s*expectedMaxAgeMinutes/)
    // 게이트도 같은 재료
    expect(g, '게이트가 `max_gap_min` 을 안 쓴다').toMatch(/const\s+limit\s*=\s*b\.max_gap_min\s*\?\?\s*expectedMaxAgeMinutes/)
  })

  it('③ 주간 작업은 침묵이 아니다 (거짓 경보 0)', () => {
    const got = staleNames(probe())
    const weekly = ['payouts-generate', 'weekly-cohort-report', 'weekly-metrics-summary', 'weekly-tier-batch', 'blog-ai-draft', 'user-id-backfill-sweep']
    for (const n of weekly) expect(got, `${n} 은 나이 2.6일 < 허용 7.2일인데 침묵으로 찍혔다`).not.toContain(n)
  })

  it('④ 반대 방향 — 진짜 침묵은 여전히 잡는다', () => {
    const got = staleNames(probe())
    expect(got, '150분 주기인데 3일 조용한 작업을 놓쳤다 — 규칙이 느슨해졌다').toContain('kt-alpha-voucher-retry')
    expect(got.length, `정확히 하나여야 한다 (받은 것: ${got.join(', ')})`).toBe(1)
  })

  it('⑤ 유령은 경보가 아니다 (승계·은퇴)', () => {
    const got = staleNames(probe())
    expect(got, '승계된 옛 이름이 경보에 섞였다').not.toContain('d1-backup')
    expect(got, '은퇴한 이름이 경보에 섞였다').not.toContain('group-buy-deadline-push')
  })

  it('⑥ 화면 셋이 같은 판정을 쓴다 — 자기 침묵 판정을 만드는 소비자가 없다', () => {
    // 🩸 첫 판은 `60 * 24` 를 통째로 금지했다가 **거짓 빨간불**을 냈다 — 세 화면 다 그 값을
    //   `'시간 전' / '일 전'` **시각 포매터**로 쓴다(판정이 아니다). 넓은 패턴이 코드가 아니라
    //   시험을 틀리게 만든 자리다. 금지해야 하는 것은 *나이로 경고 여부를 정하는 줄* 이다.
    const ownJudgment = /\b(?:isStale|stale|warn|danger|alert)\w*\s*=\s*[^\n=]*\bage(?:_minutes)?\b[^\n]*[<>]/
    for (const p of [PAGE, CARDS, LOG]) {
      const s = code(p)
      expect(s, `${p} 가 나이로 자기 침묵 판정을 만든다 — 규칙이 또 갈라진다`).not.toMatch(ownJudgment)
    }
    // 로그 화면은 서버 목록을 그대로 믿는다 — 그래서 서버 규칙이 틀리면 그 화면이 틀린다.
    expect(code(LOG), '로그 화면이 서버 `stale` 을 안 쓴다').toMatch(/stale\.includes\(/)
    // 카드 화면은 행의 stale + 유령 제외 (서버와 같은 재료)
    expect(code(CARDS), '카드 화면이 유령을 안 가른다').toMatch(/verdict\s*===\s*'superseded'/)
  })

  it('⑦ 로그 화면의 잠복 위험 — items 는 거르는데 stale 이름 목록은 안 거른다', () => {
    const s = code(LOG)
    // 지금은 `ads:` 레인에 주간 주기가 없어서 거짓 색이 안 뜬다. 생기는 날 바로 뜬다 —
    // 그래서 이 화면이 **자기 판정을 만들지 않는 것**이 유일한 방어다(서버가 맞으면 화면도 맞다).
    expect(s, 'items 를 ads: 로 거르는 줄이 사라졌다').toMatch(/items[\s\S]{0,80}startsWith\('ads:'\)/)
    // 🩸 첫 판은 `stale` 뒤 120자에서 `startsWith('ads:')` 를 찾았는데, 바로 다음 줄의
    //   `never_fired` 필터에 걸려 **거짓 빨간불**이 났다. 넓은 창으로 이웃을 집은 것이다.
    //   ⇒ `setStale(...)` **호출 안만** 본다.
    const call = /setStale\(([^;\n]*)\)/.exec(s)
    expect(call, '`setStale(` 호출을 못 찾았다 — 앵커를 다시 조준할 것').toBeTruthy()
    expect(call![1], '이 단언의 전제(stale 이름 목록을 안 거른다)가 깨졌다 — 설명을 다시 쓸 것')
      .not.toMatch(/filter|startsWith/)
    expect(s, '로그 화면이 서버 목록 대신 자기 판정을 쓰기 시작했다').toMatch(/stale\.includes\(/)
  })

  it('⑧ 검사 대상이 비면 통과가 아니라 실패', () => {
    expect(staleLine().length, '`stale` 선언 줄을 못 떼어냈다').toBeGreaterThan(40)
    expect(probe().filter(b => b.stale === true).length, '탐침에 침묵 행이 없으면 ③④가 헛돈다').toBeGreaterThan(2)
    expect(probe().filter(b => (b.max_gap_min ?? 0) >= 10000).length, '탐침에 주간 작업이 없으면 ③이 헛돈다').toBeGreaterThan(3)
  })
})
