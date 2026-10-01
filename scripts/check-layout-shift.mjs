#!/usr/bin/env node
/**
 * 📐 **읽고 있던 줄이 손가락 밑에서 움직이는가** 를 실제 렌더로 잰다 (2026-10-01 신설)
 *
 * ■ 왜 만들었나 — 실제로 막혔던 일
 *   대표가 마이 화면 스크린샷 둘을 보내며 *"지금 2번째 이미지가 로딩에 나오다가 첫번째
 *   이미지로 바뀌더라?"* 라고 신고했다. 늦게 도착한 판매 구역이 손님 메뉴를 통째로
 *   **+404px 아래로** 밀어내고 있었다. 고친 뒤 대표의 다음 말이 이 가드의 이유다:
 *   *"저런 로딩이 발생되는 근본적인 원인을 모두 없애줘. 다른 페이지들도 분명히 있을거고.
 *     의미없는 심각한 문제들이잖아."*
 *
 *   이 클래스는 **에러가 안 난다.** 빌드도 초록이고 테스트도 초록이고 화면도 안 깨진다.
 *   사람이 그 순간을 보고 있어야만 알 수 있어서, 사람에게 맡기면 반드시 다시 생긴다.
 *
 * ■ 무엇을 재나
 *   스텁 응답을 `--slow` 만큼 늦춰 놓고 **두 프레임의 같은 글자**가 어디 있는지 비교한다.
 *   그중 **첫 스냅 시점에 첫 화면(뷰포트) 안에 있던 글자**가 움직였으면 빨간불이다.
 *   화면 밖(푸터 등)만 움직인 것은 🟡 로 세고 막지 않는다 — 둘은 심각도가 전혀 다르고,
 *   같이 막으면 목록 길이를 알 수 없는 화면들 때문에 가드를 꺼 버리게 된다.
 *
 * ■ 측정기를 **두 벌 만들지 않는다**
 *   `scripts/visual-preview.mjs --shift` 를 그대로 자식 프로세스로 부른다. 그 하네스가 이미
 *   SSR 시드·API 스텁·좌석 토큰·테마를 다 갖고 있고, 여기서 다시 구현하면 두 벌이 갈린다.
 *   그 하네스는 `SHIFT_RESULT {json}` 한 줄을 찍고, 이 파일은 그것만 읽는다.
 *
 * ■ 어디서 도는가
 *   `.github/workflows/layout-shift.yml`(브라우저 필요) + 손으로 실행.
 *   **`verify.yml` PR 게이트에는 넣지 않는다** — `render-smoke.yml`·`dark-contrast.yml` 이 정한
 *   같은 판단이다: 브라우저 검사는 느리고 환경에 민감해서, 간헐 실패가 머지를 막으면 결국
 *   가드를 꺼 버린다.
 *
 * ■ 한계 (과신 금지)
 *   - **첫 스냅(750ms)보다 앞은 못 본다.** lazy 청크가 도착하며 생기는 수십~백 ms 구간의
 *     밀림은 여기 안 잡힌다. "0 이니까 첫 프레임부터 안 밀린다" 고 **단정하지 말 것**.
 *   - **경로 목록이 곧 범위다.** 새 소비자 화면을 만들면 여기 한 줄 추가할 것.
 *   - 스텁 데이터는 합성이다 — 실데이터의 긴 이름·많은 행이 만드는 밀림은 여기서 안 보인다.
 *   - 스크롤 0 을 가정한다(하네스는 늘 맨 위에서 잰다).
 *
 * 사용법:  node scripts/check-layout-shift.mjs            # 전체
 *          node scripts/check-layout-shift.mjs --only=마이  # 이름 부분일치
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist/client')
const BASELINE = path.join(ROOT, 'scripts/layout-shift-baseline.json')
const SLOW = 1500
/** 📱 아이폰 13 높이. 뷰포트가 실제보다 크면 '보이는 곳' 이 과대 집계된다. */
const HEIGHT = 844

/**
 * 측정할 소비자 화면. `args` 는 하네스에 그대로 넘어간다(시드 플래그).
 * ⚠️ 시드 플래그가 틀리면 화면이 **빈 껍데기**로 떠서 밀릴 것이 없어 조용히 통과한다 —
 *   그래서 아래 `EMPTY_FLOOR` 로 "둘 다 아무것도 안 떴다" 를 따로 잡는다.
 */
const ROUTES = [
  { name: '홈', args: ['--route=/', '--deals'] },
  { name: '교환권', args: ['--route=/vouchers', '--deals'] },
  { name: '이용권 상세', args: ['--route=/group-buy/9000', '--deals'] },
  { name: '쇼핑', args: ['--route=/browse', '--deals'] },
  { name: '지도', args: ['--route=/map', '--deals'] },
  { name: '숙소', args: ['--route=/stays', '--deals'] },
  { name: '유어샵', args: ['--route=/u/jiwon1228'] },
  { name: '마이(셀러)', args: ['--route=/user/profile', '--stores=1'] },
  { name: '지갑', args: ['--route=/my-vouchers', '--wallet', '--auth=user'] },
  { name: '장바구니', args: ['--route=/cart', '--cart', '--auth=user'] },
  { name: '주문내역', args: ['--route=/my-orders', '--auth=user'] },
  { name: '쿠폰함', args: ['--route=/my-coupons', '--auth=user'] },
  { name: '찜', args: ['--route=/wishlist', '--auth=user'] },
  { name: '딜 내역', args: ['--route=/my-deal-history', '--auth=user'] },
  { name: '단골', args: ['--route=/following', '--auth=user'] },
  { name: '내 리뷰', args: ['--route=/my-reviews', '--auth=user'] },
  { name: '내 교환권', args: ['--route=/my-gifticons', '--auth=user'] },
  { name: '내 숙소 예약', args: ['--route=/my-stays', '--auth=user'] },
  { name: '알림', args: ['--route=/notifications', '--auth=user'] },
]

/** 화면이 통째로 안 떴는지 보는 바닥. 두 스냅 다 글자 변화가 0 이고 문서가 짧으면 의심한다. */
const EMPTY_FLOOR = 400

const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('⏭️  layout-shift: dist/client 이 없다 — **검사하지 않았다**(통과가 아니다).')
  console.log('   실행하려면: npm run build')
  process.exit(0)
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { allow: {} }

/**
 * 하네스 출력에서 기계 줄만 뽑는다.
 * 🔴 **한 줄도 못 찾으면 실패다.** 하네스가 형식을 바꾸거나 크래시했는데 여기서 빈 배열을
 *   "밀림 0" 으로 읽으면, 그 순간부터 이 가드는 **영원히 통과만 한다**(이 레포가 반복해 당한
 *   '헛도는 가드'). 그래서 호출부가 `rows.length === 0` 을 결함으로 센다.
 */
function parse(stdout) {
  const rows = []
  for (const line of stdout.split('\n')) {
    const i = line.indexOf('SHIFT_RESULT ')
    if (i < 0) continue
    try { rows.push(JSON.parse(line.slice(i + 'SHIFT_RESULT '.length))) } catch { /* 깨진 줄 무시 */ }
  }
  return rows
}

const targets = ROUTES.filter((r) => !ONLY || r.name.includes(ONLY))
if (ONLY && targets.length === 0) {
  console.error(`❌ --only="${ONLY}" 에 맞는 경로가 없다 (0건 실행은 통과가 아니다)`)
  process.exit(1)
}

let bad = 0
let warned = 0
const report = []

for (const r of targets) {
  const res = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts/visual-preview.mjs'),
    `--slow=${SLOW}`, '--shift', `--height=${HEIGHT}`,
    `--name=ls-${r.name.replace(/[^a-z0-9가-힣]+/gi, '-')}`,
    ...r.args,
  ], { cwd: ROOT, encoding: 'utf8', timeout: 240000 })

  const rows = parse(res.stdout || '')
  if (rows.length === 0) {
    console.error(`❌ ${r.name}: 측정 줄(SHIFT_RESULT)을 못 읽었다 — 하네스가 죽었거나 형식이 바뀌었다`)
    console.error(`   ${String(res.stderr || '').split('\n').slice(0, 3).join(' / ')}`)
    bad++
    continue
  }

  const allow = baseline.allow?.[r.name] ?? 0
  for (const row of rows) {
    const empty = row.moved === 0 && row.born === 0 && row.gone === 0 && row.docH[1] < EMPTY_FLOOR
    if (empty) {
      console.log(`⚠️  ${r.name} [${row.label}] 화면이 비어 있다(문서 ${row.docH[1]}px) — 시드 플래그를 의심할 것`)
      warned++
      continue
    }
    const mark = row.movedVisible > allow ? '🔴' : row.movedVisible ? '🟠' : row.moved ? '🟡' : '🟢'
    report.push(`${mark} ${r.name} [${row.label}] 보이는 곳 ${row.movedVisible} · 전체 ${row.moved} · 문서 ${row.docH[0]}→${row.docH[1]}px`)
    if (row.movedVisible > allow) {
      bad++
      for (const t of row.top) report.push(`      ↕ ${t}`)
    }
  }
}

console.log(report.join('\n'))
if (warned) console.log(`\n⚠️  빈 화면 ${warned}건 — 그 경로는 **검사된 것이 아니다**`)

if (bad) {
  console.error(`\n❌ layout-shift: 보이는 곳이 밀리는 화면 ${bad}건`)
  console.error('   처방: 늦게 오는 블록이 다른 내용 **위**에 있으면, 기다리는 동안')
  console.error('         **같은 컴포넌트를 숫자만 비워** 그린다(빈 칸·개수 추측 스켈레톤 금지).')
  console.error(`   의도한 것이면 ${path.relative(ROOT, BASELINE)} 의 allow 에 사유와 함께 올린다.`)
  process.exit(1)
}
console.log('\n✅ layout-shift: 보이는 곳 밀림 0')
