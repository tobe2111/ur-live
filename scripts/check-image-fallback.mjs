#!/usr/bin/env node
/**
 * 🖼️ 이미지 폴백 래칫 (2026-08-31 — 대표 "유어샵 나머지")
 *
 * ■ 무엇을 막나
 *   `cfImage()` 로 감싼 <img> 에 `onError` 가 없으면, 리사이저나 원본이 죽는 순간
 *   **깨진 이미지 아이콘**이 그대로 사용자에게 보인다. SSOT `cfImageOnError` 는
 *   [원본 1회 재시도 → 그래도 죽으면 숨김(부모 배경 노출)] 로 처리한다.
 *   실측(2026-08-31 배선 전): cfImage 를 쓰는 <img> 92개 중 **47개가 무방비**였다.
 *   절반이 빠진 건 취향이 아니라 배선 누락이고, 배선은 계속 새로 빠진다 → 래칫.
 *
 * ■ 래칫
 *   무방비 <img> 수를 baseline 으로 동결. **줄이는 건 OK, 늘리는 건 차단.**
 *   2026-08-31 2차(대표 "다음 꺼 모두 순차적으로"): 도매·어드민·몰 18곳까지 배선해 **baseline 0**.
 *   즉 지금부터 무방비 cfImage <img> 는 **한 개도 못 들어온다.**
 *   ⚠️ 0 을 기대하는 검사는 매칭이 죽어도 0 이라 초록불이므로 **합성 대조**(아래)가 함께 있어야 한다.
 *
 * ⚠️ 이 검사가 **못 잡는 것**
 *   · `<img>` 를 안 쓰는 CSS background-image — onError 자체가 없는 방식이다.
 *   · onError 는 있으나 아무것도 안 하는 빈 핸들러.
 *   · cfImage 를 안 거치는 raw <img> — 그건 cf-image 규칙(별건)이 볼 일이다.
 *
 * 예외: 그 태그 안에 `image-fallback-ok` 주석.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const BASELINE_FILE = 'scripts/image-fallback-baseline.json'
const REBASE = process.argv.includes('--rebaseline')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

const files = execSync("git ls-files 'src/**/*.tsx'", { encoding: 'utf-8' }).trim().split('\n').filter(Boolean)

/** 한 파일에서 [cfImage <img> 총수, 무방비 줄번호 목록] 을 낸다. */
function scanImgTags(src) {
  let total = 0
  const bad = []
  for (const m of src.matchAll(/<img\b[\s\S]*?\/>/g)) {
    const tag = m[0]
    if (!/cfImage\(|cfSrcSet\(/.test(tag)) continue
    total++
    if (/onError/.test(tag) || /image-fallback-ok/.test(tag)) continue
    bad.push(src.slice(0, m.index).split('\n').length)
  }
  return [total, bad]
}

/**
 * 🧪 **합성 대조 — baseline 0 검사의 목숨.**
 *   0 을 기대하는 래칫은 **매칭이 죽어도 0 이라 초록불**이다(이 레포가 반복해 당한
 *   "검사가 실패할 수 없음" 클래스). 매 실행마다 일부러 위반인 조각과 정상 조각을
 *   같은 판정에 통과시켜, 잡아야 할 걸 잡고 잡지 말아야 할 걸 안 잡는지 확인한다.
 */
const FIXTURE_BAD = `<img src={cfImage(p.image_url, { width: 640 }) || p.image_url} alt="" className="w-full" />`
const FIXTURE_OK = `
  <img src={cfImage(a, { width: 64 }) || a} alt="" onError={(e) => cfImageOnError(e.currentTarget, a)} />
  <img src={plainUrl} alt="" />
`
{
  const [t1, b1] = scanImgTags(FIXTURE_BAD)
  if (t1 !== 1 || b1.length !== 1) {
    console.error('❌ image-fallback: 양성 대조 실패 — 명백히 무방비인 <img> 를 못 찾는다(매칭이 죽었다).')
    process.exit(1)
  }
  const [t2, b2] = scanImgTags(FIXTURE_OK)
  if (t2 !== 1 || b2.length !== 0) {
    console.error('❌ image-fallback: 음성 대조 실패 — 이미 배선된 <img>(또는 cfImage 밖 <img>)를 위반으로 센다(오탐).')
    process.exit(1)
  }
}

let total = 0
const hits = []
for (const f of files) {
  const src = readFileSync(f, 'utf-8')
  const [t, bad] = scanImgTags(src)
  total += t
  for (const line of bad) hits.push(`${f}:${line}`)
}

// ⚠️ 측정 대상 0건은 통과가 아니라 실패다 — 정규식이 낡아 조용히 비면 이 검사는 무의미해진다.
//    (이 레포가 반복해 당한 "검사가 실패할 수 없음" 클래스 — check-bundle-size 의 죽은 gzip 값과 같다.)
if (total < 40) {
  console.error(`❌ image-fallback: cfImage <img> 를 ${total}개밖에 못 찾았다 — 매칭이 낡았다(검사가 무의미해진다).`)
  process.exit(1)
}

if (REBASE) {
  writeFileSync(BASELINE_FILE, JSON.stringify({ count: hits.length, updated: new Date().toISOString().slice(0, 10) }, null, 2) + '\n')
  console.log(`✅ image-fallback: baseline ${hits.length} 로 갱신.`)
  process.exit(0)
}

const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf-8')).count : 0
if (hits.length > baseline) {
  console.error(`⚠️  이미지 폴백 래칫 — onError 없는 cfImage <img> 가 늘었다 (${baseline} → ${hits.length})`)
  hits.slice(0, 12).forEach((h) => console.error(`   - ${h}`))
  console.error("\n   고치는 법: onError={(e) => cfImageOnError(e.currentTarget, 원본URL)}  (@/utils/cf-image)")
  console.error('   일괄: node scripts/codemods/adopt-image-fallback.mjs')
  console.error('   줄였으면 → node scripts/check-image-fallback.mjs --rebaseline')
  // `-s` 는 check-guard-mutations 하네스의 호출 규약(runTest)이다 — 이걸 안 받으면
  //    주입해도 exit 0 이라 '가드가 안 잡았다' 로 오판된다.
  if (process.env.STRICT_IMAGE_FALLBACK === '1' || STRICT) { console.error('\n❌ STRICT_IMAGE_FALLBACK — 차단.'); process.exit(1) }
  process.exit(0)
}
console.log(`✅ image-fallback: 무방비 <img> ${hits.length}개 (≤${baseline}) · cfImage <img> ${total}개 검사.`)
