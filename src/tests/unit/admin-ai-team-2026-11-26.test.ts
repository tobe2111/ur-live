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
