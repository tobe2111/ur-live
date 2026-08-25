/**
 * 🫀 **cron 침묵 경보는 "열렸나"가 아니라 "무엇이 침묵 중인가"로 판정한다** (2026-08-25 신설)
 *
 * ## 무엇이 실제로 일어났나
 *
 * 이슈 #1056 이 **2026-08-04 부터 21일째 열린 채 한 줄도 갱신되지 않았다.**
 * `uptime.yml` 의 판정이 `down`(불리언) 하나였기 때문이다:
 *
 * ```
 *   down && !open  → 이슈 생성
 *   !down && open  → 이슈 닫기
 *   down &&  open  → (아무것도 안 함)      ← 여기서 21일이 지나갔다
 * ```
 *
 * `down` 이 영원히 참이었던 이유는 `d1-backup` 하나다 — 08-02 에 OOM 으로 죽고 후임이 인수한
 * **이름만 남은 행**이라 구조적으로 회복할 수 없었다. 그리고 그 21일 안에
 * **08-24 일간 16개(정산 성숙·원장 정합 포함)가 통째로 빠졌는데 새 신호가 0** 이었다.
 * 채널이 이미 빨간불이라 아무 일도 일어나지 않은 것이다.
 *
 * ⇒ 죽은 이름을 걷어내는 것(`BEAT_RENAMED_TO`)만으로는 부족하다. **오래 사는 빨간불은 또 생긴다.**
 *   판정 단위를 이름 집합으로 올려야 같은 사고가 반복되지 않는다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *
 * 워크플로는 GitHub 러너에서만 도므로 여기서 **실행해 볼 수는 없다** — 텍스트 수준에서
 * "그 분기가 존재하는가"까지만 본다. 실제 코멘트가 나가는지는 라이브 관측이 유일한 판정이고,
 * 그건 다음 회차에 침묵 목록이 바뀔 때 확인된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const yml = readFileSync('.github/workflows/uptime.yml', 'utf8')

describe('🫀 uptime.yml — cron 침묵 판정', () => {
  it('파일을 읽었다 (0바이트면 통과가 아니라 실패)', () => {
    expect(yml.length).toBeGreaterThan(500)
  })

  it('🔴 침묵 중인 **이름 목록**을 뽑는다 — HTTP 코드만으론 원인 교체를 못 본다', () => {
    expect(yml, 'cron_stale 출력이 사라졌다').toContain('cron_stale=')
    expect(yml, "healthcheck 응답 본문을 안 받고 있다(-o /dev/null 로 되돌아갔나)").toContain('cron_body=')
    expect(yml).toMatch(/\(d\.get\('data'\) or \{\}\)\.get\('stale'\)/)
  })

  it('🔴 열려 있는 동안에도 목록이 바뀌면 코멘트한다 (21일 침묵의 근본 원인)', () => {
    expect(yml, '`down && open` 분기가 없다 — 열려 있으면 영원히 조용해진다')
      .toMatch(/else if \(down && open && parsed\)/)
    // 바뀔 때만 — 매 회차(10분) 코멘트는 #845 가 84개로 불어난 원인이다.
    expect(yml, '변화 여부와 무관하게 코멘트하면 #845 가 재발한다')
      .toMatch(/if \(added\.length \|\| gone\.length\)/)
  })

  it('🔴 응답을 못 읽은 것과 "전부 회복"을 섞지 않는다', () => {
    // `?` 센티넬이 없으면 파싱 실패가 빈 목록이 되어 **거짓 해소** 코멘트가 나간다.
    expect(yml).toMatch(/raw === '\?' \? null :/)
    expect(yml, "parsed 가 null 일 때도 diff 를 돌리면 전부 '해소'로 보고된다")
      .toMatch(/down && open && parsed/)
  })

  it('🔴 상태 표식을 이슈 본문에 남기고 갱신한다 (다음 회차의 비교 기준)', () => {
    expect(yml).toContain('<!-- stale:')
    expect(yml, '표식만 읽고 갱신을 안 하면 같은 변화를 매 회차 다시 보고한다')
      .toMatch(/issues\.update\(\{[\s\S]{0,200}body:/)
  })

  it('🔴 `[ .. ] && ..` 맨몸 문장을 쓰지 않는다 — 기본 셸이 bash -e 라 그 자리에서 죽는다', () => {
    // ⚠️ "해당 줄 0개 → 통과" 로 두면 들여쓰기만 바뀌어도 검사가 조용히 무의미해진다.
    //   그래서 **이 규칙이 실제로 적용된 줄이 최소 1개 존재**한다는 것부터 고정한다.
    const sentinel = yml.split('\n').filter((l) => l.includes("cron_stale='?'"))
    expect(sentinel.length, "센티넬 대입 줄이 사라졌다 — 이 검사가 헛돌고 있다").toBeGreaterThan(0)
    for (const l of sentinel) {
      expect(l.trim(), `set -e 함정(맨몸 &&): ${l.trim()}`).toMatch(/^if \[/)
    }
    // 그리고 run 블록 어디에도 맨몸 `[ ... ] &&` 가 새로 생기지 않아야 한다.
    const bare = yml.split('\n').filter((l) => /^\s+\[ .* \] &&/.test(l))
    expect(bare, `맨몸 && 문장: ${bare.join(' | ')}`).toEqual([])
  })
})
