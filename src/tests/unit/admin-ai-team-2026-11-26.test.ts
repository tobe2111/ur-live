/**
 * 🏢 어드민 AI 팀 본사(2026-11-26 대표 "어드민 대시보드에 한 페이지에서 볼 수 있으면") 불변식
 *   ① 화면·API·역할 폴더가 같은 12팀을 말한다(한쪽만 늘리면 빨강)
 *   ② 근무 기록 입력 검증 — 정의 밖 팀·상태·주소는 거부
 *   ③ 상태 판정 — 기록 없음은 "부르면 출근"(실패로 위장 금지), 90분 넘은 started 는 "응답 없음"
 *   ④ 배선 — 라우트·메뉴·API 마운트·repair-schema 표
 * ⚠️ 못 막는 것: 루틴이 실제로 기록을 보내는지(루틴 프롬프트는 레포 밖) · 정기 근무 문구가 예약 작업과 같은지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { AI_TEAM_KEYS, parseAiTeamActivity } from '@/worker/utils/ai-team-activity'
import { deriveTeamStatus, WORKING_WINDOW_MS, type ActivityRow } from '@/pages/admin/ai-team/derive'
import { AI_TEAM_RULES, findAiTeamTasks } from '@/worker/utils/ai-team-tasks'
import { ROOMS, deskOf, route, AISLE_X, CORRIDOR_Y } from '@/pages/admin/ai-team/office-layout'
import { parseAiSession } from '@/worker/utils/ai-team-sessions'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf-8')

describe('① 같은 12팀', () => {
  const agentFiles = readdirSync(resolve(ROOT, '.claude/agents')).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')).sort()
  it('API 허용 팀 = .claude/agents 파일', () => {
    expect([...AI_TEAM_KEYS].sort()).toEqual(agentFiles)
  })
  it('화면 TEAMS·FLOORS 가 12팀을 전부 갖고, 역할 파일을 통째로 넣지 않는다(JS 예산)', () => {
    const src = read('src/pages/admin/ai-team/teams.ts')
    expect(src, '역할 파일 ?raw 인라인은 전체 JS 예산을 넘긴다(2026-11-26 실측)').not.toMatch(/\.claude\/agents\/[\w-]+\.md\?raw/)
    for (const k of agentFiles) {
      expect(src, `TEAMS 에 ${k} 없음`).toContain(`key: '${k}'`)
      expect(src, `FLOORS 에 ${k} 없음`).toMatch(new RegExp(`teams: \\[[^\\]]*'${k}'`))
    }
  })
})

describe('② 입력 검증', () => {
  it('정상 입력은 통과', () => {
    const a = parseAiTeamActivity({ team: 'qa', state: 'done', summary: '  이상   없음 ', grade: 'E4', session_url: 'https://claude.ai/code/session_01ABC' })
    expect(a).toMatchObject({ team: 'qa', state: 'done', summary: '이상 없음', grade: 'E4', session_url: 'https://claude.ai/code/session_01ABC' })
  })
  it('정의 밖 팀·상태는 거부', () => {
    expect(parseAiTeamActivity({ team: 'hacker', state: 'done' })).toBeNull()
    expect(parseAiTeamActivity({ team: 'qa', state: 'deleted' })).toBeNull()
    expect(parseAiTeamActivity(null)).toBeNull()
  })
  it('claude.ai 밖 주소·이상한 등급은 버린다', () => {
    const a = parseAiTeamActivity({ team: 'dev', state: 'started', session_url: 'javascript:alert(1)', grade: 'E9' })
    expect(a?.session_url).toBeNull()
    expect(a?.grade).toBeNull()
  })
})

describe('③ 상태 판정', () => {
  const now = Date.parse('2026-11-26T03:00:00Z')
  const row = (id: number, state: ActivityRow['state'], createdUtc: string): ActivityRow =>
    ({ id, team: 'sales', routine: null, state, summary: null, grade: null, session_url: null, created_at: createdUtc })
  it('기록 없음 → 부르면 출근', () => {
    expect(deriveTeamStatus([], 'sales', now).state).toBe('oncall')
  })
  it('최근 started → 일하는 중, 90분 넘으면 응답 없음 (D1 은 Z 없는 UTC)', () => {
    expect(deriveTeamStatus([row(1, 'started', '2026-11-26 02:30:00')], 'sales', now).state).toBe('working')
    const old = new Date(now - WORKING_WINDOW_MS - 60_000).toISOString().replace('T', ' ').slice(0, 19)
    expect(deriveTeamStatus([row(1, 'started', old)], 'sales', now).state).toBe('stuck')
  })
  it('가장 최근 기록이 이긴다', () => {
    const rows = [row(1, 'started', '2026-11-26 02:00:00'), row(2, 'failed', '2026-11-26 02:10:00')]
    expect(deriveTeamStatus(rows, 'sales', now).state).toBe('failed')
    expect(deriveTeamStatus([...rows, row(3, 'done', '2026-11-26 02:20:00')], 'sales', now).state).toBe('done')
  })
})

describe('④ 배선', () => {
  it('라우트·메뉴·API 마운트·repair-schema', () => {
    expect(read('src/routes/admin.routes.tsx')).toMatch(/path="\/admin\/ai-team"[\s\S]{0,120}AdminAiTeamPage/)
    expect(read('src/components/admin/admin-nav-config.ts')).toContain("path: '/admin/ai-team'")
    expect(read('src/worker/index.ts')).toContain("adminApp.route('/', adminAiTeamRoutes)")
    expect(read('src/worker/routes/repair-schema/aux-tables.ts')).toContain("name: 'ai_team_activity'")
  })
})

// ⑤ 일감 자동 발견(2026-11-26 대표 "실제로 자동으로 할 일들을 찾아서 일한다던지" → "응 해봐")
//   ⚠️ 못 막는 것: 규칙의 SQL 이 라이브 컬럼과 맞는지(시험 DB 가 없다 — 2026-11-26 라이브 D1 에 읽기로 12개 전부 돌려 확인함).

describe('⑤ 일감 자동 발견 규칙', () => {
  it('규칙 id 가 겹치지 않고, 담당 팀이 12팀 안에 있다', () => {
    const ids = AI_TEAM_RULES.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of AI_TEAM_RULES) expect(AI_TEAM_KEYS as readonly string[], `${r.id} 의 팀 ${r.team}`).toContain(r.team)
  })

  it('읽기 전용 — 규칙 파일에 UPDATE·INSERT·DELETE 가 없다', () => {
    const src = read('src/worker/utils/ai-team-tasks.ts')
    expect(src).not.toMatch(/\b(UPDATE|INSERT|DELETE)\s/)
  })

  it('규칙 하나가 터져도 나머지는 나오고, 터진 규칙은 errors 에 이름이 남는다(0 으로 위장 금지)', async () => {
    const DB = {
      prepare: (sql: string) => ({
        first: async () => {
          if (sql.includes('FROM sellers WHERE status')) throw new Error('boom')
          if (sql.includes("orders WHERE status = 'REFUND_REQUIRED'")) return { n: 2 }
          return { n: 0 }
        },
        all: async () => ({ results: [] }),
        run: async () => ({}),
      }),
    } as unknown as D1Database
    const r = await findAiTeamTasks(DB, { fresh: true })
    expect(r.errors).toContain('seller-approval')
    expect(r.tasks.map(t => t.id)).toEqual(['refund-required'])
    expect(r.tasks[0]).toMatchObject({ team: 'ops', count: 2, severity: 'high' })
  })

  it('라우트가 마운트돼 있고 화면이 일감을 읽는다', () => {
    expect(read('src/features/admin/api/admin-ai-team.routes.ts')).toContain("'/ai-team/tasks'")
    expect(read('src/pages/admin/AdminAiTeamPage.tsx')).toContain('/api/admin/ai-team/tasks')
  })
})

// ⑥ 사무실 보기(2026-11-26 대표 "메타버스처럼 직원들이 움직이고") · ⑦ 작업실 연결("모든 세션들 모두 연결해서")
//   ⚠️ 못 막는 것: 움직임이 보기 좋은지(눈으로 봐야 한다) · 다른 레포의 세션(그 레포엔 이 훅이 없다).
describe('⑥ 사무실 평면도', () => {
  it('12팀 모두 책상이 있고, 책상·자리가 자기 방 안에 있다', () => {
    for (const k of AI_TEAM_KEYS) {
      const d = deskOf(k)
      expect(d, `${k} 책상 없음`).toBeTruthy()
      const room = ROOMS.find(r => r.teams.includes(k))!
      for (const p of [d!.desk, d!.seat]) {
        expect(p.x > room.x && p.x < room.x + room.w && p.y > room.y && p.y < room.y + room.h, `${k} 가 방 밖`).toBe(true)
      }
    }
  })
  it('걷는 길은 목적지에서 끝나고, 다른 층이면 가운데 통로를 지난다', () => {
    const a = deskOf('ceo-office')!.seat, b = deskOf('qa')!.seat
    const p = route(a, b)
    expect(p[p.length - 1]).toEqual(b)
    expect(p.some(q => q.x === AISLE_X)).toBe(true)
    const same = route(deskOf('planning')!.seat, deskOf('dev')!.seat)
    expect(same.some(q => q.x === AISLE_X)).toBe(false)
    expect(CORRIDOR_Y.length).toBe(2)
  })
})

describe('⑦ 작업실(세션) 연결', () => {
  it('세션 보고 검증 — 이상한 id·이벤트는 거부, 제목은 80자로 자른다', () => {
    expect(parseAiSession({ session_id: 'abc', event: 'start' })).toBeNull()
    expect(parseAiSession({ session_id: 'd2567341-4e61-58c5', event: 'delete' })).toBeNull()
    const s = parseAiSession({ session_id: 'd2567341-4e61-58c5', event: 'prompt', title: 'x'.repeat(200), branch: 'claude/a b' })
    expect(s?.title?.length).toBe(80)
    expect(s?.branch).toBeNull()
  })
  it('레포 훅이 시작·질문·턴 끝 세 곳에 걸려 있다(새 세션도 자동으로 붙는 근거)', () => {
    const settings = JSON.parse(read('.claude/settings.json'))
    for (const ev of ['SessionStart', 'UserPromptSubmit', 'Stop']) {
      const cmds = JSON.stringify(settings.hooks?.[ev] ?? [])
      expect(cmds, `${ev} 훅 없음`).toContain('ai-hq-report.sh')
    }
  })
  it('훅은 아무것도 출력하지 않고 바로 끝난다(질문 훅 출력은 대화에 끼어든다)', () => {
    const env = { ...process.env, URDEAL_ADMIN_EMAIL: '', URDEAL_ADMIN_PASSWORD: '' }
    const out = execFileSync('bash', [resolve(ROOT, '.claude/hooks/ai-hq-report.sh'), 'prompt'], { input: '{"session_id":"x"}', env }).toString()
    expect(out).toBe('')
    const src = read('.claude/hooks/ai-hq-report.sh')
    expect(src).toMatch(/nohup python3 [^\n]*>\/dev\/null 2>&1 <<'PY' &/)
  })
  it('API 경로가 있다', () => {
    const r = read('src/features/admin/api/admin-ai-team.routes.ts')
    expect(r).toContain("'/ai-team/session'")
    expect(r).toContain("'/ai-team/sessions'")
    expect(read('src/worker/routes/repair-schema/aux-tables.ts')).toContain("name: 'ai_team_sessions'")
  })
})
