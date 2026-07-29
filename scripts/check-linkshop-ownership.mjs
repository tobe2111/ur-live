#!/usr/bin/env node
/**
 * 🛡️ 영구 방어선 — "내 링크샵인데 방문자로 보임 / 편집 기능이 사라짐" 회귀 방지.
 *
 * 배경(2026-07-07 대표 신고, 이 클래스는 링크샵에서 반복 재발): `/u/{handle}` 링크샵은 두 페이지
 *   컴포넌트가 렌더한다 — 일반 유저는 CuratorPage, linked-seller(사업자)는 CuratorPage 가 인라인으로
 *   SellerPublicPage 를 렌더. 그런데 "소유자 판정"이 서로 다른 신호로 갈려 있었다:
 *     - CuratorPage.isOwner = 소비자 정체성(useAuthStore.user.id / localStorage user_id === curator.id) — 토큰 불필요.
 *     - SellerPublicPage.isOwner = 별도 seller_token(+seller_id/username 매칭) 요구.
 *   CuratorPage 가 자신이 아는 소유권을 자식에게 안 내려줘서, 카카오(소비자)로만 로그인해 seller_token 이
 *   없는 링크샵 주인이 **자기 가게를 방문자로** 봤다(편집 모드·프로필 편집 전부 사라짐).
 *
 * 근본 불변식: **`/u/{handle}` 링크샵의 주인 = 로그인한 소비자 유저(단일 신호).** seller_token 은
 *   셀러 대시보드(/seller/*) 접근용일 뿐, 링크샵 *뷰/편집* 을 가르지 않는다. 프로필/소개/SNS/배너/주소/핀
 *   편집은 전부 소비자 API(/api/curator/me/*)로 처리된다.
 *
 * 이 가드가 강제하는 3 불변식(하나라도 깨지면 그 방문자-오표시 클래스가 재발):
 *   1. CuratorPage 가 SellerPublicPage 에 소유권 신호(ownerOverride)를 내려준다.
 *   2. SellerPublicPage.isOwner 가 그 ownerOverride 를 포함한다(seller_token 단독 게이트 금지).
 *   3. 순수 뷰 자식(CuratorHeader/InfoTab/VouchersTab/VideosTab)은 소유/편집 판정을 prop 으로 받고,
 *      localStorage 의 seller_token/seller_id 를 직접 읽어 게이트하지 않는다.
 *
 * 기본 warn-only(exit 0). 차단: STRICT_LINKSHOP_OWNERSHIP=1 또는 `-s`.
 * 의도적 예외: 대상 파일에 `linkshop-ownership-ok` 주석.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const STRICT = process.env.STRICT_LINKSHOP_OWNERSHIP === '1' || process.argv.includes('-s')

const read = (rel) => {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** @type {{file:string,name:string,must?:RegExp[],mustNot?:RegExp[],hint:string}[]} */
const CHECKS = [
  {
    file: 'src/pages/CuratorPage.tsx',
    name: '① CuratorPage → SellerPublicPage 소유권 신호 전달',
    must: [
      // linked-seller 인라인 렌더에 ownerOverride 를 반드시 내려줌 (소비자 정체성 = 링크샵 주인)
      /<SellerPublicPage[^>]*ownerOverride=\{/s,
    ],
    hint: 'CuratorPage 의 <SellerPublicPage …> 에 ownerOverride={isOwner} 를 전달하세요 — 링크샵 주인은 로그인 유저입니다.',
  },
  {
    file: 'src/pages/SellerPublicPage.tsx',
    name: '② SellerPublicPage.isOwner 가 ownerOverride 포함(seller_token 단독 금지)',
    must: [
      /ownerOverride\?:\s*boolean/,             // prop 존재
      /const\s+isOwner\s*=\s*[^\n]*ownerOverride/, // isOwner 계산에 ownerOverride 포함
    ],
    mustNot: [
      // isOwner 를 seller_token 단독으로 되돌리는 회귀(원래 버그 형태)
      /const\s+isOwner\s*=\s*!!\s*sellerToken\s*&&/,
    ],
    hint: 'isOwner = !!ownerOverride || tokenOwner 형태를 유지하세요. seller_token 단독으로 링크샵 소유권을 판정하지 마세요(대시보드 전용).',
  },
  {
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    name: '③ 순수 뷰 자식은 seller_token/seller_id 직접 읽지 않음 (prop 구동)',
    mustNot: [
      /getItem\(\s*['"]seller_token['"]\s*\)/,
      /getItem\(\s*['"]seller_id['"]\s*\)/,
    ],
    hint: '헤더는 isOwner prop 으로만 편집 어포던스를 게이트하세요 — localStorage seller_token 을 읽으면 소유권이 다시 갈립니다.',
  },
  {
    file: 'src/pages/seller-public/InfoTab.tsx',
    name: '③ InfoTab 은 seller_token/seller_id 직접 읽지 않음 (prop 구동)',
    mustNot: [
      /getItem\(\s*['"]seller_token['"]\s*\)/,
      /getItem\(\s*['"]seller_id['"]\s*\)/,
    ],
    hint: '카카오 편집은 canSellerEdit prop 으로 게이트하세요 — 토큰을 직접 읽지 마세요.',
  },
  {
    file: 'src/pages/seller-public/VouchersTab.tsx',
    name: '③ VouchersTab 은 seller_token/seller_id 직접 읽지 않음 (prop 구동)',
    mustNot: [
      /getItem\(\s*['"]seller_token['"]\s*\)/,
      /getItem\(\s*['"]seller_id['"]\s*\)/,
    ],
    hint: 'isOwner prop 으로만 게이트하세요.',
  },
  {
    file: 'src/pages/seller-public/VideosTab.tsx',
    name: '③ VideosTab 은 seller_token/seller_id 직접 읽지 않음 (prop 구동)',
    mustNot: [
      /getItem\(\s*['"]seller_token['"]\s*\)/,
      /getItem\(\s*['"]seller_id['"]\s*\)/,
    ],
    hint: 'isOwner prop 으로만 게이트하세요.',
  },
]

let failures = 0
for (const c of CHECKS) {
  const src = read(c.file)
  if (src == null) {
    // 파일이 없으면(리팩토링으로 이동/삭제) skip — 존재하는 파일만 검사.
    continue
  }
  if (/linkshop-ownership-ok/.test(src)) continue // 의도적 예외
  const missing = (c.must || []).filter((re) => !re.test(src))
  const forbidden = (c.mustNot || []).filter((re) => re.test(src))
  if (missing.length || forbidden.length) {
    failures++
    console.error(`❌ [linkshop-ownership] ${c.name} (${c.file})`)
    for (const re of missing) console.error(`   누락: ${re}`)
    for (const re of forbidden) console.error(`   금지 패턴(seller_token 직접 게이트): ${re}`)
    console.error(`   → ${c.hint}`)
  }
}

if (failures) {
  console.error(`\n링크샵 소유권 불변식 ${failures}건 위반 — "내 링크샵인데 방문자로 보임/편집 사라짐" 재발 위험 (2026-07-07 대표 신고 클래스).`)
  console.error(`불변식: /u/{handle} 링크샵 주인 = 로그인 소비자 유저(단일 신호). seller_token 은 대시보드 전용.`)
  process.exit(STRICT ? 1 : 0)
}
console.log('✅ linkshop-ownership: 소유권 단일화 3불변식(신호전달·isOwner포함·뷰자식 prop구동) 모두 유지.')
