#!/usr/bin/env node
/**
 * 🧭 주입 앵커가 소스에 실재하는가 — **낡은 지도**를 1초에 잡는다 (2026-09-26 신설)
 *
 * ## 왜 따로 만들었나
 * `check-guard-mutations` 는 두 가지를 잡는다: ① **헛도는 가드**(결함을 심었는데 통과)
 * ② **낡은 지도**(`find` 가 소스에 없다 = 코드가 옮겨졌다). ①은 테스트를 실제로 돌려야 하니
 * 전수 실행이 오래 걸려서, PR 에서는 `--changed` 로 좁혀 돌고 전수는 main push·야간에만 돈다.
 *
 * 📏 **실측(2026-09-26, job 108341703677 — 주입 1,963건)**: 전수 폴백 시 그 스텝 하나가
 *   **77.4분(4,643초) = Verify 전체 91.0분의 85%**. (2026-09-08 당시엔 37분 24초였다 —
 *   그때는 주입이 더 적었다. 매니페스트가 자라면 이 값도 같이 자란다.)
 *
 * 그런데 **②는 테스트를 돌릴 필요가 없다** — 문자열이 파일에 있는지 보면 끝이다.
 * 그걸 그 긴 스텝에 묶어 두면, 앵커가 낡은 채 PR 이 통과하고 **main 에서야 빨간불**이 난다.
 * 📏 같은 실행에서 **이 검사는 0초**였다(1,963건 · 637파일). 77.4분 안에 섞여 있던 판정 하나가
 *   떼어 내니 무료가 됐다 — 그게 이 파일이 있는 이유다.
 * 실제로 2026-09-26 에 그렇게 났다(`{tool === 'pin' && <PinSheet …}` 가 `pinReturn` 도입으로
 * 사라졌는데 PR CI 한 바퀴를 태우고서야 드러났고, 그걸 고치는 사이 **두 번째**가 또 생겼다).
 *
 * ⇒ ②만 떼어 **전수로, 테스트 없이** 검사한다. `--changed` 가 놓치는 자리도 여기서 잡힌다.
 *
 * ## 이 가드가 **못** 잡는 것
 * 헛도는 가드(①)는 여전히 `check-guard-mutations` 의 몫이다. 앵커가 멀쩡한데 테스트가 아무것도
 * 안 지키는 경우는 결함을 실제로 심어 봐야만 드러난다.
 *
 * 예외: 없다. 앵커가 없으면 그 주입은 **아무것도 검증하지 않으므로** 예외를 둘 이유가 없다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 분할 매니페스트(`scripts/mutations/*.mjs`) + 런너 안 인라인 배열을 **둘 다** 모은다. */
async function loadAll() {
  const out = []
  const dir = path.join(ROOT, 'scripts', 'mutations')
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) {
      const mod = await import(path.join(dir, f))
      out.push(...mod.default.map((m) => ({ ...m, _src: `mutations/${f}` })))
    }
  }
  // 런너의 인라인 배열은 export 가 없다 — 소스에서 잘라 그대로 평가한다.
  const runnerPath = path.join(ROOT, 'scripts', 'check-guard-mutations.mjs')
  const runner = fs.readFileSync(runnerPath, 'utf8')
  const start = runner.indexOf('const MUTATIONS = [')
  if (start < 0) {
    console.error('❌ stale-mutation-anchors: 런너에서 `const MUTATIONS = [` 를 못 찾았다 — 이 가드가 인라인 주입을 통째로 건너뛰고 있다.')
    process.exit(1)
  }
  const end = runner.indexOf('\n]', start)
  const literal = runner.slice(start + 'const MUTATIONS = '.length, end + 2)
  const mod = await import(`data:text/javascript,export default ${encodeURIComponent(literal).replace(/'/g, '%27')}`)
  out.push(...mod.default.map((m) => ({ ...m, _src: 'check-guard-mutations.mjs (인라인)' })))
  return out
}

const all = await loadAll()

// 🔴 **측정 0 = 실패.** 목록을 못 읽으면 위반도 0이라 초록이 뜨는데, 그 초록은 아무것도 보장하지 않는다.
//   하한을 넉넉히 낮게 잡되(현재 실측 1,962건) 0 은 절대 통과시키지 않는다.
if (all.length < 500) {
  console.error(`❌ stale-mutation-anchors: 주입을 ${all.length}건밖에 못 읽었다(하한 500) — 목록 경로가 낡았다(통과 아님).`)
  process.exit(1)
}

const cache = new Map()
const read = (rel) => {
  if (!cache.has(rel)) {
    const p = path.join(ROOT, rel)
    cache.set(rel, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null)
  }
  return cache.get(rel)
}

const stale = []
for (const m of all) {
  if (!m.file || typeof m.find !== 'string') continue
  const src = read(m.file)
  if (src === null) { stale.push({ ...m, why: '파일이 없다' }); continue }
  if (!src.includes(m.find)) stale.push({ ...m, why: '`find` 가 소스에 없다' })
}

if (stale.length > 0) {
  console.error(`\n❌ stale-mutation-anchors: ${stale.length}건 — 코드가 옮겨졌는데 주입이 따라가지 않았다.\n`)
  for (const s of stale) {
    console.error(`   • [${s._src}] ${s.name}`)
    console.error(`     ${s.file} — ${s.why}`)
    console.error(`     find: ${JSON.stringify(String(s.find).slice(0, 90))}\n`)
  }
  console.error('   앵커가 없으면 그 주입은 **아무것도 검증하지 않는다**(가드가 지키는 척만 한다).')
  console.error('   조치: 지우지 말고 **불변식으로 재조준**하라 — 지키려던 것은 대개 그대로 살아 있다.\n')
  process.exit(1)
}

console.log(`✅ stale-mutation-anchors: 주입 ${all.length}건 앵커 전부 소스에 실재 (${cache.size}개 파일).`)
