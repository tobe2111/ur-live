/**
 * 🔔 **경보 채널이 비어 있다는 사실은 보여야 한다** — 2026-08-03 라이브에서 잡음.
 *
 *   유어애즈의 경보는 전부 `if (env.DISCORD_WEBHOOK_URL && …)` 형태다. 값이 없으면 아무 흔적 없이
 *   건너뛴다 = **경보가 무음이라는 사실 자체가 무음**이었다. 실측: `ur-ads` 에 미설정이라
 *   시트 미러가 **이틀 멈춘 동안 디스코드 알림 0건**. 같은 시점 메인(`ur-live` Pages)엔 설정돼 있어
 *   유어딜 머니 경보(정산·원장)는 정상이었다 — 두 워커의 env 가 갈렸는데 밖에서 볼 방법이 없었다.
 *
 *   ⇒ 헬스체크가 "알림이 갈 곳이 있는가"를 게이트·튜닝과 같은 급으로 노출한다.
 *
 * ⚠️ **이 테스트가 못 막는 것**: 값이 *설정돼 있는데* 웹훅 URL 이 죽은 경우(폐기된 채널 등).
 *   그건 코드로 알 수 없다 — 실제 발사만이 판정한다. 여기서 고정하는 건 "비어 있음이 보이는가"뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'src/worker-ads/health.routes.ts'), 'utf8')
/** 주석을 걷어내고 **코드만** 본다 — 근거를 적을수록 가드가 깨지면 다음 사람이 주석을 지운다. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('헬스체크가 경보 채널 유무를 노출한다', () => {
  it('alerts 블록이 있고 DISCORD_WEBHOOK_URL 을 실제로 읽는다', () => {
    expect(CODE).toMatch(/alerts:\s*\{/)
    expect(CODE).toMatch(/discord:\s*e\.DISCORD_WEBHOOK_URL\s*\?/)
  })

  it('미설정일 때 "무음"이라고 말한다 — 빈 문자열·false 로 뭉개지 않는다', () => {
    const m = CODE.match(/discord:\s*e\.DISCORD_WEBHOOK_URL\s*\?\s*'([^']*)'\s*:\s*'([^']*)'/)
    expect(m, 'discord 필드가 삼항으로 두 상태를 구분해야 한다').toBeTruthy()
    expect(m![2], '미설정 문구가 비어 있으면 화면에서 정상과 구분이 안 된다').not.toBe('')
    expect(m![2]).toMatch(/무음|미설정/)
  })

  it('무음이 되는 경보 목록을 같이 보여 준다 — 무엇을 잃는지 알아야 판단한다', () => {
    expect(CODE).toMatch(/muted_when_unset:\s*\[/)
    // 실제로 Discord 로만 나가는 유어애즈 경보 셋(호출부: sheets-mirror-lane / collect-health-alert / outreach-webhook)
    for (const k of ['시트', '수집', '팔로업']) expect(CODE, `${k} 경보가 목록에 없다`).toContain(k)
  })

  it('채널이 없어도 남는 곳(pull)을 구분해 알린다 — "기록도 안 된다"로 오해하면 과잉대응한다', () => {
    expect(CODE).toMatch(/always_recorded:/)
    expect(CODE).toMatch(/cron_failures/)
  })
})

/**
 * 🔔 **실발사 확인 경로** — "설정됨"과 "도착함"은 다르다. env 에 값이 있어도 URL 이 오타거나
 *   채널이 지워졌으면 경보는 조용히 실패한다. 그걸 물을 방법이 없던 것을 라우트로 만들었다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 도착 여부. 그건 대표가 채널을 눈으로 봐야 한다.
 *   여기서 고정하는 건 **"이 라우트가 결과를 삼키지 않는가"** 뿐이다 — 삼키면 존재 이유가 사라진다.
 */
describe('경보 채널 실발사 확인 라우트', () => {
  it('라우트가 있고 미설정이면 NOT_CONFIGURED 로 거절한다', () => {
    expect(CODE).toMatch(/healthRoutes\.post\('\/__ads\/alert-test'/)
    expect(CODE).toMatch(/NOT_CONFIGURED/)
  })

  it('🚫 결과를 삼키지 않는다 — Discord HTTP 상태를 그대로 돌려준다', () => {
    // 이 라우트의 존재 이유. `ok: true` 만 주면 이 라우트도 같은 병에 걸린다.
    expect(CODE).toMatch(/status:\s*res\.status/)
    expect(CODE).toMatch(/ok:\s*res\.ok/)
    // 실패를 조용히 넘기는 형태 금지
    expect(CODE).not.toMatch(/fetch\(url[\s\S]{0,200}?\.catch\(\(\)\s*=>\s*(null|undefined|\{\})\)/)
  })

  it('🔒 응답에 웹훅 URL 을 싣지 않는다 — 노출되면 누구나 그 채널에 글을 쓴다', () => {
    const route = CODE.slice(CODE.indexOf("'/__ads/alert-test'"))
    expect(route).not.toMatch(/c\.json\([^)]*\burl\b/)
    expect(route).not.toMatch(/webhook:\s*url/)
  })
})
