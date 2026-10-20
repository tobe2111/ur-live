/**
 * 🧱 `repair-schema/column-repairs.ts` 는 파일 크기 캡(600줄)을 **면제**받았다(`file-size-ok`).
 *
 * 면제 사유는 "이건 god 파일이 아니라 append-only DDL 매니페스트다" 였다. 그 사유는 **파일이
 * 실제로 데이터일 때만** 성립한다 — 여기에 로직이 스며들면 면제는 근거를 잃고, 그때부터는
 * "린트를 끈 1,000줄짜리 파일"이 된다.
 *
 * 주석으로 적어 두는 것으로는 부족하다(이 레포가 반복해 배운 것). 그래서 조건을 검사로 박는다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 항목의 SQL 이 *맞는지*는 안 본다(그건 repair 실행과 스키마 가드 소관).
 *    여기서 보는 것은 오직 **"이 파일이 아직 데이터인가"** 하나다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const PATH = 'src/worker/routes/repair-schema/column-repairs.ts'
const SRC = readFileSync(PATH, 'utf8')
/** 배열 본문(항목 검사용). */
const BODY = SRC.slice(SRC.indexOf('export const COLUMN_REPAIRS'))
/**
 * 주석 줄을 제거한 **파일 전체** 코드.
 *
 * ⚠️ 처음엔 `BODY` 만 봤다. 되돌려-검증에서 헬퍼 함수를 **배열 선언 위**에 심었더니 **초록**이 떴다 —
 *    가드가 못 보는 자리에 로직을 두면 그만이었다. 파일 전체를 봐야 한다.
 */
const CODE = SRC.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n')

describe('column-repairs 는 데이터여야 한다 (크기 면제의 전제)', () => {
  it('면제 표식과 사유가 파일에 남아 있다', () => {
    // 표식만 있고 사유가 없으면 다음 사람이 왜 껐는지 모른다 — 그게 면제가 썩는 방식이다.
    // 🔑 가드(`check-file-size.mjs:60`)는 **첫 8줄만** 읽는다. 표식이 아래로 밀려나면 면제가
    //    조용히 풀린다 — 실제로 처음에 사유 문단 안에만 적었다가 CI 가 다시 빨강이었다.
    const head = SRC.split('\n').slice(0, 8).join('\n')
    expect(head, 'file-size-ok 표식이 첫 8줄 밖으로 밀려났다 — 가드가 못 읽는다').toContain('file-size-ok')
    expect(SRC, '면제 사유 설명이 사라졌다').toMatch(/왜 이 파일만 600줄 캡을 면제하나/)
  })

  it('제어 흐름이 없다 (if / for / while / switch / try)', () => {
    const found = [...CODE.matchAll(/\b(if|for|while|switch|try)\s*[({]/g)].map((m) => m[1])
    expect(found, `로직이 들어왔다 → 면제 근거 소멸. 진짜로 분리할 것: ${found.join(', ')}`).toEqual([])
  })

  it('함수 정의가 없다 (선언식 / 화살표 / 메서드)', () => {
    const found = [...CODE.matchAll(/\bfunction\b|=>/g)].map((m) => m[0])
    expect(found, `함수가 들어왔다 → 데이터 매니페스트가 아니다: ${found.join(', ')}`).toEqual([])
  })

  it('SQL 을 조립하지 않는다 (템플릿 보간 `${…}` 금지)', () => {
    // ⚠️ 처음엔 "항목은 한 줄이어야 한다"로 썼다가 **내가 틀렸다** — 이 파일엔 여러 줄
    //    `CREATE TABLE` 템플릿이 25개 있고, 그건 로직이 아니라 그냥 긴 SQL 이다.
    //    진짜 신호는 줄 수가 아니라 **보간**이다: `${}` 가 들어오는 순간 SQL 이 선언이 아니라
    //    계산 결과가 되고, 그러면 여기서 읽고 grep 할 수 있다는 전제가 깨진다
    //    (가드 여럿이 이 파일을 정규식으로 읽는다 — `ADD COLUMN x` 를 찾는 식으로).
    const bad = [...CODE.matchAll(/\$\{[^}]*\}/g)].map((m) => m[0])
    expect(bad, `SQL 이 조립되고 있다 — 정적으로 읽을 수 없게 된다: ${bad.join(', ')}`).toEqual([])
  })

  it('항목이 충분히 많다 (측정 0 이면 통과가 아니라 실패)', () => {
    // 파일이 비거나 경로가 낡으면 위 검사들이 전부 조용히 통과한다 — 이 레포의 단골 실패 모드.
    const count = (BODY.match(/\{ desc: '/g) || []).length
    expect(count, '항목을 못 찾았다 — 파일 구조가 바뀌었거나 경로가 낡았다').toBeGreaterThan(300)
  })

  it('라우트가 이 매니페스트를 실제로 쓴다 (고아 파일 방지)', () => {
    const routes = readFileSync('src/worker/routes/repair-schema.routes.ts', 'utf8')
    expect(routes, '라우트가 COLUMN_REPAIRS 를 import 하지 않는다').toContain('COLUMN_REPAIRS')
    expect(routes, 'stmts 가 매니페스트를 참조하지 않는다').toMatch(/const stmts[^\n]*COLUMN_REPAIRS/)
  })
})
