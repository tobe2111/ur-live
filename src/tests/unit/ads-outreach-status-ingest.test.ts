/**
 * 📬 **아웃리치 결과 유입** — 2026-08-04 대표 *"이메일 상태 경로도 만들어줘"*.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 대표가 실제로 업로드하는 파일의 컬럼 순서·헤더 이름.
 *   메일 도구마다 다르고 우리는 그걸 본 적이 없다 → 첫 업로드 때 `invalid` 가 크면 파서를 맞춰야 한다
 *   (그래서 `invalid` 를 응답에 담는다 — 조용히 버리면 반쯤 먹힌 걸 모른다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  normEmail, parseOutreachCsv, normalizeOutreachItems, outreachSetClause, ingestOutreachStatuses,
  isOutreachStatus, OUTREACH_INGEST_MAX,
} from '@/features/marketing/api/outreach-status-ingest'

const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('이메일 정규화 — 매칭은 소문자 기준(DB 에 대소문자가 섞여 있다)', () => {
  it('🔒 trim + 소문자', () => {
    expect(normEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })
  it('🔒 이메일이 아니면 null — 빈 문자열로 위장하지 않는다', () => {
    expect(normEmail('nope')).toBeNull()
    expect(normEmail('')).toBeNull()
    expect(normEmail(null)).toBeNull()
    expect(normEmail('a@b')).toBeNull()   // TLD 없음
  })
})

describe('CSV — 메일 도구가 뱉는 형식을 그대로 받는다', () => {
  it('🔒 헤더는 건너뛰고 본문만', () => {
    const r = parseOutreachCsv('email,status\na@b.com,replied\nc@d.com,bounced')
    expect(r.items).toEqual([
      { email: 'a@b.com', status: 'replied', at: null },
      { email: 'c@d.com', status: 'bounced', at: null },
    ])
    expect(r.invalid).toBe(0)
  })

  it('🔒 잘못된 행은 **버리지 않고 센다** — 조용히 사라지면 반쯤 먹힌 걸 모른다', () => {
    const r = parseOutreachCsv('a@b.com,replied\ngarbage-line\nc@d.com,알수없음')
    expect(r.items).toHaveLength(1)
    expect(r.invalid).toBe(2)
  })

  it('🔒 따옴표·공백·빈 줄을 견딘다', () => {
    const r = parseOutreachCsv('\n"a@b.com" , "opened" , "2026-08-01 10:00:00"\n\n')
    expect(r.items[0]).toEqual({ email: 'a@b.com', status: 'opened', at: '2026-08-01 10:00:00' })
  })
})

describe('JSON 입력', () => {
  it('🔒 상한을 넘겨도 터지지 않고 잘린다', () => {
    const many = Array.from({ length: OUTREACH_INGEST_MAX + 50 }, (_, i) => ({ email: `u${i}@x.com`, status: 'sent' }))
    expect(normalizeOutreachItems(many).items).toHaveLength(OUTREACH_INGEST_MAX)
  })
  it('🔒 배열이 아니면 조용히 빈 결과', () => {
    expect(normalizeOutreachItems('nope').items).toEqual([])
  })
  it('🔒 정의 밖 상태는 거부 — 발송 큐가 읽는 문자열과 갈라지면 조용히 어긋난다', () => {
    expect(isOutreachStatus('unsubscribed')).toBe(false)
    expect(normalizeOutreachItems([{ email: 'a@b.com', status: 'unsubscribed' }]).invalid).toBe(1)
  })
})

describe('무엇을 쓰는가 — 되돌릴 수 없는 것은 좁게', () => {
  it('🔒 타임스탬프는 COALESCE — 재업로드가 "방금 열었다"로 덮으면 반응 시점이 망가진다', () => {
    expect(outreachSetClause('opened').sql).toContain('COALESCE(opened_at, ?)')
    expect(outreachSetClause('replied').sql).toContain('COALESCE(replied_at, ?)')
  })

  it('🔒 sent 가 contacted_at 을 덮지 않는다 — 덮으면 리마인더 창이 매번 밀려 영원히 안 나간다', () => {
    expect(outreachSetClause('sent').sql).toContain('COALESCE(contacted_at, ?)')
  })

  it('🔒 opted_out 은 opt_out 에서만 — 법적 의사표시라 자동 해제하지 않는다', () => {
    expect(outreachSetClause('opt_out').sql).toContain('opted_out = 1')
    for (const s of ['sent', 'opened', 'replied', 'bounced', 'complained'] as const) {
      expect(outreachSetClause(s).sql, `${s} 가 opted_out 을 건드리면 안 된다`).not.toContain('opted_out')
    }
  })

  it('🔒 상태 문자열이 SQL 에 그대로 들어가는 곳은 enum 안에서만 온다(주입 불가)', () => {
    // bounced/complained 는 리터럴로 들어간다 — 그 값은 isOutreachStatus 를 통과한 것만이다.
    expect(outreachSetClause('bounced').sql).toBe("email_status = 'bounced'")
  })
})

describe('반영 — 미매칭을 삼키지 않는다', () => {
  const dbWith = (changesPerStmt: number[]) => {
    let i = 0
    return {
      prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: changesPerStmt[i++] ?? 0 } }) }) }),
      batch: async (stmts: unknown[]) => stmts.map(() => ({ meta: { changes: changesPerStmt[i++] ?? 0 } })),
    }
  }

  it('🔒 같은 주소가 여러 행이면 그만큼 갱신된다(중복 163건 실측)', async () => {
    const r = await ingestOutreachStatuses(dbWith([3]), [{ email: 'a@b.com', status: 'replied' }], '2026-08-04 00:00:00')
    expect(r.applied).toBe(3)
    expect(r.unmatched).toBe(0)
  })

  it('🔒 풀에 없는 주소는 unmatched 로 보고 — 조용한 0건은 성공과 구분이 안 된다', async () => {
    const r = await ingestOutreachStatuses(dbWith([0, 1]), [
      { email: 'ghost@x.com', status: 'bounced' }, { email: 'a@b.com', status: 'sent' },
    ], '2026-08-04 00:00:00')
    expect(r.unmatched).toBe(1)
    expect(r.applied).toBe(1)
  })

  it('🔒 실패를 삼키지 않는다', async () => {
    const boom = { prepare: () => { throw new Error('nope') }, batch: async () => [] }
    const r = await ingestOutreachStatuses(boom as never, [{ email: 'a@b.com', status: 'sent' }], 'x')
    expect(r.error).toBeTruthy()
  })
})

describe('🔌 배선 — 엔드포인트가 실제로 있다', () => {
  const ROUTE = readFileSync(join(process.cwd(), 'src/features/marketing/api/admin-ads-pool-ops.routes.ts'), 'utf8')

  it('🔒 라우트가 붙어 있고 ingest 를 부른다', () => {
    const c = code(ROUTE)
    expect(c).toMatch(/app\.post\('\/outreach\/status'/)
    expect(c).toMatch(/ingestOutreachStatuses\(c\.env\.DB, parsed\.items, nowIso\)/)
  })

  it('🔒 어드민 전용 — 이 파일 전체가 requireAdmin 뒤에 있다', () => {
    expect(code(ROUTE)).toMatch(/app\.use\('\*', requireAdmin\(\)\)/)
  })

  it('🔒 응답에 unmatched/invalid 가 실린다 — 없으면 반쯤 먹힌 업로드를 성공으로 읽는다', () => {
    const c = code(ROUTE)
    expect(c).toMatch(/invalid: parsed\.invalid/)
    expect(c).toMatch(/\.\.\.r,/)   // r 에 unmatched 가 들어 있다
  })
})
