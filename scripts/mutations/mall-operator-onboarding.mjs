/**
 * 🏪 운영자 셀프 온보딩 — 주입 매니페스트 (2026-09-16 등록).
 * 가드: src/tests/unit/mall-surface-boundary.test.ts
 *
 * 원 PR(#1149) 세 커밋은 가드는 썼는데 **주입은 한 건도 안 남겼다** — 즉 그 가드들이
 * 실제로 실패할 수 있는지 아무도 확인한 적이 없다. 이 레포의 반복 사고가 정확히 그 자리다.
 *
 * 이 조각이 지키는 명제:
 *   ① **신청은 아무것도 만들지 않는다** — 슬러그는 `urdeal.kr/{슬러그}` 영구 주소다.
 *   ② **승인은 선점 먼저** — 동시 승인이 몰을 둘 만들지 않는다.
 *   ③ **실패하면 만든 것 전부를 되돌린다** — 몰만 남으면 그 슬러그는 영원히 재승인 불가(409).
 *   ④ **정적 라우트가 `/:id` 앞에** — Hono 는 등록 순서로 매칭한다.
 * 전부 "빼먹어도 에러가 안 나는" 종류다. ③ 은 실제로 첫 구현이 틀렸던 자리다.
 */
const BOUNDARY = 'src/tests/unit/mall-surface-boundary.test.ts'
const SELLER_GB = 'src/features/seller/api/seller-gb.routes.ts'
const ADMIN = 'src/features/supply/api/wholesale-malls-admin.routes.ts'
const MYMALL = 'src/components/seller/MyMallAddress.tsx'

export default [
  {
    name: '[온보딩] 신청이 몰을 곧바로 만들게 함 (사람 검토 단계 소멸)',
    file: SELLER_GB,
    find: "      \"INSERT INTO mall_applications (seller_id, slug, name, status) VALUES (?, ?, ?, 'pending')\",",
    replace: "      \"INSERT INTO wholesale_malls (slug, name, brand_name, consumer_path, active) VALUES (?, ?, ?, 1, 1) -- INSERT INTO mall_applications\",",
    test: BOUNDARY,
    why: '예약어와 충돌하는 슬러그가 사람 눈을 거치지 않고 소비자 라우트를 죽일 수 있다. 신청 응답은 200 이라 화면상 아무 일도 안 일어난 것처럼 보인다.',
  },
  {
    name: '[온보딩] 신청 슬러그 판정을 SSOT 밖으로 (예약어 통과)',
    file: SELLER_GB,
    find: 'if (!isMallSlugCandidate(slug)) {',
    replace: 'if (!/^[a-z0-9-]{3,30}$/.test(slug)) {',
    test: BOUNDARY,
    why: '길이·문법만 보면 `admin`·`vouchers` 같은 예약어가 통과한다. 승인 시점 재검증에 걸리더라도, 신청자에겐 "되는 줄 알았다가 나중에 거절"이 된다.',
  },
  {
    name: '[온보딩] 승인 CAS 를 몰 생성 뒤로 (동시 승인이 몰을 둘 만듦)',
    file: ADMIN,
    find: "      \"UPDATE mall_applications SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'\",",
    replace: "      \"UPDATE mall_applications SET reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'\",",
    test: BOUNDARY,
    why: 'claim-before-create 가 깨지면 두 번째 요청이 슬러그 UNIQUE 에 막혀도 **첫 번째가 만든 몰은 이미 남는다**(머니/정합성 룰 #1 과 같은 클래스).',
  },
  {
    name: '[온보딩] 실패 롤백에서 몰 삭제를 빼먹음 (그 슬러그 영원히 409)',
    file: ADMIN,
    find: "        await DB.prepare('DELETE FROM wholesale_malls WHERE id = ? AND slug = ?')",
    replace: "        await DB.prepare('SELECT 1 FROM wholesale_malls WHERE id = ? AND slug = ?')",
    test: BOUNDARY,
    why: '첫 구현이 실제로 이랬다. 신청은 대기열에 보이는데 아무리 승인을 눌러도 "이미 사용 중인 slug" 409 — 화면 어디에도 원인이 없다.',
  },
  {
    name: '[온보딩] 셀러 연결에서 본진 조건 제거 (남의 몰 연결을 덮어씀)',
    file: ADMIN,
    find: "        'UPDATE sellers SET mall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(mall_id, ?) = ?',",
    replace: "        'UPDATE sellers SET mall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ? = ? -- COALESCE(mall_id',",
    test: BOUNDARY,
    why: '묵은 신청을 승인하면 그 사이 어드민이 수동 연결해 둔 몰을 덮어쓰고, 남의 가게 상품이 이쪽으로 딸려 온다.',
  },
  {
    name: '[온보딩] 상품 이관 실패를 삼킴 (조용히 빈 가게가 열림)',
    file: ADMIN,
    find: "      ).bind(createdMallId, row.seller_id, DEFAULT_MALL_ID, DEFAULT_MALL_ID).run()\n      movedProducts = true",
    replace: "      ).bind(createdMallId, row.seller_id, DEFAULT_MALL_ID, DEFAULT_MALL_ID).run()\n        .catch(() => null)\n      movedProducts = true",
    test: BOUNDARY,
    why: '운영자가 "왜 내 가게엔 상품이 안 보이지"를 다시 겪는다. 승인은 성공으로 뜨고 로그도 없다.',
  },
  {
    name: '[온보딩] 어드민 정적 `/applications` 를 `/:id` 뒤로',
    file: ADMIN,
    find: "app.get('/applications', requireSuperAdmin(), async (c) => {",
    replace: "app.get('/zzz-applications', requireSuperAdmin(), async (c) => {",
    test: BOUNDARY,
    why: '순서 규칙이 깨졌는지는 경로 문자열 비교로 못 잡는다(라우트 중복 가드가 통과한다). 같은 날 seller-gb 에서 실제로 `/support-contact` 가 `/:id` 에 삼켜졌다.',
  },
  {
    name: '[온보딩] 미연결 안내 삭제 (본진에 올라가는 걸 안 알림)',
    file: MYMALL,
    find: '본점',
    replace: '어딘가',
    test: BOUNDARY,
    why: '상품이 조용히 본진(mall_id=1)으로 들어가는데 운영자는 자기 가게에 안 뜨는 이유를 알 방법이 없다 — 이 기능이 존재하는 이유 그 자체다.',
  },
  {
    name: '[온보딩] 어드민 대기열이 조회 실패를 "신청 없음" 으로 위장',
    file: 'src/pages/admin/wholesale-malls/MallApplicationsPanel.tsx',
    find: '  if (isError) {',
    replace: '  if (false) {',
    test: BOUNDARY,
    why: '일시 5xx 에 대기열이 통째로 사라지고 에러도 안 뜬다 — 신청한 운영자가 어드민 화면에서 증발한다(check-query-iserror 가 막는 클래스인데 이 파일은 그 스캔 범위 밖이다).',
  },
]
