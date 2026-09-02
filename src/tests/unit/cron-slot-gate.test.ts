/**
 * ⏰ **죽은 cron 슬롯 부활**을 고정한다 (2026-08-11 AB 스윕에서 발견).
 *
 * ## 무엇이 있었나
 *
 * `scheduled.ts` 에 `if (cron === '0 * * * *')` 같은 블록이 있었지만 그 표현식들은
 * **`wrangler.toml` 에 등록된 적이 없다.** Cloudflare 는 등록된 문자열만 발화하므로 그 안의
 * 작업 29개는 에러도 하트비트도 없이 **그냥 안 돌았다.** 실측 증거:
 *
 * ```
 * demo-image-rehost 하트비트: 없음
 * 데모 334건 중 294건이 demo_cond_v=3 에 정체 (현재 규칙은 v4)
 * ```
 * 즉 2026-08-08 에 배포한 "근거 없는 사진 안 쓴다" 규칙이 **한 장도 적용되지 않았다.**
 * 배포는 내내 초록불이었다 — 이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 다.
 *
 * ## 이 테스트가 지키는 것
 *
 * 계정 cron 한도가 5개라 트리거를 못 늘려서, 살아 있는 `*​/5` 틱에서 분 게이트로 되살렸다.
 * 그 방식엔 **조용히 다시 죽는 길이 두 개** 있어서 각각을 앵커로 박는다.
 *
 * ⚠️ **이 테스트가 못 막는 것**: `*​/5` 자체가 `wrangler.toml` 에서 빠지는 경우(여기 얹힌 전부가
 * 같이 죽는다) — 그건 `check-cron-slot-registered.mjs` 의 몫이다. 그리고 작업이 *돌긴 도는데*
 * 내부에서 조기 return 하는 경우 — 그건 하트비트(`cron_hb:*`)로만 보인다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { slotDue } from '../../worker/cron-slot'

const SCHED = 'src/worker/scheduled.ts'
/** 주석은 배선이 아니다 — 실행 코드만 남긴다(이 레포가 반복해 걸린 함정). */
const code = readFileSync(SCHED, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')

/** 2026-08-11T03:35:00Z = 목요일 */
const at = (iso: string) => Date.parse(iso)

describe('slotDue — 분/시/요일 게이트', () => {
  it('분이 맞아야 실행한다', () => {
    expect(slotDue(at('2026-08-11T09:25:00Z'), { minute: 25 })).toBe(true)
    expect(slotDue(at('2026-08-11T09:30:00Z'), { minute: 25 })).toBe(false)
  })

  it('시를 주면 그 시에만 — 하루 1회가 시간당 1회로 새지 않는다', () => {
    expect(slotDue(at('2026-08-11T03:30:00Z'), { minute: 30, hour: 3 })).toBe(true)
    expect(slotDue(at('2026-08-11T04:30:00Z'), { minute: 30, hour: 3 })).toBe(false)
  })

  it('요일을 주면 그 요일에만', () => {
    // 2026-08-10 은 월요일
    expect(slotDue(at('2026-08-10T00:15:00Z'), { minute: 15, hour: 0, dow: 1 })).toBe(true)
    expect(slotDue(at('2026-08-11T00:15:00Z'), { minute: 15, hour: 0, dow: 1 })).toBe(false)
  })

  it('격자에 스냅한다 — 스케줄 시각이 살짝 어긋나도 놓치지 않는다', () => {
    // :24:59.7 로 도착해도 :25 틱이다. 스냅이 없으면 minute=24 라 영원히 false.
    expect(slotDue(at('2026-08-11T09:24:59.700Z'), { minute: 25 })).toBe(true)
    expect(slotDue(at('2026-08-11T09:25:01.200Z'), { minute: 25 })).toBe(true)
  })

  it('🔴 시각을 모르면 실행하지 않는다 — 여기서 열면 시간당 1회가 5분마다로 12배가 된다', () => {
    expect(slotDue(undefined, { minute: 25 })).toBe(false)
    expect(slotDue(null, { minute: 25 })).toBe(false)
    expect(slotDue(Number.NaN, { minute: 25 })).toBe(false)
  })
})

describe('호출부 — 조용히 다시 죽는 두 길', () => {
  /**
   * 🗄️ 2026-08-23: 한 작업이 **여러 슬롯**을 쓰는 형태가 생겼다 —
   *   `[5, 20, 35, 50].some((m) => slotDue(event.scheduledTime, { minute: m }))`
   *   (백업이 시간당 1회면 전체 스냅샷에 60시간이라 4회로 올렸다).
   *   그러면 `minute: m` 이 **변수**라 아래 리터럴 파서가 `Number('m') = NaN` 을 만든다.
   *   ⚠️ 이걸 "그냥 NaN 은 건너뛰자"로 처리하면 **그 슬롯들이 검사 밖으로 나간다** — 5의 배수
   *   규칙도, 겹침 규칙도 안 걸린다. 그래서 **배열 값을 펼쳐서 똑같이 검사**한다.
   */
  const arrayForm = [...code.matchAll(
    /\[([\d,\s]+)\]\.some\(\((\w+)\) => slotDue\(\s*event\.scheduledTime\s*,\s*\{\s*minute:\s*\2\s*\}\s*\)\)/g,
  )].flatMap((m) => m[1].split(',').map((x): Record<string, number> => ({ minute: Number(x.trim()) })))

  const literalForm = [...code.matchAll(/slotDue\(\s*event\.scheduledTime\s*,\s*\{([^}]*)\}/g)]
    .map((m) => {
      const o: Record<string, number> = {}
      for (const kv of m[1].split(',')) {
        const [k, v] = kv.split(':').map((s) => s.trim())
        if (k) o[k] = Number(v)
      }
      return o
    })
    // 배열 형태의 `{ minute: m }` 은 위에서 이미 펼쳤다 — 여기선 리터럴 숫자만 남긴다.
    .filter((o) => Number.isFinite(o.minute))

  // 📉 2026-09-02: 다이어트 PR 이 시간·일 게이트를 `slotOpen({ … })`(= slotDue || catchupOpens 래퍼)로 넘긴다.
  //   래퍼 호출부도 같은 격자 규칙(5의 배수)을 받아야 한다 — 안 보면 그 슬롯들이 검사 밖으로 나간다(위 배열 형태와 같은 함정).
  const wrapperForm = [...code.matchAll(/slotOpen\(\s*\{([^}]*)\}/g)]
    .map((m) => {
      const o: Record<string, number> = {}
      for (const kv of m[1].split(',')) {
        const [k, v] = kv.split(':').map((s) => s.trim())
        if (k) o[k] = Number(v)
      }
      return o
    })
    .filter((o) => Number.isFinite(o.minute))

  const specs = [...literalForm, ...arrayForm, ...wrapperForm]

  it('호출부가 실제로 존재한다 — 0건이면 통과가 아니라 실패다', () => {
    expect(specs.length, 'slotDue 호출부를 하나도 못 찾았다(파일 구조가 바뀌었나?)').toBeGreaterThanOrEqual(4)
  })

  it('🔴 분은 전부 5의 배수 — `*/5` 격자를 벗어나면 그 슬롯은 영원히 안 돈다', () => {
    // 이 테스트가 막으려는 것: `{ minute: 7 }` 같은 값. 문법·타입·빌드 전부 통과하고
    // 배포도 초록불인데 그 작업만 조용히 사라진다 — 정확히 이 파일이 고친 그 사고다.
    for (const s of specs) expect(s.minute % 5, `minute=${s.minute} 는 */5 틱에 없다`).toBe(0)
  })

  it('🔴 그룹마다 분이 달라야 한다 — 한 인보케이션에 몰면 서브리퀘스트 예산이 터진다', () => {
    // safeCron 들은 같은 인보케이션에서 예산(무료 50)을 나눠 쓴다. 2026-08-04 에 B2B 레인 3개가
    // 그렇게 죽었다. 분이 다르면 인보케이션이 달라 예산도 따로 받는다.
    const keys = specs.map((s) => `${s.hour ?? '*'}:${s.minute}:${s.dow ?? '*'}`)
    expect(new Set(keys).size, `게이트가 겹친다: ${keys.join(' , ')}`).toBe(keys.length)
  })
})

describe('되살린 슬롯이 등록 안 된 표현식으로 되돌아가지 않는다', () => {
  it.each(['*/2 * * * *', '0 * * * *', '0 3 * * *', '0 9 * * *', '0 0 * * *'])(
    "🔴 `cron === '%s'` 분기가 되살아나지 않았다",
    (expr) => {
      // 되돌리면 그 블록은 **다시 침묵한다**(에러 0, 하트비트 0). wrangler.toml 에 없는 표현식이다.
      expect(code, `등록되지 않은 슬롯 '${expr}' 이 다시 쓰였다`).not.toContain(`cron === '${expr}'`)
    },
  )
})
