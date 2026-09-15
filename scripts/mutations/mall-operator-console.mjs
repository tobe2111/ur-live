/**
 * 🏬 몰 운영자 콘솔(`/mall-admin`) 불변식 — 주입 매니페스트 (2026-09-15 등록).
 * 가드: src/tests/unit/mall-operator-console.test.ts
 *
 * ⚠️ PR #1123 은 이 주입 4건을 **손으로** 돌려 빨간불을 확인했다(본문 "주입 4건으로 빨강 확인 완료").
 *    손으로 하면 다음 세션은 안 한다 — CLAUDE.md 가 요구하는 대로 매니페스트에 등록해
 *    CI 가 대신 깨뜨리게 한다.
 *
 * 이 가드가 지키는 IDOR 방어는 두 문장뿐이다: **URL 에 몰 id 없음** + **몰-스코프 쿼리의 WHERE 에
 * mall_id 동반**. 둘 다 한 줄 빼먹으면 에러 없이 뚫린다.
 */
const TEST = 'src/tests/unit/mall-operator-console.test.ts'
const ROUTES = 'src/features/mall/api/mall-admin.routes.ts'

export default [
  {
    name: '[몰콘솔] UPDATE 공지에서 mall_id 제거 (남의 몰 공지를 수정할 수 있다)',
    file: ROUTES,
    find: 'UPDATE mall_notices SET ${sets.join(\', \')} WHERE id = ? AND mall_id = ?',
    replace: 'UPDATE mall_notices SET ${sets.join(\', \')} WHERE id = ?',
    test: TEST,
    why: 'mall_id 한 조각이 IDOR 방어의 전부다. 빼도 에러가 안 나고 0 rows 가 아니라 남의 행이 바뀐다.',
  },
  {
    name: '[몰콘솔] DELETE 공지에서 mall_id 제거',
    file: ROUTES,
    find: "'DELETE FROM mall_notices WHERE id = ? AND mall_id = ?'",
    replace: "'DELETE FROM mall_notices WHERE id = ?'",
    test: TEST,
    why: '수정보다 되돌리기 어려운 방향 — 같은 한 조각이 지운다.',
  },
  {
    name: '[몰콘솔] 동의 기록 실패를 성공으로 보고 (동의 화면 무한 반복)',
    file: ROUTES,
    find: "code: 'CONSENT_NOT_RECORDED'",
    replace: "code: 'CONSENT_OK_PROBABLY'",
    test: TEST,
    why: 'recordTermsConsent 는 fail-soft라 throw 하지 않는다. 재확인 없이 success 를 주면 증적 없는 "체결"이 된다.',
  },
  {
    name: '[몰콘솔] 서버 상수 대신 클라가 보낸 약관 버전을 기록 (버전 위조)',
    file: ROUTES,
    find: "slug: 'mall-operator', version: MALL_OPERATOR_TERMS_VERSION,",
    replace: "slug: 'mall-operator', version: String(body.version || ''),",
    test: TEST,
    why: '전자계약의 버전은 서버가 찍어야 한다 — 클라 값을 믿으면 "무슨 약관에 동의했는지" 를 상대가 정한다.',
  },
  {
    name: '[몰콘솔] URL 로 몰 id 를 받는 손잡이 부활 (IDOR 파라미터 재도입)',
    file: ROUTES,
    // ⚠️ `nid` 파싱 줄은 PATCH·DELETE 두 곳이라 앵커가 유일하지 않다 — DELETE 쪽 고유 후행 줄까지 묶는다.
    find: "const r = await c.env.DB.prepare('DELETE FROM mall_notices",
    replace: "const _m = c.req.param('mallId'); const r = await c.env.DB.prepare('DELETE FROM mall_notices",
    test: TEST,
    why: '이 콘솔의 설계 전제는 "남의 몰을 지목할 파라미터가 아예 없다" 이다. 하나 생기면 전제가 무너진다.',
  },
]
