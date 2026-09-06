#!/usr/bin/env node
/**
 * 🃏 딜 카드는 **한 벌** — 새로운 자체 카드가 생기는 것을 막는다 (2026-09-03 신설)
 *
 * ■ 왜 만들었나 — 대표: *"이런 이용권들 디자인이 왜 통합적으로 관리가 안되는거지?"*
 *
 *   답: 통일을 **화면 단위로** 해 왔고, 그걸 지키는 검사(`urshop-card-unify.test.ts`)가
 *   **"이미 고친 화면들의 목록"** 이었기 때문이다. 그 목록은 사람이 손으로 적는다. 그래서
 *   아무도 들여다보지 않은 화면은 **영원히 검사에 안 걸린다.**
 *
 *     2026-08-19  홈 섹션 ↔ 홈 피드 통일        ← 대표가 화면 보고 발견
 *     2026-08-27  유어샵 이용권·담은 핀 통일     ← 대표가 화면 보고 발견
 *     2026-09-03  유어샵 내 상품 통일            ← 대표가 화면 보고 발견
 *     2026-09-03  숙소 목록 통일                 ← 대표가 화면 보고 발견
 *
 *   네 번 다 **대표가 눈으로 찾았다.** 검사는 매번 그 뒤를 따라갔을 뿐이다.
 *   이 레포가 반복해 겪은 "검사가 실패할 수 없음" 의 변종이다 — 실패는 할 수 있는데
 *   **볼 수 없는 곳**이 있었다.
 *
 * ■ 그래서 뒤집는다
 *   목록을 나열하지 않고 **소비자 표면 전체를 훑어**, "사진 + 가격 + 이동" 을 자기 마크업으로
 *   그리는 반복 블록(`.map`)을 찾는다. 공유 카드를 안 쓰면 신고한다.
 *   ⇒ 새 화면이 자체 카드를 만들면 **그날 CI 가 잡는다**(대표가 발견할 때까지 기다리지 않는다).
 *
 * ■ 이 가드가 **못** 하는 것
 *   - 카드가 *예쁜지*. 이건 "한 벌인가"만 본다.
 *   - 상세 페이지의 히어로처럼 카드가 아닌 단일 표시(그래서 allowlist 가 있다).
 *   - 공유 카드를 쓰면서 그 위에 다른 껍데기를 덧씌우는 경우(마크업이 아니라 취향의 영역).
 *
 * 래칫: `scripts/deal-card-baseline.json`. 줄이면 `--rebaseline`.
 * 예외: 파일 상단에 `deal-card-ok` 주석(사유를 함께 적을 것).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASELINE = path.join(ROOT, 'scripts/deal-card-baseline.json')
const STRICT = process.env.STRICT_DEAL_CARD === '1' || process.argv.includes('-s')

/**
 * 공유 카드 — 이 중 하나를 렌더하면 통일된 것으로 본다.
 *
 * 🎫 형태는 **셋뿐**이다(2026-09-03 — 대표 "왜 통합 관리가 안 되는거지" 후속):
 *   · 격자 `GroupBuyFeedCard`  — 홈·검색·유어샵·상권·숙소 목록
 *   · 미니 `DealMiniCard`      — 홈 우리 동네딜, 최근 본 상품 같은 작은 정사각
 *   · 줄   `DealRow`           — /vouchers 모바일 목록, 사용 완료 추천, 체험단
 * `BrowseProductCard`·`VoucherRow` 는 **격자/줄 SSOT 에 얹은 얇은 어댑터**라 여기 남는다
 * (호출부 props 를 안 바꾸려고 이름만 유지한 것 — 자체 마크업이 아니다).
 * 새 형태를 넷째로 추가하지 말 것. 필요하면 위 셋 중 하나에 prop 을 더한다.
 */
const SHARED = ['GroupBuyFeedCard', 'BrowseProductCard', 'VoucherCard', 'VoucherRow', 'GroupBuyGridCard', 'DealCardMedia', 'DealMiniCard', 'DealRow']

/** 대시보드·도매는 이 체계의 대상이 아니다(CLAUDE.md — 표면 규칙은 소비자 표면 기준). */
const SKIP_PATH = /(^|\/)(admin|seller|agency|wholesale|supplier)|Admin|Seller|Agency|Wholesale|Supplier|\/tests\//

/**
 * 카드가 아닌 것으로 확정된 자리. **사유 없이 추가 금지** — 이 목록이 늘어나면
 * 가드가 다시 "손으로 적은 목록" 으로 퇴화한다.
 */
const ALLOW = {
  'src/pages/GroupBuyDetailPage.tsx': '상세 히어로 + 함께 보면 좋은 딜(별도 시안)',
  'src/pages/ProductDetailPage.tsx': '상세 히어로',
  'src/pages/StayDetailPage.tsx': '상세 히어로 + 객실 목록(객실은 딜이 아니다)',
  'src/pages/VoucherDetailPage.tsx': '상세 히어로',
  'src/pages/IntroducePage.tsx': '랜딩 장식 — 실제 딜이 아니라 예시 그림',
  'src/pages/seller-orders/OrderDetailModal.tsx': '주문 상세의 품목 줄 — 카드가 아니다',
  'src/pages/my-orders/OrderDetailModal.tsx': '주문 상세의 품목 줄 — 카드가 아니다',
  'src/pages/checkout/StayCheckout.tsx': '결제 요약 줄 — 카드가 아니다',
  'src/pages/CuratorEarningsPage.tsx': '적립 내역 목록 — 딜 카드가 아니다',
  // 목록이 아니라 **초대받은 그 공구 하나**의 요약 + 참여 흐름이다(결제 요약과 같은 부류).
  'src/pages/ReferralPage.tsx': '초대 링크의 단일 공구 요약 — 카드 목록이 아니다',
  // 🧱 서비스 분리(CLAUDE.md): 운영자 몰은 **공구 서비스**다. 유어딜 카드 체계를 몰에 강제하지 않는다.
  'src/pages/MallHomePage.tsx': '공구 서비스(운영자 몰) — 유어딜과 별개 서비스',
  'src/pages/MallProductPage.tsx': '공구 서비스(운영자 몰) — 유어딜과 별개 서비스',
}

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git|dist/.test(p)) walk(p, out) }
    else if (/\.tsx$/.test(e.name)) out.push(p)
  }
  return out
}

const files = [...walk(path.join(ROOT, 'src/pages')), ...walk(path.join(ROOT, 'src/components'))]
// ⚠️ 대상이 0이면 통과가 아니라 실패다 — 경로가 낡아 조용히 비는 것을 막는다.
if (files.length < 200) {
  console.error(`❌ deal-card: .tsx 를 ${files.length}개밖에 못 찾았다 — 스캔 경로가 낡았다(검사가 무의미해진다).`)
  process.exit(1)
}

const found = []
for (const f of files) {
  const rel = path.relative(ROOT, f).replaceAll('\\', '/')
  if (SKIP_PATH.test(rel) || ALLOW[rel]) continue
  const src = fs.readFileSync(f, 'utf-8')
  if (src.includes('deal-card-ok')) continue
  if (SHARED.some((c) => src.includes(`<${c}`))) continue

  /**
   * 파일 단위로 "사진 + 가격 + 이동 + 반복" 네 가지가 모두 있는지 본다.
   *
   * ⚠️ 두 번 좁게 짰다가 두 번 다 놓쳤다.
   *   ① `.map(...)` 블록 전체를 정규식으로 닫으려 함 → JSX 중첩·조건부 때문에 4곳을 통째로 놓침.
   *   ② `.map(` 뒤 창만 봄 → **카드를 그 파일의 지역 컴포넌트로 뺀 경우**(동네 페이지·핫딜
   *      캐러셀·인플루언서 목록)를 놓침. `.map` 안에는 `<DealCard>` 만 있고 사진·가격은 아래
   *      정의부에 있다.
   *   ⇒ 파일이 **자체 카드를 정의하고 반복 렌더**하면 걸리게 한다. 오탐은 사유와 함께
   *     allowlist 로 흡수한다 — 놓치는 것이 훨씬 나쁘다(그게 이 가드를 만든 이유다).
   */
  const hasImg = /image_url|cfImage\(/.test(src)
  const hasPrice = /formatNumber\([^)]*[Pp]rice|formatPrice\(|price_from|current_price|원<\/|원`/.test(src)
  const goes = /<Link\b|navigate\(/.test(src)
  const repeats = /\.map\(/.test(src)
  if (hasImg && hasPrice && goes && repeats) {
    found.push(rel)
  }
}

const prev = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf-8')) : { entries: [] }
if (process.argv.includes('--rebaseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    _: '자체 딜 카드가 남아 있는 자리. 0 이 목표다 — 늘리지 말 것.',
    entries: [...found].sort(),
  }, null, 2) + '\n')
  console.log(`✅ deal-card: baseline 재설정 — ${found.length}건`)
  process.exit(0)
}

const known = new Set(prev.entries || [])
const fresh = found.filter((x) => !known.has(x))

if (fresh.length) {
  console.error(`\n❌ deal-card: **새 자체 카드** ${fresh.length}건 — 딜 카드는 한 벌이어야 한다.\n`)
  for (const x of fresh) console.error(`   • ${x}`)
  console.error(`
   고치는 법: 그 그리드를 \`<GroupBuyFeedCard p={...} to={...} flags={...} />\` 로 교체.
     · 화면 전용 한 줄(숙소타입·가격 인하 등)은 \`flags\` 슬롯에.
     · 목적지가 특수하면(핀 귀속 \`/u/:handle/p/:id\`, 숙소 날짜 파라미터) \`to\` 로 넘길 것 —
       빠뜨리면 화면은 같은데 **소개비 귀속이나 요금이 조용히 달라진다.**
   카드가 아닌 자리면 ALLOW 에 **사유와 함께** 등록하거나 \`deal-card-ok\` 주석.
`)
  process.exit(STRICT ? 1 : 0)
}

const left = found.length
console.log(`✅ deal-card: 새 자체 카드 0건 (남은 미통일 ${left}건 — baseline)${left ? ' · 줄이면 --rebaseline' : ''}`)
