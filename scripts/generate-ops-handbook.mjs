#!/usr/bin/env node
/**
 * generate-ops-handbook.mjs — 운영백서의 **숫자 부분**을 코드에서 생성한다.
 *
 * ## 왜 이게 있나 (2026-08-31 대표 지시 — "구현하는대로 업데이트가 되어야 해")
 *
 * 운영 가이드는 이미 자동 반영 배관을 갖고 있다(시드 → 버전 bump → 배포 후 DB 재시드).
 * 그런데 **내용이 낡는다.** 배관이 아니라 **손으로 쓴 숫자**가 문제였다. 실측:
 *
 *   · 셀러 가이드가 "에이전시 매출의 2% (영구) + 2단계 1% + 3단계 0.5% + 가입보너스 ₩30,000"
 *     이라고 말하고 있었다. 실제 코드 기본값은 1%, 기간은 1년, 그리고 2026-08-31 에 폐지됐다.
 *     ⇒ 매장 사장님이 읽으면 **자기 매출의 3.5%가 영구히 나간다고 믿는다.**
 *   · 라이브커머스가 2026-06 에 영구 중단됐는데 셀러 가이드에 OBS 설정법이 그대로 남아 있었다.
 *
 * 결정적으로 **2026-08-26 에 "폐기 기능 현행화" 작업이 한 번 있었는데도 둘 다 살아남았다.**
 * 사람이 훑어서 고치는 방식은 실패한다 — 이 레포가 이미 두 번 증명했다.
 *
 * ⇒ **수치는 코드에서 뽑고, 절차 산문만 사람이 쓴다.**
 *
 * ## 입력 (SSOT)
 *   - src/shared/constants/policy.ts   — COMMISSION_DEFAULTS (요율·기간)
 *   - src/shared/feature-flags.ts      — 기능 on/off
 *
 * ## 출력
 *   - src/features/guides/api/ops-handbook-auto.ts  (Generated. DO NOT EDIT MANUALLY.)
 *
 * ## 이 생성기가 못 하는 것 — 반드시 알고 읽을 것
 *   코드 상수는 **fallback** 이다. 라이브 값은 `platform_settings` 행이 우선한다
 *   (policy.ts 주석이 직접 경고한다: "이 상수만 바꿔선 안 바뀐다").
 *   ⇒ 표는 **코드 기본값과 어드민 키를 나란히** 찍고, 진짜 값은 어드민에서 보라고 말한다.
 *   그 이상은 배포 산출물이 알 수 없다 — 라이브 DB 를 읽어야 하고, 그건 문서의 일이 아니다.
 *
 * 자동 호출: pre-commit hook · `npm run generate:ops-handbook` · CI 는 `--check`
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src/features/guides/api/ops-handbook-auto.ts')
const CHECK = process.argv.includes('--check')

/** 주석 블록에서 `platform_settings.키` 를 찾는다 — 진짜 값이 사는 곳. */
function findSettingKey(comment) {
  const m = comment.match(/platform_settings\.([a-z0-9_]+)/i)
  return m ? m[1] : null
}

/** JSDoc/줄주석에서 사람이 읽을 한 줄을 뽑는다. */
function firstMeaningfulLine(comment, name) {
  const lines = comment.split('\n')
    .map((raw) => raw.replace(/^\s*(\/\*\*|\*\/|\*|\/\/)\s?/, '').replace(/\*\/\s*$/, '').trim())
    .filter(Boolean)
  // 이 레포 관례: `NAME — 설명`. 있으면 그게 가장 정확하다.
  const named = lines.find((t) => t.startsWith(`${name} —`) || t.startsWith(`${name} -`))
  if (named) return named.slice(name.length).replace(/^\s*[—-]\s*/, '').trim().replace(/`/g, '').slice(0, 120)
  for (const t of lines) {
    if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(t)) continue // 경위·경고 줄은 설명이 아니다
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) continue
    return t.replace(/`/g, '').slice(0, 120)
  }
  return ''
}

/**
 * 주석을 **바로 앞 항목에만** 붙인다.
 *
 * 🩸 첫 판은 정규식 하나로 훑었는데, 값이 객체인 항목(`TIER_COMMISSION_BONUS`)을 건너뛰면서
 *   그 주석이 **다음 항목**(`AFFILIATE_COMMISSION_PCT`)에 붙었다 — 문서가 "제휴 추천인 보상"을
 *   "셀러 등급별 보너스"라고 설명하게 됐다. 문서가 틀린 말을 하는 바로 그 병이라 줄 단위로 걷는다.
 */
function walkEntries(block) {
  const out = []
  let comment = ''
  let inBlock = false
  for (const raw of block.split('\n')) {
    const t = raw.trim()
    if (inBlock) { comment += raw + '\n'; if (t.includes('*/')) inBlock = false; continue }
    if (t.startsWith('/**') || t.startsWith('/*')) {
      comment = raw + '\n'; inBlock = !t.includes('*/'); continue
    }
    if (t.startsWith('//')) { comment += raw + '\n'; continue }
    const m = t.match(/^([A-Z0-9_]+)\s*:\s*(.+)$/)
    if (m) {
      const [, name, rest] = m
      const num = rest.match(/^([0-9._]+)\s*,/)
      // 숫자가 아닌 항목(객체 등)도 **주석을 소비**한다 — 다음 항목에 새면 위 사고가 난다.
      if (num) out.push({ name, value: num[1].replace(/_/g, ''), setting: findSettingKey(comment), desc: firstMeaningfulLine(comment, name) })
      comment = ''
      continue
    }
    if (t && !t.startsWith('}')) comment = ''   // 주석과 항목 사이에 딴 게 끼면 끊는다
  }
  return out
}

// ── ① 요율·기간 (policy.ts COMMISSION_DEFAULTS) ─────────────────
function extractCommissionDefaults() {
  const src = fs.readFileSync(path.join(ROOT, 'src/shared/constants/policy.ts'), 'utf-8')
  const start = src.indexOf('export const COMMISSION_DEFAULTS')
  if (start < 0) throw new Error('COMMISSION_DEFAULTS 를 못 찾았다 — policy.ts 가 바뀌었다(생성기 갱신 필요).')
  const rows = walkEntries(src.slice(start, src.indexOf('} as const', start)))
  if (rows.length === 0) throw new Error('COMMISSION_DEFAULTS 에서 항목을 0개 뽑았다 — 측정 0 = 실패.')
  return rows
}

// ── ② 기능 on/off (feature-flags.ts) ────────────────────────────
function extractFlags() {
  const src = fs.readFileSync(path.join(ROOT, 'src/shared/feature-flags.ts'), 'utf-8')
  const rows = []
  const re = /((?:\/\*\*[\s\S]*?\*\/\s*)?)export const ([A-Z0-9_]+)\s*(?::\s*boolean\s*)?=\s*(true|false)/g
  let m
  while ((m = re.exec(src))) {
    const [, comment, name, val] = m
    rows.push({ name, on: val === 'true', desc: firstMeaningfulLine(comment || '', name) })
  }
  if (rows.length === 0) throw new Error('feature-flags 에서 항목을 0개 뽑았다 — 측정 0 = 실패.')
  return rows
}

/** 플래그 이름이 "숨김/중단/종료"를 뜻하면 true 가 곧 '꺼짐'이다. */
const isNegativeFlag = (n) => /(HIDDEN|SUSPENDED|DISABLED|SUNSET)$/.test(n)

function buildMarkdown() {
  const money = extractCommissionDefaults()
  const flags = extractFlags()

  const moneyRows = money.map((r) => {
    const key = r.setting ? `\`${r.setting}\`` : '—'
    return `| \`${r.name}\` | **${r.value}** | ${key} | ${r.desc || ''} |`
  }).join('\n')

  const off = flags.filter((f) => (isNegativeFlag(f.name) ? f.on : !f.on))
  const on = flags.filter((f) => !off.includes(f))
  const row = (f) => `| \`${f.name}\` | \`${f.on}\` | ${f.desc || ''} |`

  return `## 📐 지금 적용되는 숫자 (자동 생성)

> 🤖 이 절은 \`scripts/generate-ops-handbook.mjs\` 가 **코드에서 뽑아** 매 커밋마다 다시 만듭니다.
> 손으로 고치지 마세요 — 다음 커밋에 덮어써집니다. 값을 바꾸려면 코드나 어드민을 바꾸세요.

### 요율·기간

⚠️ **아래는 코드 기본값(fallback)입니다.** 라이브 값은 \`platform_settings\` 행이 우선합니다 —
그 행이 있으면 코드 상수를 바꿔도 **안 바뀝니다.** 실제 값은 어드민 설정에서 확인하세요.

| 상수 | 코드 기본값 | 어드민 키 (있으면 이쪽이 진짜) | 무엇 |
|---|---|---|---|
${moneyRows}

### 기능 켜짐/꺼짐

🔴 **꺼진 것 (${off.length})** — 코드는 남아 있지만 사용자에게 없습니다. **운영 절차를 쓰기 전에 여기부터 보세요.**

| 플래그 | 값 | 설명 |
|---|---|---|
${off.map(row).join('\n')}

🟢 **켜진 것 (${on.length})**

| 플래그 | 값 | 설명 |
|---|---|---|
${on.map(row).join('\n')}

> ⚠️ **"켜짐"이 "그 경로가 끝까지 돈다"는 뜻은 아닙니다.** 표면 노출만 말합니다.
> 예: 매장 영입 커미션은 켜져 있지만 영입자가 지정된 매장이 0곳이면 한 푼도 안 나갑니다.
`
}

const md = buildMarkdown()
const banner = `/**
 * ⚠️ Generated by scripts/generate-ops-handbook.mjs — DO NOT EDIT MANUALLY.
 *
 * 운영백서의 **숫자 부분**. 손으로 고치면 다음 커밋에 덮어써진다.
 * 값을 바꾸려면 src/shared/constants/policy.ts 또는 src/shared/feature-flags.ts 를 고칠 것
 * (라이브 값은 platform_settings 가 우선 — 그건 어드민에서).
 */
`
const next = `${banner}export const OPS_HANDBOOK_AUTO = ${JSON.stringify(md)}\n`

/**
 * 🔁 두 번째 구멍: 표는 갱신됐는데 **가이드 버전을 안 올리면 라이브 문서가 안 바뀐다.**
 *
 * 재시드 조건이 `코드 버전 > DB 저장 버전` 이라, 버전이 그대로면 에러 없이 아무 일도 안 일어난다.
 * 다른 세션이 요율만 고치고 넘어가면 정확히 그 상태가 된다 — 그래서 여기서 막는다.
 * (base 를 못 구하는 환경(얕은 clone)에서는 검사를 건너뛴다 — 없는 정보로 빨간불을 내지 않는다.)
 */
function seedVersionBumped() {
  const base = process.env.OPS_HANDBOOK_BASE || 'origin/main'
  const git = (args) => execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
  let mergeBase
  try { mergeBase = git(['merge-base', base, 'HEAD']).trim() } catch { return null } // base 없음 → 판정 불가
  const changed = (f) => {
    try { return git(['diff', '--name-only', `${mergeBase}..HEAD`, '--', f]).trim().length > 0 } catch { return false }
  }
  const handbookChanged = changed('src/features/guides/api/ops-handbook-auto.ts')
  if (!handbookChanged) return true
  try {
    const before = git(['show', `${mergeBase}:src/features/guides/api/guide.routes.ts`])
    const after = fs.readFileSync(path.join(ROOT, 'src/features/guides/api/guide.routes.ts'), 'utf-8')
    const ver = (t) => (t.match(/const GUIDE_SEED_VERSION = (\d+)/) || [])[1]
    return Number(ver(after)) > Number(ver(before))
  } catch { return null }
}

if (CHECK) {
  const bumped = seedVersionBumped()
  if (bumped === false) {
    console.error('❌ ops-handbook: 숫자표가 바뀌었는데 GUIDE_SEED_VERSION 을 안 올렸다.')
    console.error('   그러면 배포돼도 **라이브 운영백서는 옛날 숫자 그대로**다(재시드 조건이 거짓이라 조용히 통과).')
    console.error('   고치는 법: src/features/guides/api/guide.routes.ts 의 GUIDE_SEED_VERSION +1.')
    process.exit(1)
  }
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : ''
  if (cur !== next) {
    console.error('❌ ops-handbook: 운영백서 숫자표가 코드와 어긋났다.')
    console.error('   원인: policy.ts 또는 feature-flags.ts 를 고치고 생성기를 안 돌렸다.')
    console.error('   고치는 법: node scripts/generate-ops-handbook.mjs 후 커밋.')
    console.error('   ⚠️ 이게 빨간불인 채로 배포되면 **매장 사장님이 틀린 요율을 읽는다** — 실제로 그랬다.')
    process.exit(1)
  }
  console.log('✅ ops-handbook: 운영백서 숫자표가 코드와 일치.')
  process.exit(0)
}

fs.writeFileSync(OUT, next)
console.log(`✅ ops-handbook: ${path.relative(ROOT, OUT)} 재생성 (요율 ${md.match(/\| `[A-Z0-9_]+` \| \*\*/g)?.length ?? 0}건).`)
