/**
 * 🩹 **잔액 정비 화면의 안전장치** — 버튼 하나가 돈을 움직이는 자리라 소스로 고정한다 (2026-08-31).
 *
 * ## 왜 화면에까지 테스트를 다나
 *
 * 정비 API 는 이미 dry-run 이 기본이고 그건 `points-reconcile.test.ts` 가 지킨다.
 * 그런데 **화면이 `apply: true` 를 기본으로 보내면 그 방어는 통째로 무의미해진다** —
 * 서버가 아무리 안전해도 사람이 누르는 버튼이 곧장 실행이면 "먼저 보고 누른다"가 성립하지 않는다.
 * 이 레포가 반복해 당한 "가드는 있는데 그 위층에서 우회된다" 클래스라 호출부까지 고정한다.
 *
 * ⚠️ **못 막는 것**: 실제 렌더링·클릭 동작은 안 본다(소스 문자열 검사다). 버튼이 화면에 실제로
 *    뜨는지, disabled 가 먹는지는 사람이 확인해야 한다. 여기서 막는 것은 **계약이 사라지는 것**뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FILE = 'src/pages/admin-system-monitoring/PointsRepairTab.tsx'
const SRC = readFileSync(FILE, 'utf8')
const PAGE = readFileSync('src/pages/AdminSystemMonitoringPage.tsx', 'utf8')

describe('딜 잔액 정비 탭 — 사람이 먼저 보고 누른다', () => {
  it('소스가 비어 있지 않다 (경로가 옮겨가면 통과가 아니라 실패)', () => {
    // 파일이 사라지면 readFileSync 가 던진다. 0바이트로 남는 경우를 여기서 잡는다.
    expect(SRC.length, `${FILE} 이 비었다 — 검사가 헛돌고 있다`).toBeGreaterThan(500)
  })

  it('실행(apply)은 반드시 confirmDialog 를 통과한다', () => {
    // `runUnlock` / `runReconcile` 둘 다 `if (apply) { ... confirmDialog ... }` 형태여야 한다.
    const gated = SRC.match(/if \(apply\) \{[\s\S]{0,400}?confirmDialog\(/g) || []
    expect(gated.length, '실행 경로 중 확인 없이 바로 도는 것이 있다').toBe(2)
  })

  it('확인 창은 되돌릴 수 없는 작업임을 표시한다 (danger)', () => {
    // 평범한 확인 창과 같은 모양이면 사람은 습관적으로 누른다. 잔액·스키마를 만지는 자리다.
    expect((SRC.match(/danger: true/g) || []).length, '두 확인 창 모두 위험 표시가 있어야 한다').toBe(2)
  })

  it('확인 창을 거부하면 아무 요청도 안 나간다 (early return)', () => {
    const bail = SRC.match(/if \(!ok\) return/g) || []
    expect(bail.length, 'confirmDialog 결과를 무시하고 진행한다').toBe(2)
  })

  it('실행 버튼은 검사(dry-run) 결과가 있어야만 나타난다', () => {
    // ① 제약 해제: 제약이 실제로 있고(had_check) 아직 적용 전일 때만.
    expect(SRC.includes('unlock?.had_check && !unlock.applied'),
      '검사 없이도 제약 제거 버튼이 뜬다').toBe(true)
    // ② 잔액 정비: 검사 결과가 있고 아직 실행 전일 때만.
    expect(SRC.includes('recon && !reconApplied'),
      '검사 없이도 정비 실행 버튼이 뜬다').toBe(true)
  })

  it('서버 응답을 요약하지 않고 그대로 보여 준다', () => {
    // 요약만 보여 주면 "무엇이 바뀌었나"를 사람이 대조할 수 없다 — 특히 verified:false 일 때.
    expect(SRC.includes('JSON.stringify(data, null, 2)'), '원문 표시가 사라졌다').toBe(true)
    expect((SRC.match(/<Raw data=/g) || []).length, '두 카드 모두 원문을 보여 줘야 한다').toBe(2)
  })

  it('전후 대조 실패(verified:false)를 조용히 넘기지 않는다', () => {
    expect(SRC.includes('verified === false'), '되돌릴 수 없는 DDL 인데 실패가 화면에 안 뜬다').toBe(true)
  })

  it('대시보드는 라이트 고정 — dark: variant 를 쓰지 않는다', () => {
    // ⚠️ **주석은 빼고 본다.** 이 파일의 머리말이 규칙을 인용하느라 `dark:` 를 적고 있어서,
    //    날문자열로 검사하면 코드가 멀쩡한데 빨간불이 뜬다(이 레포가 잠금표에서 겪은 것의 반대 모양).
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code.includes('dark:'), 'CLAUDE.md 절대 규칙 위반 (대시보드 dark: 금지)').toBe(false)
  })

  it('탭이 실제로 배선돼 있다 (화면에 도달 못 하면 도구가 없는 것과 같다)', () => {
    expect(PAGE.includes("import PointsRepairTab from './admin-system-monitoring/PointsRepairTab'")).toBe(true)
    expect(PAGE.includes("setTab('points')"), '탭 버튼이 없다').toBe(true)
    expect(PAGE.includes("tab === 'points' ? <PointsRepairTab />"), '렌더 분기가 없다').toBe(true)
  })
})
