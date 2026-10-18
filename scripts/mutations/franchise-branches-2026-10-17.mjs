/**
 * 🏬 프랜차이즈 지점 편의 기능 (2026-10-17) — 주입 매니페스트.
 * 가드: src/tests/unit/franchise-branches-2026-10-17.test.ts
 */
const TEST = 'src/tests/unit/franchise-branches-2026-10-17.test.ts'

export default [
  {
    name: '🏬 이용권 복사가 원본 지점 주소를 그대로 싣는다',
    file: 'src/features/seller/api/seller-product-copy.routes.ts',
    find: "    group_buy_tiers: str(src.group_buy_tiers) ?? null,\n  }",
    replace: "    group_buy_tiers: str(src.group_buy_tiers) ?? null,\n    restaurant_address: str(src.restaurant_address),\n  }",
    test: TEST,
    why: '원본 주소가 실리면 B지점 이용권에 A지점 주소가 박혀 손님이 엉뚱한 지점에 간다 — 대상 지점 프로필이 채워야 한다.',
  },
  {
    name: '🏬 이용권 복사가 대상 지점 권한을 안 본다',
    file: 'src/features/seller/api/seller-product-copy.routes.ts',
    find: '        canOperateStore(db, userId, targetId),\n',
    replace: '        Promise.resolve({ ok: true }),\n',
    test: TEST,
    why: '권한 없는 지점에 이용권을 꽂을 수 있게 된다 — 좌석 토큰 발급과 같은 근거(canOperateStore)가 유일한 방어선이다.',
  },
  {
    name: '🏬 바인딩 조각이 한도를 넘는다',
    file: 'src/worker/utils/d1-in-chunks.ts',
    find: 'export const D1_IN_CHUNK = 90',
    replace: 'export const D1_IN_CHUNK = 150',
    test: TEST,
    why: 'D1 은 한 문장에 바인딩 100개까지다 — 조각이 크면 지점 많은 브랜드의 요약이 통째로 실패한다.',
  },
  {
    name: '🏬 한 조각 실패가 전체를 0 으로 만든다',
    file: 'src/worker/utils/d1-in-chunks.ts',
    find: "run(chunk, chunk.map(() => '?').join(',')).catch(() => [] as R[])",
    replace: "run(chunk, chunk.map(() => '?').join(','))",
    test: TEST,
    why: '조각 하나가 실패하면 마이 요약의 합계가 통째로 사라진다 — 호출부 fail-soft 와 같은 규칙이어야 한다.',
  },
  {
    name: '🏷️ 브랜드에 운영 권한 없는 지점을 넣을 수 있다',
    file: 'src/worker/utils/store-brands.ts',
    find: "  if (!access.ok) return { ok: false, code: 'NOT_OPERATOR' }\n",
    replace: '',
    test: TEST,
    why: '남의 가게(점주가 들이지 않은 가맹점)가 본사 브랜드 페이지에 뜬다 — "그 지점 주인이 정한다" 위반.',
  },
  {
    name: '🏷️ 지점 주인이 남의 브랜드에서 자기 지점을 못 뺀다',
    file: 'src/worker/utils/store-brands.ts',
    find: '  const allowed = Number(m.created_by_user_id) === userId || await isStoreOwner(DB, userId, sellerId)',
    replace: '  const allowed = Number(m.created_by_user_id) === userId',
    test: TEST,
    why: '점주가 본사와 관계를 끊어도 자기 가게가 본사 브랜드에 계속 걸린다 — 주인이 늘 이겨야 한다.',
  },
  {
    name: '🏷️ 다른 브랜드에 묶인 지점을 빼앗아 온다',
    file: 'src/worker/utils/store-brands.ts',
    find: "'INSERT OR IGNORE INTO store_brand_members (seller_id, brand_id, added_by_user_id) VALUES (?, ?, ?)'",
    replace: "'INSERT OR REPLACE INTO store_brand_members (seller_id, brand_id, added_by_user_id) VALUES (?, ?, ?)'",
    test: TEST,
    why: '운영자로 들어간 본사가 점주가 묶어 둔 브랜드에서 지점을 조용히 옮겨 간다.',
  },
  {
    name: '🏷️ 브랜드 페이지가 승인 전 지점의 이용권을 보여 준다',
    file: 'src/features/brands/api/brands-public.routes.ts',
    find: "          AND ${approvedSellerProductSql('p')}${scope}",
    replace: '          ${scope}',
    test: TEST,
    why: '메인 피드가 막는 승인 전 매장 이용권이 브랜드 페이지로만 새어 나간다 — 노출 술어는 한 벌이어야 한다.',
  },
  {
    name: '🏷️ 지점이 하나뿐인데 "다른 지점 보기" 를 약속한다',
    file: 'src/features/brands/api/brands-public.routes.ts',
    find: 'if (!b || Number(b.branch_count) <= 1) return c.json({ success: true, data: null })', // 2026-10-18 조기 반환 모양으로 재조준
    replace: 'if (!b) return c.json({ success: true, data: null })',
    test: TEST,
    why: '눌러도 같은 가게 하나뿐인 링크 — 화면이 지키지 못할 약속이다.',
  },
  {
    name: '🏷️ 좌표 없는 지점이 가까운 지점보다 앞에 온다',
    file: 'src/pages/brand/brand-branches.ts',
    find: ': Infinity }))',
    replace: ': 0 }))',
    test: TEST,
    why: '위치를 모르는 지점이 "가장 가까운 지점" 으로 맨 위에 뜬다.',
  },
  {
    name: '🏬 마이 요약이 다시 20곳에서 자른다',
    file: 'src/features/seller/api/seller-operators.routes.ts',
    find: '      .slice(0, MAX_SUMMARY_STORES)\n',
    replace: '      .slice(0, 20)\n',
    test: TEST,
    why: '지점이 20곳을 넘는 브랜드는 나머지가 마이에서 조용히 빠진다(2026-10-17 이전 상태).',
  },
]
