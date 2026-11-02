#!/usr/bin/env node
/**
 * 📦 **손님 화면이 자기가 안 쓰는 코드를 받는가** 를 실제 렌더로 판정한다 (2026-10-13 신설)
 *
 * ■ 왜 만들었나 — 실제로 막혔던 일
 *   대표: *"유어샵이 왜 이렇게 늦게 뜨지? 전체적으로 아직 대기업 수준 아니야."* → *"계속 해 영구적으로 문제들 해결해줘"*
 *   느린 4G 재생으로 유어샵을 재 보니, 유어샵이 쓰지도 않는 코드를 넷이나 받고 있었다:
 *   | 무엇 | 크기(br) | 왜 |
 *   |---|---|---|
 *   | 이용권 상세 화면 코드 | 18KB | 엔트리가 나중에 부르는 웹 바이탈 보고가 상세 전용 봉투에 섞였다 |
 *   | qrcode | 17KB | PC 전용 QR 카드가 `hidden lg:flex` 라 폰에서도 마운트됐다 |
 *   | capacitor(앱 SDK) | 5KB | 상태바 effect 가 웹에서도 `import('./lib/native')` 를 불렀다 |
 *   넷 다 **에러가 안 난다.** 빌드·시험 초록, 화면도 멀쩡하다 — 느릴 뿐이라 재 본 사람만 안다.
 *
 * ■ 무엇을 재나 (규칙 셋)
 *   ① **남의 표면 봉투 금지** — `lz-<표면들>` 청크는 그 이름에 이 화면의 표면(또는 `common`·`boot`)이
 *      있어야 받을 수 있다. 묶음기(`scripts/surface-chunks.mjs`)가 이름에 "누가 쓰는가" 를 적어 두므로
 *      이름만 보고 판정된다. 상세 봉투(`lz-gbDetail`)가 유어샵에 오면 빨간불이다.
 *   ② **폰 첫 화면 금지 목록** — `codes`(QR·바코드) · `capacitor`(앱 SDK) · 대시보드 봉투
 *      (`app-seller-*`·`app-admin-*`·`app-wholesale-*`·`app-marketing`).
 *   ③ **개수 래칫** — 화면별 받은 청크 수가 기준(`surface-chunk-runtime-baseline.json`)보다 늘면 빨간불.
 *      줄이는 건 자유(`--rebaseline`).
 *
 * ■ 측정기를 두 벌 만들지 않는다 — `visual-preview.mjs --trace-api` 의 `FETCH_RESULT` 한 줄(chunks)만 읽는다.
 *
 * ■ 한계 (과신 금지)
 *   - 폭 430(폰) 첫 화면만 본다. 스크롤·시트·탭 뒤의 지연 로딩은 범위 밖(그건 원래 늦게 받아도 된다).
 *   - 워커가 넣는 modulepreload 는 이 하네스에 없다 — 여기선 "런타임에 실제로 요청한 것" 만 본다.
 *   - 경로 목록이 곧 범위다. 새 손님 화면을 만들면 여기 한 줄 추가할 것.
 *
 * 사용법:  node scripts/check-surface-chunk-runtime.mjs [--only=유어샵] [--rebaseline]
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ROUTES as SURFACES } from './generate-route-chunk-map.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist/client')
const BASELINE = path.join(ROOT, 'scripts/surface-chunk-runtime-baseline.json')

/** name · 하네스 인자 · 이 화면의 표면 키(generate-route-chunk-map ROUTES) */
export const PAGES = [
  { name: '홈', args: ['--route=/', '--deals'], surface: 'home' },
  { name: '교환권', args: ['--route=/vouchers', '--deals'], surface: 'vouchers' },
  { name: '이용권 상세', args: ['--route=/group-buy/9000', '--deals'], surface: 'gbDetail' },
  { name: '쇼핑', args: ['--route=/browse', '--deals'], surface: 'browse' },
  { name: '지도', args: ['--route=/map', '--deals'], surface: 'map' },
  { name: '유어샵', args: ['--route=/u/jiwon1228'], surface: 'linkshop' },
]

/**
 * 🤝 의도된 미리받기 — 카드가 화면에 들어오면 **상세 화면 코드**를 미리 받는다(잠금표 `GroupBuyFeedCard` 의
 *   viewport prefetch — 누르는 순간 0ms 가 목적). 그 화면에 한해 상세 봉투를 허용한다.
 *   ⚠️ 여기에 표면을 더하는 것은 "그 화면이 그 코드를 받아도 된다" 는 결정이다 — 이유를 함께 적을 것.
 */
export const PREFETCH_OK = {
  // home: 2026-10-13 카드 미리받기가 load 뒤로 옮겨져 첫 화면에서 상세 봉투를 받지 않는다(대표 승인)
  // browse: 같은 카드 컴포넌트라 함께 해소(2026-10-13)
}

export const FORBIDDEN = [/^codes$/, /^capacitor$/, /^app-desktop-chrome$/, /^app-seller-/, /^app-admin-/, /^app-wholesale-/, /^app-marketing$/]

/** 하네스가 찍은 이름(해시는 이미 뗐다) → `.js` 만 뗀다.
 *  ⚠️ 여기서 해시를 **다시** 떼지 말 것 — `lz-boot-gbDetail` 의 `gbDetail` 이 정확히 8글자라 해시로 오인돼 잘린다. */
export const stem = (f) => f.replace(/\.js$/, '')

/** 표면 키 → 그 표면이 청크 이름에 남기는 라벨들(파일이 여럿이면 `linkshop1`·`linkshop2`). */
export function labelsOf(surface, surfaces = SURFACES) {
  const files = surfaces[surface] ?? []
  return files.length > 1 ? files.map((_, i) => `${surface}${i + 1}`) : [surface]
}

/**
 * `lz-a-b` 이름의 라벨들 — 라벨 자체엔 '-' 가 없다(표면 키는 camelCase).
 * ⚠️ 해시를 이미 뗀 이름을 받는다.
 */
export const lzLabels = (s) => s.slice(3).split('-').filter(Boolean)

/** 판정(순수 함수) — 위반 문자열 배열. */
/**
 * 🎲 **표본으로 불려 오는 청크는 세지 않는다** — 2026-11-01.
 *
 * `src/main.tsx:170` 의 `envSampled = DEV || Math.random() < 0.01` — 환경변수 검사기(zod)를 운영에서
 * **방문 100번 중 1번만** 불러온다(그 파일 주석: 검사 대상이 빌드 때 정해지는 값이라 1% 면 충분). 측정이
 * 그 1% 에 걸리면 `env-validator` + `validation` 둘이 더 실려 **청크 수 래칫이 무작위로 빨간불**이 된다.
 * 실측: PR #2080 CI 에서 교환권 26개 > 기준 25개 — 같은 기계에서 main·그 PR 을 각각 재면 둘 다 24개였다.
 *
 * 🔑 `validation` 은 **`env-validator` 와 함께 왔을 때만** 뺀다 — zod 가 **혼자** 첫 화면에 실리면 그건
 *    진짜 회귀(잠금표: "validateEnvForRuntime dynamic import — eager 금지")라 그대로 센다.
 *    `src/main.tsx` 는 로딩 잠금 파일이라 표본 쪽을 고치지 않고 측정 쪽에서 다룬다.
 */
export function dropSampled(chunks) {
  const list = [...chunks]
  if (!list.includes('env-validator')) return list
  return list.filter((c) => c !== 'env-validator' && c !== 'validation')
}

export function judge(chunks, surface, surfaces = SURFACES) {
  // `<표면>L` = 그 페이지가 나중에(lazy) 쓰는 부품 봉투 — 자기 것이다(scripts/surface-chunks.mjs).
  const mine = new Set([...labelsOf(surface, surfaces).flatMap((l) => [l, l + 'L']), ...(PREFETCH_OK[surface] ?? []), 'common', 'boot'])
  const out = []
  for (const c of new Set(chunks.map(stem))) {
    if (FORBIDDEN.some((re) => re.test(c))) out.push(`${c} — 폰 첫 화면 금지 목록`)
    else if (c.startsWith('lz-') && !lzLabels(c).some((l) => mine.has(l))) out.push(`${c} — 다른 화면 전용 봉투`)
  }
  return out
}

function parse(stdout) {
  for (const line of String(stdout).split('\n')) {
    const i = line.indexOf('FETCH_RESULT ')
    if (i >= 0) { try { return JSON.parse(line.slice(i + 'FETCH_RESULT '.length)) } catch { return null } }
  }
  return null
}

function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.log('⏭️  surface-chunk-runtime: dist/client 이 없다 — **검사하지 않았다**(통과가 아니다). npm run build 후 다시.')
    process.exit(0)
  }
  const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)
  const REBASE = process.argv.includes('--rebaseline')
  const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { counts: {} }
  const next = { _note: '화면별 첫 화면(폰 430) 런타임 청크 수 상한 — 줄이면 --rebaseline', counts: { ...base.counts } }
  let bad = 0
  let measured = 0
  for (const pg of PAGES) {
    if (ONLY && !pg.name.includes(ONLY)) continue
    const r = spawnSync('node', ['scripts/visual-preview.mjs', ...pg.args, '--trace-api', '--no-idle'], { cwd: ROOT, encoding: 'utf8', timeout: 180_000 })
    const res = parse(r.stdout)
    if (!res || !Array.isArray(res.chunks)) { console.error(`❌ ${pg.name}: 측정 결과를 못 읽었다(하네스 형식 변경·실패) — 통과가 아니다.`); bad++; continue }
    const chunks = dropSampled([...new Set(res.chunks.map(stem))])
    if (chunks.length < 10) { console.error(`❌ ${pg.name}: 청크 ${chunks.length}개 — 렌더가 깨졌거나 측정이 헛돌았다.`); bad++; continue }
    measured++
    const v = judge(res.chunks, pg.surface)
    const cap = base.counts[pg.name]
    if (cap != null && chunks.length > cap && !REBASE) v.push(`청크 ${chunks.length}개 > 기준 ${cap}개(늘었다)`)
    next.counts[pg.name] = REBASE ? chunks.length : (cap ?? chunks.length)
    if (v.length) {
      bad++
      console.error(`❌ ${pg.name} (${chunks.length}개)`)
      for (const x of v) console.error(`     · ${x}`)
      // 🩸 **실패하면 청크 이름을 전부 찍는다** (2026-10-25). 이걸 안 찍어서 CI 실패 한 건을
      //   규명조차 못 했다: 개수 래칫이 "34 > 32" 라고만 말하고 **무엇이 둘 늘었는지**는
      //   하네스 stdout(`FETCH_RESULT`)에만 있었는데 이 검사기가 그걸 삼켰다. 로컬에서 32 가
      //   나오면 비교할 대상이 없어 "간헐" 과 "실재" 를 가를 수 없다.
      //   ⚠️ 성공할 때는 안 찍는다 — 초록 로그를 청크 목록으로 덮으면 다음 사람이 안 읽는다.
      console.error(`     · 받은 청크 ${chunks.length}개: ${[...chunks].sort().join(' ')}`)
    }
    else console.log(`✅ ${pg.name}: ${chunks.length}개 — 남의 봉투·금지 청크 0`)
  }
  if (measured === 0 && !bad) { console.error('❌ surface-chunk-runtime: 측정한 화면이 0개 — 통과가 아니다.'); process.exit(1) }
  if (REBASE || !fs.existsSync(BASELINE)) fs.writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n')
  if (bad) { console.error(`\n❌ surface-chunk-runtime: ${bad}개 화면 위반 — 그 화면이 안 쓰는 코드를 받는다.`); process.exit(1) }
  console.log(`\n✅ surface-chunk-runtime: ${measured}개 화면 통과.`)
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main()
