/**
 * 🔀 **한 레인의 주기가 두 곳에 적혀 있다** — cron 게이트(`index.ts` / `cron-public-data.ts`)와
 *   알람 등록부(`lane-alarm-runners.ts`). 갈리면 **조용히** 옛 주기로 돈다.
 *
 * ## 실사고 (2026-08-11 라이브 실측)
 * 2026-08-10 에 대표 지시로 공고 스캔을 일 1회 → **4시간마다**로 올렸다. cron 게이트는 고쳤는데
 * (`gates.everyNHours(4, 1, '/__ads/scan-notices')`) 그 게이트는 `!laneAlarmDrivesEnrich(env)` 뒤에
 * 있고 **라이브는 알람이 몬다.** 알람 등록부는 `getUTCHours() !== 21` 그대로였다.
 * ```
 *   ads_notice_stats:  last_run 2026-08-10 21:00 · total_runs 11   ← 여전히 일 1회
 * ```
 * 배포는 성공했고 테스트도 초록이었고 **증설은 한 번도 발효되지 않았다.** 이 레포가 반복해 만난
 * "실패가 아니라 조용한 부재" 클래스이고, 이번엔 *대표가 요청한 기능 자체*가 그렇게 사라졌다.
 *
 * ## 이 파일이 강제하는 것
 * - **R1 겹침 금지** — 알람이 모는 레인의 cron 등록은 반드시 `laneAlarmOn`/`laneAlarmDrivesEnrich`
 *   가드 뒤에. 없으면 두 경로가 같이 돌아 같은 큐를 두 번 집는다(`lane-alarm-boot.ts` 헤더).
 * - **R2 주기 일치** — `dailyAt(H)` ↔ `getUTCHours() !== H` · `everyNHours(N, OFF)` ↔ `% N !== OFF` ·
 *   매시간 `kick` ↔ 시각 게이트 없음.
 *
 * ## ⚠️ 이 테스트가 못 막는 것 (과신 금지)
 * - 상수로 쓴 시각(`dailyAt(RESCAN_HOUR_UTC)`)은 **양쪽이 같은 상수를 쓰는지**만 본다. 상수 값 자체는 안 본다.
 * - cron 에도 알람에도 없는 레인, 그리고 *실제 발화*는 못 본다(코드만 읽는다). 발화는 하트비트가 본다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const SRC = {
  index: 'src/worker-ads/index.ts',
  public: 'src/worker-ads/cron-public-data.ts',
  alarm: 'src/worker-ads/lane-alarm-runners.ts',
}
const read = (p: string): string => fs.readFileSync(p, 'utf8')

/** 알람 등록부의 레인별 본문 — 키가 곧 DO 인스턴스 이름이다. */
function alarmBodies(): Map<string, string> {
  const src = read(SRC.alarm)
  const out = new Map<string, string>()
  for (const m of src.matchAll(/^ {2}'([a-z0-9-]+)': \{/gm)) {
    const start = m.index!
    const end = src.indexOf('\n  },', start)
    out.set(m[1], src.slice(start, end === -1 ? src.length : end))
  }
  return out
}

type CronReg = { file: string; lineNo: number; lane: string; kind: 'dailyAt' | 'everyNHours' | 'kick'; args: string; guarded: boolean }

/**
 * cron 등록을 훑는다. 가드 판정은 **바로 감싸는 `if`** 로 본다 — 같은 줄이거나, 위로 올라가며
 * 들여쓰기가 더 얕은 첫 `if (`. (앞선 초안은 "위 8줄 안에 있으면 가드"로 봤다가 **바로 위 블록의
 * 가드를 자기 것으로 착각**해 `enrich-prospects` 를 통과시켰다 — 근접이 곧 포함은 아니다.)
 */
function cronRegistrations(): CronReg[] {
  const out: CronReg[] = []
  for (const file of [SRC.index, SRC.public]) {
    const lines = read(file).split('\n')
    lines.forEach((l, i) => {
      const m = /(?:gates\.(dailyAt|everyNHours)\(|(kick)\()([^'"]*)['"]\/__ads\/([a-z0-9?=&-]+)/.exec(l)
      if (!m) return
      const kind = (m[1] || 'kick') as CronReg['kind']
      const indent = l.search(/\S/)
      let guarded = /laneAlarmOn|laneAlarmDrivesEnrich/.test(l)
      for (let k = i - 1; k >= 0 && !guarded; k--) {
        const prev = lines[k]
        if (!prev.trim() || prev.trim().startsWith('//') || prev.trim().startsWith('*')) continue
        const pi = prev.search(/\S/)
        if (pi >= indent) continue                       // 형제 문장 — 나를 감싸지 않는다
        if (!/^\s*(\} else )?if \(/.test(prev)) break     // 더 얕은데 if 가 아니면 감싸는 if 는 없다
        guarded = /laneAlarmOn|laneAlarmDrivesEnrich/.test(prev)
        break
      }
      out.push({ file, lineNo: i + 1, lane: m[4].split('?')[0], kind, args: m[3], guarded })
    })
  }
  return out
}

const ALARM = alarmBodies()
const CRON = cronRegistrations()

describe('cron ↔ 알람 주기 정합', () => {
  it('두 소스를 실제로 읽었다 (0건이면 통과가 아니라 실패다)', () => {
    expect(ALARM.size).toBeGreaterThan(10)
    expect(CRON.length).toBeGreaterThan(15)
    expect(ALARM.has('scan-notices')).toBe(true)
  })

  /**
   * 🔒 R1 — 두 경로가 같이 돌면 같은 큐를 두 번 집는다(선점이 아니라 정렬+LIMIT 이라 중복이 조용하다).
   */
  it('🔒 알람이 모는 레인의 cron 등록은 알람 가드 뒤에 있다', () => {
    const bad = CRON.filter(r => ALARM.has(r.lane) && !r.guarded)
      .map(r => `${r.file}:${r.lineNo} ${r.lane}`)
    expect(bad, `알람 등록부에 있는데 cron 이 무조건 킥한다:\n${bad.join('\n')}`).toEqual([])
  })

  /**
   * 🔒 R2 — 실사고 그 자체. cron 쪽 시각/주기와 알람 쪽 시각 게이트가 **같은 값**이어야 한다.
   */
  it('🔒 같은 레인의 주기가 두 곳에서 일치한다', () => {
    const bad: string[] = []
    for (const r of CRON) {
      const body = ALARM.get(r.lane)
      if (!body) continue                       // cron 전용 레인 — 정합 대상이 아니다
      const arg = r.args.split(',').map(s => s.trim()).filter(Boolean)
      if (r.kind === 'dailyAt') {
        const h = arg[0]
        if (!new RegExp(`getUTCHours\\(\\)\\s*!==\\s*${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(body)) {
          bad.push(`${r.lane}: cron dailyAt(${h}) ↔ 알람에 'getUTCHours() !== ${h}' 없음`)
        }
      } else if (r.kind === 'everyNHours') {
        const [n, off] = arg
        // ⏳ 2026-08-17: 주기를 **경과 시간**으로 선언하는 표현도 정합으로 인정한다(`minIntervalHours: N`).
        //   짝수성 리터럴만 인정하면, 유실 회차를 이어받게 만드는 그 수정이 이 가드에 막힌다.
        //   지켜야 하는 것은 "표현"이 아니라 **주기 N 이 두 곳에서 같다**는 사실이다.
        const parity = new RegExp(`getUTCHours\\(\\)\\s*%\\s*${n}\\s*!==\\s*${off}\\b`).test(body)
        const elapsed = new RegExp(`minIntervalHours:\\s*${n}\\b`).test(body)
        if (!parity && !elapsed) {
          bad.push(`${r.lane}: cron everyNHours(${n}, ${off}) ↔ 알람에 '% ${n} !== ${off}' 도 'minIntervalHours: ${n}' 도 없음`)
        }
      } else if (/getUTCHours\(\)/.test(body)) {
        // 매시간 kick 인데 알람만 시각 게이트를 갖고 있으면 알람 쪽이 조용히 성기게 돈다.
        bad.push(`${r.lane}: cron 은 매시간(kick)인데 알람에 시각 게이트가 있다`)
      }
    }
    expect(bad, `주기가 두 벌로 갈렸다 — 라이브는 알람 쪽으로 돈다:\n${bad.join('\n')}`).toEqual([])
  })

  /** 회귀 앵커 — 실사고 당사자는 값까지 못 박는다(다시 일 1회로 돌아가면 여기서 걸린다). */
  it('🔒 공고 스캔은 4시간마다 (2026-08-10 대표 지시)', () => {
    expect(ALARM.get('scan-notices')).toMatch(/getUTCHours\(\) % 4 !== 1/)
    expect(read(SRC.public)).toMatch(/everyNHours\(4, 1, '\/__ads\/scan-notices'/)
  })
})

/**
 * 🕳️ **일 1회 레인이 cron 에 남아 있으면 혼잡한 시각의 꼬리가 된다** (2026-08-12, 5차 이관).
 *
 * `dailyAt` 은 `isDeferrable=false`(=`always`) 라 **회차 예산이 못 막는다.** 부모가 그 시각의 레인을
 * 전부 띄우다 CPU 로 죽으면 `waitUntil` 이 안 비워지고 뒤쪽 자식은 **시작조차 못 한다.**
 * 매시간 레인은 다음 정각이 있지만 **일 1회 레인은 그날이 끝**이고, 에러가 없어 경보도 안 울린다.
 *
 * 실측(`ads_tick_history`, 08-11):
 * ```
 *   h=17 ran=8 p:1  → sweep-mx 침묵      h=22 ran=8 p:1  → collect-franchise 침묵
 *   ran<=6 인 16개 회차는 전부 정상 마감
 * ```
 *
 * ## ⚠️ 이 테스트가 못 하는 것
 * "혼잡한가"를 판정하지 못한다(런타임 사실이라 코드에 없다). 대신 **cron 무가드 잔류 목록을 고정**해
 * 새 `dailyAt` 을 아무 생각 없이 cron 에 얹지 못하게 한다 — 얹으려면 이 목록을 고치며 근거를 보게 된다.
 */
describe('cron 잔류 일 1회 레인', () => {
  const unguardedDaily = (): string[] => CRON.filter(r => r.kind === 'dailyAt' && !r.guarded).map(r => r.lane).sort()

  /**
   * 🔒 남은 둘은 **측정으로** 남긴 것이다:
   *   - `silence-digest`(23h) — 같은 날 h=23 은 `ran=5` 정상 마감 + 하트비트 08-11 23:01 로 실제 발화.
   *   - `collect-market`(20h) — `ADS_MARKET_ENABLED` 미설정이라 애초에 등록조차 안 된다(원부 1,393건
   *     이미 전량 수집 `stopped_by:end`). 굶은 게 아니라 꺼진 것이다.
   */
  it('🔒 cron 무가드 dailyAt 은 이 둘뿐 — 늘리려면 5차 이관 근거를 먼저 읽어라', () => {
    expect(unguardedDaily()).toEqual(['collect-market', 'silence-digest'])
  })

  it('🔒 5차 이관 두 레인은 알람이 몬다 (cron 으로 되돌리면 다시 굶는다)', () => {
    for (const lane of ['sweep-mx', 'collect-franchise']) {
      expect(ALARM.has(lane), `${lane} 이 알람 등록부에서 사라졌다`).toBe(true)
      // 시각 보존 — 이관은 '누가 모는가'만 바꾸고 외부 호출량은 그대로여야 한다(R2 가 값도 대조한다).
      expect(ALARM.get(lane)).toMatch(/getUTCHours\(\) !== (17|22)\b/)
    }
  })
})
