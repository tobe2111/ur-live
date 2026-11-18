/** 🧬 주입 — 목록 색인 (2026-11-18) · 가드: src/tests/unit/list-indexes-2026-11-18.test.ts */
const T = 'src/tests/unit/list-indexes-2026-11-18.test.ts'
export default [
  { name: 'listidx: 상품 목록 색인이 정렬 칸을 잃는다', file: 'src/worker/routes/repair-schema/index-repairs.ts',
    find: 'ON products(is_active, created_at DESC, id DESC)`', replace: 'ON products(is_active)`', test: T,
    why: '목록이 다시 활성 상품 전부를 읽고 임시 정렬한다(하루 330만 줄).' },
  { name: 'listidx: 연결 유저 조회가 색인을 못 박지 않는다', file: 'src/features/marketing/api/lead-claim.ts',
    find: 'FROM ad_influencer_leads INDEXED BY idx_ad_leads_linked_user WHERE', replace: 'FROM ad_influencer_leads WHERE', test: T,
    why: '연결 0건인데 58만 줄을 훑는다.' },
]
