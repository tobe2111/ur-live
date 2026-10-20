/**
 * 🚨 매장 제보(신고) (2026-09-21) 되돌려-검증 주입.
 * 가드: src/tests/unit/store-report-2026-09-21.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/store-report-2026-09-21.test.ts'
const UTIL = 'src/worker/utils/store-reports.ts'

export default [
  {
    name: '🚨매장제보 연락처 없이도 받는다',
    file: UTIL,
    find: '  if (contact.length < 5 || contact.length > 120) {',
    replace: '  if (false) {',
    test: TEST,
    why: '어드민이 되물을 수 없는 제보가 큐에 쌓인다 — 접수는 되는데 아무것도 못 한다.',
  },
  {
    name: '🚨매장제보 정의 밖 사유를 통과시킨다',
    file: UTIL,
    find: '  if (!(STORE_REPORT_REASONS as readonly string[]).includes(reason)) {',
    replace: '  if (!reason && false) {',
    test: TEST,
    why: '어드민 화면이 모르는 사유가 들어와 분류가 무너진다.',
  },
  {
    name: '🚨매장제보 없는 매장에도 쌓인다',
    file: UTIL,
    find: "  if (!seller) return { ok: false, code: 'STORE_NOT_FOUND', error: '해당 매장을 찾을 수 없습니다' }",
    replace: '  void seller',
    test: TEST,
    why: '어드민 큐가 존재하지 않는 매장 제보로 찬다.',
  },
  {
    // ⚠️ 처음엔 `INSERT OR IGNORE` → `INSERT` 로 주입했는데 **행동이 같았다**(util 이 .catch 로
    //    삼켜 양쪽 다 DUPLICATE 로 끝난다). 멱등을 실제로 지키는 것은 **부분 UNIQUE 인덱스**다.
    name: '🚨매장제보 멱등 인덱스를 안 만든다 (한 사람이 큐를 도배)',
    file: UTIL,
    find: "      `CREATE UNIQUE INDEX IF NOT EXISTS idx_store_reports_open\n         ON store_reports(seller_id, reporter_key) WHERE status = 'open'`,",
    replace: "      `SELECT 1`,",
    test: TEST,
    why: '멱등이 깨진다. 한 사람이 같은 매장에 제보를 무한정 쌓을 수 있다(머니/정합성 룰 #3).',
  },
  {
    name: '🚨매장제보 멱등 인덱스가 전체 UNIQUE (닫은 뒤 재제보 불가)',
    file: UTIL,
    find: "         ON store_reports(seller_id, reporter_key) WHERE status = 'open'`,",
    replace: '         ON store_reports(seller_id, reporter_key)`,',
    test: TEST,
    why: '한 번 기각되면 그 사람은 그 매장을 영원히 다시 제보할 수 없다.',
  },
  {
    name: '🚨매장제보 연락처 표기가 다르면 다른 사람으로 본다',
    file: UTIL,
    find: "  const digits = String(contact || '').replace(/\\D/g, '')",
    replace: "  const digits = String(contact || '')",
    test: TEST,
    why: '`010-1234-5678` 과 `010 1234 5678` 이 갈려 도배 방지가 헛돈다.',
  },
  {
    name: '🚨매장제보 되찾기 경로를 안 알려준다',
    file: UTIL,
    find: "  const claimPath = reason === 'not_my_listing' ? `/store/find?seller_id=${sellerId}` : undefined",
    replace: '  const claimPath = undefined',
    test: TEST,
    why: '사장님이 제보만 하고 주인 자리를 되찾는 길을 모른 채 기다린다.',
  },
  {
    name: '🚨매장제보 어드민 처리가 CAS 없이 덮어쓴다',
    file: UTIL,
    find: "      WHERE id = ? AND status = 'open'`,",
    replace: '      WHERE id = ?`,',
    test: TEST,
    why: '두 어드민이 동시에 누르면 누가 판단했는지가 흐려진다(decided_by 덮어쓰기).',
  },
  {
    name: '🚨매장제보 큐가 닫힌 것까지 섞어 보여준다',
    file: UTIL,
    find: '      WHERE r.status = ?\n      ORDER BY r.created_at DESC',
    replace: '      WHERE (r.status = ? OR 1=1)\n      ORDER BY r.created_at DESC',
    test: TEST,
    why: '열린 제보만 봐야 하는 큐에 처리된 것이 섞여 놓친다.',
  },
  {
    name: '🚨매장제보 라우트 마운트 끊김',
    file: 'src/features/seller/api/seller-stores.routes.ts',
    find: 'registerStoreReportRoutes(app, resolveActorUserId)',
    replace: 'void registerStoreReportRoutes',
    test: TEST,
    why: '제보 버튼은 보이는데 서버가 404 를 준다. 타입 에러도 안 난다.',
  },
  {
    name: '🚨매장제보 로그인을 강제한다 (사장님이 못 쓴다)',
    file: 'src/features/seller/api/seller-store-reports.routes.ts',
    find: "import { rateLimit } from '@/worker/middleware/rate-limit'",
    replace: "import { rateLimit } from '@/worker/middleware/rate-limit'\nimport { requireAuth } from '@/worker/middleware/auth'",
    test: TEST,
    why: '사장님은 대개 유어딜 계정이 없다. 로그인을 요구하면 이 창구가 있으나 마나다.',
  },
  {
    name: '🚨매장제보 제보가 판매를 자동 중지시킨다 (머니/운영 경계 침범)',
    file: UTIL,
    find: '  const key = reporterKeyOf(contact, userId)',
    replace: "  await DB.prepare('UPDATE products SET is_active = 0 WHERE seller_id = ?').bind(sellerId).run().catch(() => null)\n  const key = reporterKeyOf(contact, userId)",
    test: TEST,
    why: '악의적 제보 한 건에 멀쩡한 매장이 마비된다. 판단은 어드민의 일이다.',
  },
  {
    name: '🚨매장제보 매장 없는 상품에도 입구를 그린다',
    file: 'src/pages/group-buy/StoreReportLink.tsx',
    find: '  if (!sellerId) return null',
    replace: '  if (false) return null',
    test: TEST,
    why: '플랫폼 교환권(seller_id 없음)에 "이 매장 제보하기" 가 떠서 누르면 아무 매장도 못 고른다.',
  },
  {
    name: '🚨매장제보 상세가 매장 id 를 안 넘긴다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: ' sellerId={detail.seller_id} productId={detail.id}',
    replace: '',
    test: TEST,
    why: '입구가 모든 상품에서 사라진다 — 화면은 멀쩡해 보인다.',
  },
]
