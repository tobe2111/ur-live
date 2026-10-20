#!/usr/bin/env node
/**
 * 🩹 2026-07-21 (대표 "계속 문제 나옴" 전수조사): 소비자 화면에서 딜/상품/이용권/숙소 이미지를
 *   raw `<img src={...image_url...}>` 로 렌더하면 네이버 핫링크(403)·리사이즈미적용으로 깨진다.
 *   반드시 `cfImage()`(핫링크 워커프록시 우회 + 리사이즈) + `cfImageOnError` 를 거쳐야 한다.
 *
 * 이 가드는 **소비자 표면**의 `<img>` 중 커머스 이미지 필드를 raw 로 쓴 것을 경고한다(재발 방지).
 *   - 대상 필드: image_url, product_image, product_thumbnail, thumbnail, goods_image_url, image_url_small, .image
 *   - 제외: cfImage 로 감싼 것, data:/svg, 아바타(profile_image/avatar/seller_avatar), 배너 프리뷰(form.*)
 *   - 어드민/셀러/에이전시/도매(대시보드=내부 사용자)는 제외(소비자 노출 아님).
 * 예외 주석: 해당 라인/블록에 `raw-img-ok` 를 달면 무시.
 *
 * warn-only(exit 0). 차단하려면 STRICT_RAW_IMG=1.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const staged = process.argv.includes('--staged')
let files = []
try {
  if (staged) {
    files = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
      .split('\n').filter((f) => /\.(tsx)$/.test(f))
  } else {
    files = execSync("git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/**/*.tsx'", { encoding: 'utf8' })
      .split('\n').filter(Boolean)
  }
} catch { files = [] }

// 내부(대시보드) 표면 = 소비자 아님 → 제외.
const INTERNAL = /(?:^|\/)(Admin|Seller|Agency|Wholesale|Supplier)[A-Za-z0-9]*\.tsx$|\/(admin|seller-|agency|wholesale|supplier-dashboard|seller-)/i
const FIELD = /(image_url_small|goods_image_url|product_thumbnail|product_image|image_url|thumbnail|\bimage\b)/
const AVATAR = /(profile_image|avatar|banner_url|proof_image|business_registration|form\.|formData\.|preview)/i

const hits = []
for (const f of files) {
  if (!f || INTERNAL.test(f)) continue
  let src = ''
  try { src = readFileSync(f, 'utf8') } catch { continue }
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    // <img ... src={ EXPR } — 여러 줄에 걸칠 수 있어 src={ 를 기준으로 근방 결합
    const m = ln.match(/<img\b|src=\{/)
    if (!m) continue
    // src={ 를 포함한 라인 + 다음 라인 일부를 합쳐 EXPR 확인
    const chunk = (ln + ' ' + (lines[i + 1] || '')).slice(0, 400)
    if (!/src=\{/.test(chunk)) continue
    const srcExpr = chunk.split('src={')[1]?.split(/\}\s|\}\/|\}$|\} /)[0] || ''
    if (!FIELD.test(srcExpr)) continue
    if (/cfImage/.test(srcExpr)) continue          // 이미 cfImage 경유 — OK
    if (/data:|\.svg|https?:\/\//.test(srcExpr)) continue  // 리터럴 URL/데이터
    if (AVATAR.test(srcExpr)) continue             // 아바타/배너프리뷰/증빙 — 커머스 이미지 아님
    if (/raw-img-ok/.test(ln) || /raw-img-ok/.test(lines[i - 1] || '')) continue
    hits.push(`${f}:${i + 1}  src={${srcExpr.trim().slice(0, 60)}}`)
  }
}

if (hits.length === 0) {
  console.log('✅ 소비자 이미지 cfImage 경유 — raw 딜-이미지 렌더 없음.')
  process.exit(0)
}
console.log(`⚠️  소비자 화면 raw <img>(cfImage 미경유) ${hits.length}건 — 네이버 핫링크/리사이즈 미적용으로 깨질 위험:`)
for (const h of hits) console.log('   - ' + h)
console.log('\n고치는 법: src={cfImage(X, { width: W, quality: 82, format: \'auto\' }) || X} + onError={(e) => cfImageOnError(e.currentTarget, X)}')
console.log('의도적 예외: 해당 라인에 `raw-img-ok` 주석.')
if (process.env.STRICT_RAW_IMG === '1') process.exit(1)
process.exit(0)
