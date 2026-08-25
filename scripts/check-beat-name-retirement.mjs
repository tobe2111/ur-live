#!/usr/bin/env node
/**
 * 🪦 **하트비트 이름을 조용히 없애지 못하게 한다** — 사라진 이름은 영원히 빨갛다 (2026-08-25 신설)
 *
 * ## 왜 (같은 사고가 하루에 두 번 났다)
 *
 * 하트비트 행(`platform_settings` 의 `cron_hb:{name}`)은 **코드보다 오래 산다.** 코드가 어떤
 * 이름을 그만 쓰면 그 행은 아무도 갱신하지 않고, 영원히 `stale` 이고, `ok` 를 영원히 문다.
 * 그리고 이 레포에서 **영원한 빨간불 하나가 경보 채널 전체를 침묵시킨다**:
 *
 * ```
 *   d1-backup   08-02 OOM 사망 → 후임(d1-backup-chunked)이 인수, 이름만 남음
 *               → /api/_healthcheck/cron 이 21일째 503
 *               → 이슈 #1056 이 08-04 부터 한 줄도 안 바뀜
 *               → 그 사이 08-24 일간 16개(정산 성숙·원장 정합) 누락이 **신호 0**
 *
 *   __tick      #1210 이 전역 틱을 트리거별(`__tick:{cron}`)로 쪼갬
 *               → 배포 09:50 이 마지막 기록, 임계 40분 → **10:30 에 새 빨간불**
 *               → `d1-backup` 을 걷어내는 바로 그 작업이 같은 함정을 다시 팠다
 *
 * ```
 *
 * 둘 다 **배포 후에** 사람이 라이브를 들여다보고서야 알았다. 커밋 시점에 알 수 있는 사실인데도.
 *
 * ## 무엇을 보는가
 *
 * `origin/main` 대비 **디스패치 파일에서 사라진 리터럴 이름**을 찾고, 그 이름이
 * `BEAT_RENAMED_TO`(개명 지도)에 등록됐는지 본다. 등록 없이 사라지면 경고.
 *
 * ## ⚠️ 이 가드가 못 보는 것 (과신 금지)
 *
 * - **리터럴만 본다.** `` `__tick:${cron}` `` 같은 템플릿이 만들어내는 이름은 열거할 수 없다.
 *   (그래도 `__tick` 사고는 잡는다 — 사라진 쪽이 리터럴이었다.)
 * - **`origin/main` 기준의 *변화*만 본다.** 이미 main 에 쌓여 있는 옛 고아는 안 보인다.
 *   그건 라이브 하트비트 조회로만 판정된다(2026-08-25 전수 조회 결과 `d1-backup` 하나였다).
 * - 유어애즈 레인(`ads:*`)은 대상이 아니다 — 그쪽은 디스패처가 아는 이름 목록으로
 *   런타임이 판정한다(`classifyBeat` 의 `knownBaseNames`).
 *
 * 예외: 같은 줄 또는 개명 지도에 `beat-retire-ok` 주석.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const DISPATCH_FILES = ['src/worker/scheduled.ts', 'src/worker/cron/daily-lane.ts']
const MAP_FILE = 'src/worker/utils/cron-beat-retirement.ts'
const ALLOW_MARK = 'beat-retire-ok'
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

let fail = 0
const err = (m) => { console.error(`   ❌ ${m}`); fail++ }

/** 이 소스가 **문자열 리터럴로** 기록하는 하트비트 이름 전부. */
export function beatNames(code) {
  const out = new Set()
  const pats = [
    /recordCronBeat\(\s*[A-Za-z_$][\w$]*\s*,\s*'([^']+)'/g,  // 진단 프로브
    /safeCron\(\s*'([^']+)'/g,                                // 표준 래퍼
    /slotCron\([^)]*\)\(\s*'([^']+)'/g,                       // 5분 틱 위의 분 게이트
    /\brun\(\s*'([^']+)'/g,                                   // daily-lane 의 주입된 래퍼
  ]
  for (const re of pats) for (const m of code.matchAll(re)) out.add(m[1])
  return out
}

/**
 * 🔑 **판정 본체(순수)** — 사라진 이름 중 *처리되지 않은* 것.
 *
 * 스크립트는 `origin/main` 이 필요해 단위 시험이 통째로 못 돌린다. 그래서 판정만 떼어
 * 시험 가능하게 둔다 — 안 그러면 이 가드의 되돌려-검증이 "종료코드만 보는" 헛것이 된다
 * (2026-08-25 에 `check-guard-mutations` 자신이 정확히 그 상태였다).
 */
export function findOrphans(removed, mapped, mapSrc) {
  return removed.filter((n) => !mapped.has(n) && !String(mapSrc || '').includes(`${ALLOW_MARK} ${n}`))
}

function atMain(path) {
  try { return execSync(`git show origin/main:${path}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) }
  catch { return null }   // main 에 없던 새 파일 — 사라진 이름이 있을 수 없다
}
const read = (p) => { try { return readFileSync(p, 'utf8') } catch { return '' } }

// 📦 `import` 로 불릴 땐 판정 함수만 내준다 — 본체가 그대로 돌면 `process.exit` 가
//    **시험 러너를 죽인다**(첫 판이 실제로 그랬다).
const INVOKED_DIRECTLY = Boolean(process.argv[1] && process.argv[1].endsWith('check-beat-name-retirement.mjs'))

function main() {
  const head = new Set()
  const main_ = new Set()
  let sawAny = false
  for (const f of DISPATCH_FILES) {
    const h = read(f)
    if (h) { sawAny = true; for (const n of beatNames(h)) head.add(n) }
    const m = atMain(f)
    if (m) for (const n of beatNames(m)) main_.add(n)
  }

  // 🛡️ **측정 대상 0건은 통과가 아니라 실패다** — 경로가 낡아 조용히 비면 이 가드가 헛돈다.
  //   ⚠️ 여기만 `STRICT` 와 무관하게 **무조건 exit 1** 이다. 나머지 위반은 warn/strict 관례를 따르지만,
  //   "잴 대상이 0개"는 위반이 아니라 **가드 자신이 고장난 것**이라 경고로 넘길 성질이 아니다.
  if (!sawAny || head.size === 0) {
    err(`디스패치 파일에서 하트비트 이름을 하나도 못 찾았다 — 경로(${DISPATCH_FILES.join(', ')})가 낡았다`)
    process.exit(1)
  } else if (main_.size === 0) {
    console.log(`   ℹ️ origin/main 을 못 읽었다(얕은 클론?) — 비교를 건너뛴다. HEAD 이름 ${head.size}개.`)
  } else {
    const mapSrc = read(MAP_FILE)
    const mapped = new Set([...mapSrc.matchAll(/^\s*'([^']+)':\s*'[^']+',/gm)].map((m) => m[1]))
    const removed = [...main_].filter((n) => !head.has(n))
    const orphan = findOrphans(removed, mapped, mapSrc)
    for (const n of orphan) {
      err(`'${n}' 이 디스패치에서 사라졌는데 개명 지도에 없다 — 그 하트비트 행은 영원히 빨갛고, `
        + `영원한 빨간불 하나가 경보 채널 전체를 침묵시킨다(#1056 이 21일). `
        + `${MAP_FILE} 의 BEAT_RENAMED_TO 에 후임을 적거나, 정말 후임이 없으면 '${ALLOW_MARK} ${n}' 주석을 남길 것.`)
    }
    if (!orphan.length) {
      console.log(`   ✅ beat-name-retirement: 사라진 이름 ${removed.length}개 전부 처리됨 (HEAD ${head.size} / main ${main_.size} · 지도 ${mapped.size})`)
    }
  }

  if (fail) {
    console.error(`\n🪦 하트비트 이름 은퇴 검사 실패 ${fail}건`)
    process.exit(STRICT ? 1 : 0)
  }
  process.exit(0)
}

if (INVOKED_DIRECTLY) main()
