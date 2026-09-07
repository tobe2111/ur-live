/**
 * 🧭 AI 팀 운영 모델 — 역할 파일·결정권·완료 판정 기준의 불변식 (2026-09-07 대표 확정)
 *
 * ■ 왜 테스트인가
 *   대표(2026-09-07): "미완성·에러·문제가 곳곳에 숨어 있었는데도 완성되었다고 판단하는 경우가 많았다."
 *   원인은 사람이 아니라 정의였다 — "완료"의 뜻이 세션마다 달랐고, 결정은 문서 98곳에 흩어져 있었고,
 *   역할은 채팅에서 즉석으로 부여됐다. 이 셋을 파일로 고정했고, 이 테스트는 그 파일들이 **형식을 잃지
 *   않는지**를 지킨다. 문서만 고치고 역할 파일을 안 고치면 여기서 빨간불이 난다.
 *
 * ■ 불변식
 *   ① 역할 파일 6개가 `.claude/agents/` 에 있고 프론트매터(name·description·tools)가 파일명과 일치한다
 *   ② 각 역할 파일에 "먼저 읽는다 · 결정권 · 금지 · 완료 판정 · 보고 형식" 절이 있고, 완료 판정이 E4 를 말한다
 *   ③ 역할 파일이 "먼저 읽는다"에서 가리키는 레포 경로가 실제로 존재한다(낡은 지도 방지)
 *   ④ 운영 SSOT 의 결정권 매트릭스에서 머니 경로·게이트 ON·발행·삭제는 C 등급이다(낮추면 빨강)
 *   ⑤ 증거 등급 E1~E5 가 정의돼 있고 "E3 에서 멈추면 완료가 아니다" 규칙이 살아 있다
 *   ⑥ 결재함(`docs/decisions/`)의 항목은 필수 필드를 갖고 등급이 C 다
 *   ⑦ CLAUDE.md 가 운영 SSOT 와 역할 폴더를 가리킨다(새 세션이 못 찾으면 없는 것과 같다)
 *
 * ⚠️ 이 테스트가 **못 잡는 것**: 에이전트가 [E4] 라고 적고 실제론 E2 인 경우(등급의 진실성) ·
 *    루틴이 실제로 도는지(Routine 은 레포 밖) · 결정을 채팅에서 받고 결재함에 안 옮기는 경우.
 *    그 셋은 운영 SSOT §8 에 "스스로 못 막는 것"으로 적어 두었다 — 과신 금지.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf-8')

const ROLES = ['ceo-office', 'planning', 'marketing', 'design', 'dev', 'finance'] as const
const MODEL_DOC = 'docs/design/ai-team-operating-model.md'
const REQUIRED_SECTIONS = ['## 먼저 읽는다', '## 결정권', '## 금지', '## 완료 판정', '## 보고 형식']

function frontmatter(src: string): Record<string, string> {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/)
  expect(m, '프론트매터(---) 블록이 없다').toBeTruthy()
  const out: Record<string, string> = {}
  for (const line of m![1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

describe('① 역할 파일 6개 — 프론트매터', () => {
  for (const role of ROLES) {
    it(`${role}.md 가 있고 name 이 파일명과 같다`, () => {
      const p = `.claude/agents/${role}.md`
      expect(existsSync(resolve(ROOT, p)), `${p} 없음`).toBe(true)
      const fm = frontmatter(read(p))
      expect(fm.name).toBe(role)
      expect(fm.description?.length ?? 0).toBeGreaterThan(20)
      expect(fm.tools?.length ?? 0).toBeGreaterThan(0)
    })
  }
})

describe('② 역할 파일 — 필수 절과 완료 판정', () => {
  for (const role of ROLES) {
    it(`${role}: 다섯 절 + 완료 판정이 E4 를 말한다`, () => {
      const src = read(`.claude/agents/${role}.md`)
      for (const h of REQUIRED_SECTIONS) expect(src, `${role} 에 "${h}" 절 없음`).toContain(h)
      const done = src.slice(src.indexOf('## 완료 판정'))
      expect(done, `${role} 완료 판정에 E4 언급 없음`).toMatch(/E4/)
      // 보고 형식의 예시 첫 줄은 [E등급] 으로 시작해야 한다 — 등급 미기재 보고를 형식으로 막는다
      const report = src.slice(src.indexOf('## 보고 형식'))
      expect(report).toMatch(/\[E[1-5]\]/)
    })
  }

  it('finance 는 B 등급이 없다 — 머니 코드 변경은 전부 결재(C)', () => {
    const src = read('.claude/agents/finance.md')
    expect(src).toMatch(/- B: \*\*없음\*\*/)
  })

  it('ceo-office 는 C 등급 실행권이 없다', () => {
    const src = read('.claude/agents/ceo-office.md')
    expect(src).toMatch(/- C: \*\*없음\*\*/)
  })
})

describe('③ 역할 파일이 가리키는 경로가 실제로 있다 (낡은 지도 방지)', () => {
  for (const role of ROLES) {
    it(`${role}: "먼저 읽는다" 의 레포 경로 전부 존재`, () => {
      const src = read(`.claude/agents/${role}.md`)
      const section = src.slice(src.indexOf('## 먼저 읽는다'), src.indexOf('## 결정권'))
      const paths = [...section.matchAll(/`((?:docs|src|scripts|\.claude)\/[^`\s]+|CLAUDE\.md)`/g)].map((m) => m[1])
      expect(paths.length, `${role}: 경로 인용이 0개 — 읽을 SSOT 가 없다`).toBeGreaterThan(0)
      for (const p of paths) {
        // 글롭(`*.md`)은 디렉토리 존재로 판정
        const target = p.includes('*') ? p.slice(0, p.lastIndexOf('/')) : p
        expect(existsSync(resolve(ROOT, target)), `${role} → ${p} 가 레포에 없다`).toBe(true)
      }
    })
  }
})

describe('④ 결정권 매트릭스 — 머니·게이트·발행·삭제는 C', () => {
  const doc = read(MODEL_DOC)
  const matrix = doc.slice(doc.indexOf('## 2. 결정권 매트릭스'), doc.indexOf('## 3. 역할 6개'))
  const mustBeC = [
    '결제·정산·요율·환불·원장·커미션 코드',
    '게이트/플래그 ON',
    '이메일·알림톡·소셜·블로그 **발행**',
    '삭제·purge·데이터 일괄 수정',
    '잠금표(Toss V2 · 로딩) 파일 수정',
    '외부 서비스 유료 전환',
  ]
  for (const row of mustBeC) {
    it(`"${row}" 행이 C 등급`, () => {
      const line = matrix.split('\n').find((l) => l.includes(row))
      expect(line, `매트릭스에 "${row}" 행 없음`).toBeTruthy()
      expect(line!).toMatch(/\|\s*\*\*C\*\*\s*\|/)
    })
  }

  it('세 등급뿐이고 "애매하면 한 등급 위" 규칙이 있다', () => {
    expect(matrix).toContain('**A 자율**')
    expect(matrix).toContain('**B 보고 후 진행**')
    expect(matrix).toContain('**C 결재**')
    expect(matrix).toMatch(/한 등급 위/)
  })

  it('C 는 기한이 지나도 자동 실행되지 않는다', () => {
    expect(matrix).toMatch(/C 는 자동\s*실행되지 않는다/)
  })
})

describe('⑤ 증거 등급 E1~E5', () => {
  const doc = read(MODEL_DOC)
  const dod = doc.slice(doc.indexOf('## 4. 완료 판정 기준'), doc.indexOf('## 5. 결재함 프로토콜'))

  it('E1~E5 다섯 줄이 표에 있다', () => {
    for (const e of ['E1', 'E2', 'E3', 'E4', 'E5']) expect(dod).toMatch(new RegExp(`\\|\\s*\\*\\*${e}\\*\\*\\s*\\|`))
  })

  it('"완료" 는 E4 에서만, E3 에서 멈추면 완료가 아니다', () => {
    expect(dod).toMatch(/E3 에서 멈추면 "완료" 가 아니다/)
    expect(dod).toMatch(/머니 경로는 E4 가 staging 실결제/)
    expect(dod).toMatch(/E2 없이 E3 로 가지 않는다/)
  })

  it('E4 는 "에러가 안 났다" 가 아니라 "의도한 효과가 났다"', () => {
    expect(dod).toMatch(/의도한 효과가 났다/)
  })
})

describe('⑥ 결재함 docs/decisions/', () => {
  const dir = resolve(ROOT, 'docs/decisions')
  const REQUIRED = ['상태:', '등급:', '역할:', '기한:', '## 질문', '## 근거', '## 선택지', '## 기본안', '## 롤백', '## 결정', '## 반영 커밋']

  it('README 와 템플릿이 있고 템플릿이 필수 필드를 전부 갖는다', () => {
    expect(existsSync(resolve(dir, 'README.md'))).toBe(true)
    const t = read('docs/decisions/_template.md')
    for (const f of REQUIRED) expect(t, `템플릿에 "${f}" 없음`).toContain(f)
  })

  it('모든 결정 항목이 필수 필드 + 등급 C + 유효 역할을 갖는다', () => {
    const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f))
    expect(files.length, '결정 항목이 0개 — 결재함이 비어 있으면 대표 판단이 또 흩어진다').toBeGreaterThan(0)
    for (const f of files) {
      const s = read(`docs/decisions/${f}`)
      for (const r of REQUIRED) expect(s, `${f}: "${r}" 없음`).toContain(r)
      expect(s, `${f}: 등급이 C 가 아니다`).toMatch(/^등급: C$/m)
      expect(s, `${f}: 상태 값이 정의 밖`).toMatch(/^상태: (open|approved|rejected|expired)$/m)
      const role = s.match(/^역할: (\S+)$/m)?.[1]
      expect(ROLES as readonly string[], `${f}: 역할 "${role}" 은 정의된 여섯 중 하나가 아니다`).toContain(role)
    }
  })
})

describe('⑦ CLAUDE.md 배선 — 새 세션이 찾을 수 있어야 존재한다', () => {
  const claude = read('CLAUDE.md')
  it('운영 SSOT · 역할 폴더 · 결재함을 가리킨다', () => {
    expect(claude).toContain(MODEL_DOC)
    expect(claude).toContain('.claude/agents/')
    expect(claude).toContain('docs/decisions/')
  })
  it('운영 SSOT 가 행위자·베네핏 지도를 가리키고 그 문서가 있다', () => {
    expect(existsSync(resolve(ROOT, 'docs/design/actor-benefit-map.md'))).toBe(true)
    expect(read('.claude/agents/planning.md')).toContain('actor-benefit-map.md')
    expect(read('.claude/agents/finance.md')).toContain('actor-benefit-map.md')
  })
})
