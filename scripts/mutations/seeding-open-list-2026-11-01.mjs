/**
 * 🧬 주입 — 체험 목록(모집 깔때기의 착지) (2026-11-01).
 * 가드: src/tests/unit/seeding-open-list-2026-11-01.test.ts
 *
 * 🔴 절반이 **반대 방향**이다 — 목록은 "전부 거른다"(= 늘 빈 화면)도 에러 없이 통과하므로,
 *    거르는 쪽만 잠그면 가드가 헛돈다.
 */
const T = 'src/tests/unit/seeding-open-list-2026-11-01.test.ts'
const DB = 'src/features/seeding/api/seeding-db.ts'
export default [
  {
    name: '체험목록 — 자리가 다 찬 것도 보인다',
    file: DB,
    find: '    if (!(left > 0)) return []',
    replace: '    if (false) return []',
    test: T,
    why: '자리 0 인 체험을 보여 주면 신청을 눌렀을 때 거절된다 — 안 보이는 쪽이 낫다.',
  },
  {
    name: '체험목록 — 도매 원본이 소비자 목록에 샌다',
    file: DB,
    find: "        AND ${consumerVisibleProductSql('p')}\n",
    replace: '',
    test: T,
    why: '도매 원본은 소비자 API 에 없어 클릭하면 404 다(2026-09-03 유어샵 핀 사고와 같은 클래스).',
  },
  {
    name: '체험목록 — 승인 안 된 매장도 노출된다',
    file: DB,
    find: "        AND ${approvedSellerProductSql('p')}\n",
    replace: '',
    test: T,
    why: '2026-09-16 대표 지시 — 승인되어야 노출. 가입 직후 남의 가게 이름으로 만든 체험이 뜬다.',
  },
  {
    name: '체험목록 — 이번 달이 아닌 신청까지 자리를 먹는다',
    file: DB,
    find: '  ).bind(monthKeyKst(), lim).all<Record<string, unknown>>()',
    replace: "  ).bind('%', lim).all<Record<string, unknown>>()",
    test: T,
    why: '모집 인원은 **이번 달** 단위다. 지난 달 신청이 자리를 먹으면 목록이 영구히 빈다.',
  },
  {
    name: '반대 방향 — 비활성 상품까지 거르느라 제공 조건을 안 본다',
    file: DB,
    find: '      WHERE o.enabled = 1\n',
    replace: '      WHERE o.enabled = 0\n',
    test: T,
    why: '거르는 방향만 잠그면 "전부 거른다"(목록이 늘 빈다)가 통과한다 — 양의 방향을 함께 잠근다.',
  },
  {
    // 🩸 첫 판은 `COALESCE(status,'')` 의 기본값을 `'x'` 로 바꿨는데 **둘 다 승인 목록 밖**이라
    //    결과가 같았다(= 행동을 안 바꾸는 가짜 주입). 방향을 실제로 뒤집는 결함으로 바꿨다.
    name: '반대 방향 — 매장 없는 플랫폼 상품까지 가린다',
    file: 'src/shared/db/consumer-visible-product.ts',
    find: `  return \`NOT EXISTS (
    SELECT 1 FROM sellers s_appr
     WHERE s_appr.id = \${alias}.seller_id
       AND COALESCE(s_appr.status, '') NOT IN ('approved', 'active')
  )\``,
    replace: `  return \`EXISTS (
    SELECT 1 FROM sellers s_appr
     WHERE s_appr.id = \${alias}.seller_id
       AND COALESCE(s_appr.status, '') IN ('approved', 'active')
  )\``,
    test: T,
    why: 'seller_id 가 NULL 인 플랫폼 상품(교환권·KT·데모)은 심사할 매장이 없어 보여야 한다 — 승인된 매장 행을 요구하면 통째로 사라진다.',
  },
  {
    name: '체험목록 — 서버가 상세 주소를 지어낸다',
    file: DB,
    find: '      product_id: Number(row.product_id),',
    replace: "      detail_path: `/pass/${Number(row.product_id)}`,\n      product_id: Number(row.product_id),",
    test: T,
    why: '주소 규칙이 `detailHref` SSOT 와 두 벌이 되면 같은 상품이 두 URL 로 갈린다(숙소는 /stays).',
  },
  {
    name: '체험목록 — 모집 메일 착지가 로그인을 요구한다',
    file: 'src/App.tsx',
    find: '<Route path="/influencer/seeding" element={<ErrorBoundary><InfluencerSeedingPage /></ErrorBoundary>} />',
    replace: '<Route path="/influencer/seeding" element={<ProtectedRoute requireUser><ErrorBoundary><InfluencerSeedingPage /></ErrorBoundary></ProtectedRoute>} />',
    test: T,
    why: '메일을 받은 사람이 먼저 보고 결정한다 — 로그인 벽을 세우면 깔때기 입구가 막힌다.',
  },
  {
    name: '체험목록 — 목록이 자격을 또 판정한다',
    file: 'src/pages/InfluencerSeedingPage.tsx',
    find: "import { detailHref } from '@/shared/product-flow'",
    replace: "import { detailHref } from '@/shared/product-flow'\nimport { checkEligibility } from '@/shared/seeding'",
    test: T,
    why: '판정이 두 곳이면 목록은 "신청 가능" 인데 상세는 거절하는 날이 온다 — 판정은 상세 한 곳.',
  },
  {
    name: '체험목록 — 막다른 길로 되돌린다(제공 안 켠 상세)',
    file: 'src/components/seeding/SellThisCard.tsx',
    find: '<Link to="/influencer/seeding" className="font-medium text-brand-text underline">다른 체험 보기</Link>',
    replace: '<span className="font-medium">유어샵에 담아 판매만 할 수 있어요</span>',
    test: T,
    why: '제공을 안 켠 상세가 끝이 되면 그 사람은 다음 걸음을 못 찾는다(이 PR 이 고친 그 구멍).',
  },
]
