/**
 * 🚨 **백업 실패는 설정되지 않은 시크릿에 기대면 안 된다** (2026-08-25 신설)
 *
 * ## 무엇이 실제로 일어났나
 *
 * GitHub Actions 주간 백업(`d1-backup.yml`)이 **3주 연속 실패**했다:
 *
 * ```
 *   run 10  2026-08-19  failure
 *   run  9  2026-08-12  failure
 *   run  8  2026-08-05  failure
 *   run  7  2026-07-29  success   ← 마지막 성공
 * ```
 *
 * 실패 통보 경로가 `DISCORD_WEBHOOK_URL` **하나**였는데 실행 로그의 env 에 그 값이
 * **빈 문자열**이었다. 즉 통보가 0 이었고, 아무도 몰랐다.
 *
 * 이게 왜 큰가: 이 artifact 가 **월간 복원 훈련(`d1-restore-drill.yml`)의 입력**이다.
 * 훈련은 08-01 에 07-29 artifact 를 한 번 검증한 것이 전부다 —
 * **그 뒤로 "복원되는 것이 확인된 백업"이 하나도 없다.**
 *
 * 그리고 로그에 **원인이 한 줄도 없었다.** `wrangler d1 execute` 의 stdout 만 파일로 보내고
 * stderr 를 안 붙잡아서, `bash -e` 가 그 자리에서 죽으면 아무 말도 안 남았다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *
 * - 워크플로는 러너에서만 도므로 **실행해 볼 수 없다.** 텍스트 수준에서 배선 존재까지만 본다.
 * - **왜 실패하는지**(토큰 만료 추정)는 여기서 못 고친다 — 시크릿은 대표 영역이다.
 *   이 시험이 보장하는 것은 "다음에 실패하면 **보이고, 원인을 말한다**" 까지다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const yml = readFileSync('.github/workflows/d1-backup.yml', 'utf8')

describe('🚨 d1-backup.yml — 실패가 보이는가', () => {
  it('파일을 읽었다 (0바이트면 통과가 아니라 실패)', () => {
    expect(yml.length).toBeGreaterThan(500)
  })

  it('🔴 시크릿 없이도 동작하는 통보 경로가 있다 (이슈)', () => {
    // 스텝 단위로 자른다 — 길이 상한으로 잘라 읽는 검사는 코드가 자라면 조용히 죽는다
    // (2026-08-12 에 ads-enrich-shards 가 정확히 그렇게 헛돌았다).
    const steps = yml.split(/\n      - name: /)
    // ⚠️ `issues.create` 로 찾으면 **`issues.createComment` 에 걸린다**(부분문자열). 첫 판이 실제로
    //   그래서 결함을 심어도 초록이 떴다 — 이 세션이 하루 종일 잡은 바로 그 함정이다.
    const failStep = steps.find((b) => b.includes('if: failure()') && b.includes('issues.create({'))
    expect(failStep, '실패 시 이슈를 여는 스텝이 없다 — 디스코드 훅이 비면 통보가 0 이 된다').toBeTruthy()
    expect(yml, 'issues:write 권한이 없으면 그 스텝이 실패한다').toMatch(/permissions:[\s\S]{0,120}issues:\s*write/)
  })

  it('🔴 열려 있으면 새 이슈를 쌓지 않는다 (#845 는 코멘트 84개로 죽었다)', () => {
    expect(yml).toMatch(/if \(issues\[0\]\)/)
    expect(yml).toMatch(/createComment/)
  })

  it('🔴 성공하면 실패 이슈를 닫는다 — 안 닫으면 그것이 또 영구 빨간불이다', () => {
    const steps = yml.split(/\n      - name: /)
    const okStep = steps.find((b) => b.includes('if: success()') && b.includes("state: 'closed'"))
    expect(okStep, '성공 시 닫는 스텝이 없다 — 한 번 열린 실패 이슈가 영원히 남는다').toBeTruthy()
  })

  it('🔴 wrangler 실패가 자기 원인을 말한다 (stderr 를 붙잡는다)', () => {
    // 3주치 실패 로그에 원인이 한 줄도 없던 이유가 이것이다.
    const captures = yml.split('\n').filter((l) => /2>\s*\w+\.err/.test(l))
    expect(captures.length, 'stderr 캡처가 사라졌다').toBeGreaterThanOrEqual(2)
    expect(yml, '캡처만 하고 안 찍으면 똑같다').toMatch(/cat wrangler\.err/)
  })
})

/**
 * 🧪 **복원 훈련이 "옛 백업으로 초록불"을 내지 않는다** (2026-08-25)
 *
 * 훈련은 `d1-backup.yml` 의 **가장 최근 *성공*** run 을 집어온다. 그래서 백업이 몇 주째
 * 실패해도 옛 성공분을 복원해 보고 **성공**을 낸다 — *"복원 가능한 백업이 있다"* 는 결론이
 * 사실이 아닌데도 초록이다.
 *
 * 실측(2026-08-25): 마지막 성공 백업이 **26일 전**(07-29)인데 08-01 훈련은 초록이었고,
 * 09-01 훈련도 그대로면 또 초록이었을 것이다. 주간 백업이라 14일(2주기)을 한도로 둔다.
 *
 * ⚠️ 못 막는 것: 백업이 *성공했지만 내용이 비었을* 경우는 이 검사 밖이다
 *   (그건 같은 워크플로의 `CREATE TABLE` 검사가 본다).
 */
describe('🧪 d1-restore-drill.yml — 옛 백업으로 초록불을 내지 않는다', () => {
  const drill = readFileSync('.github/workflows/d1-restore-drill.yml', 'utf8')

  it('파일을 읽었다 (0바이트면 통과가 아니라 실패)', () => {
    expect(drill.length).toBeGreaterThan(500)
  })

  it('🔴 백업 나이를 재고 한도를 넘기면 실패한다', () => {
    expect(drill, '나이 계산이 없다 — 5주 묵은 백업도 초록이 된다').toMatch(/AGE_DAYS=/)
    expect(drill, '한도 비교가 없다').toMatch(/AGE_DAYS.*-gt 14/)
    // 재기만 하고 안 죽으면 똑같다 — 비교 줄 **다음 8줄 안**에 exit 가 있어야 한다.
    const lines = drill.split('\n')
    const at = lines.findIndex((l) => /AGE_DAYS.*-gt 14/.test(l))
    expect(at, '한도 비교 줄을 못 찾았다').toBeGreaterThan(-1)
    expect(lines.slice(at, at + 8).join('\n'), '한도를 넘겨도 exit 하지 않는다').toContain('exit 1')
  })

  it('🔴 시각을 못 읽으면 통과가 아니라 실패 쪽으로 기운다', () => {
    // 빈 값 → 999일 → 한도 초과 → 실패. 0 으로 떨어지면 "방금 만든 백업"으로 읽혀 늘 통과한다.
    expect(drill).toMatch(/print\(999 if t is None else/)
  })
})
