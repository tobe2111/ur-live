/**
 * 🔄 SNS 제자리 갱신 — 주입 매니페스트 (2026-11-01).
 *   대표 *"새로고침도 있고 해야하지 않을까"*.
 * 가드: src/tests/unit/sns-refresh-inplace-2026-11-01.test.ts
 */
const LINK = 'src/features/seeding/api/sns-link.ts'
const LIST = 'src/components/seeding/SnsLinkList.tsx'
const ROUTES = 'src/features/seeding/api/seeding.routes.ts'
const T = 'src/tests/unit/sns-refresh-inplace-2026-11-01.test.ts'

export default [
  {
    name: '🔄 유튜브가 만료된 토큰으로 바로 조회한다 (재발급 생략)',
    file: LINK,
    find: '  if (soon) {\n    renewed = await renewAccessToken(env, p, { access, refresh: refresh || null })',
    replace: '  if (false) {\n    renewed = await renewAccessToken(env, p, { access, refresh: refresh || null })',
    test: T,
    why:
      '구글 access token 은 ~1시간, 틱톡은 ~24시간이다. 재발급을 건너뛰면 **가장 흔한 경우에 늘** ' +
      '"다시 연동해 주세요" 가 뜨고, 그건 제자리 갱신을 만든 이유 자체를 무효로 만든다.',
  },
  {
    name: '🔄 다른 계정으로 바뀌었는데 그대로 덮어쓴다',
    file: LINK,
    find: '  if (got.profile.external_id !== row.external_id) {',
    replace: '  if (false) {',
    test: T,
    why:
      '플랫폼에서 다른 계정으로 로그인한 뒤 누르면 **남의 팔로워 수가 내 행에 들어간다**. ' +
      '"한 SNS 계정은 한 유어딜 계정" UNIQUE 가 지키던 것이 조용히 무너지고, 사장님 조건 판정이 거짓이 된다.',
  },
  {
    name: '🔄 갱신 실패가 연동을 끊는다',
    file: LINK,
    find: "  if (!got.ok) return { ok: false, error: '연동이 만료됐어요. 다시 연동해 주세요', reconnect: true }",
    replace:
      "  if (!got.ok) {\n" +
      "    await env.DB.prepare(`DELETE FROM user_sns_links WHERE user_id = ? AND platform = ?`).bind(userId, p).run().catch(() => null)\n" +
      "    return { ok: false, error: '연동이 만료됐어요. 다시 연동해 주세요', reconnect: true }\n" +
      '  }',
    test: T,
    why:
      '플랫폼 일시 장애로 사람의 연동을 끊으면, 다시 연동하러 가는 동안 신청 조건이 막힌다. ' +
      '읽기 실패는 **모름**이지 **없음**이 아니다.',
  },
  {
    name: '🔄 숨긴 구독자를 0 으로 위장한다',
    file: LINK,
    find: 'follower_count: hidden ? null : num(item.statistics?.subscriberCount)',
    replace: 'follower_count: num(item.statistics?.subscriberCount)',
    test: T,
    why:
      '유튜브는 구독자를 숨기면 `subscriberCount` 를 0 으로 준다. 그대로 저장하면 ' +
      '"구독자 0명" 이라고 말하는 것이고 사장님 조건에 왜 걸리는지도 설명되지 않는다.',
  },
  {
    name: '🔄 교환 함수가 프로필 조회를 다시 인라인으로 가져간다',
    file: LINK,
    find: '    const got = await fetchProfile(p, token)\n    if (!got.ok) return got',
    replace:
      '    const me = await j(await fetch(`${IG_GRAPH}/me?fields=user_id,username,followers_count&access_token=${token}`))\n' +
      '    const got = { ok: true as const, profile: { external_id: String(me.user_id || ""), username: me.username || null, display_name: null, profile_url: null, follower_count: num(me.followers_count), account_type: null } }\n' +
      '    if (!got.ok) return got',
    test: T,
    why:
      '두 벌이 되는 순간 **연동했을 때와 다시 확인했을 때 숫자가 달라질 수 있다** — 필드 목록도 해석도 ' +
      '갈리는데 에러는 안 난다. 공용 함수로 뺀 이유가 그것이다.',
  },
  {
    name: '🔄 화면이 다시 리다이렉트로 되돌아간다',
    file: LIST,
    find: 'onClick={() => refresh(p)}',
    replace: 'onClick={() => connect(p)}',
    test: T,
    why:
      '누를 때마다 플랫폼 동의 화면을 거쳐 돌아온다 — 참고 화면이 제자리에서 하는 일을 ' +
      '우리는 앱을 벗어나서 한다. 동작은 하므로 **에러로는 드러나지 않는다**.',
  },
  {
    name: '🔄 갱신 실패를 조용히 삼킨다',
    file: LIST,
    find: "      toast.error(d?.error || '다시 확인하지 못했어요')\n      if (d?.reconnect) { await connect(p); return }",
    replace: '      if (d?.reconnect) { return }',
    test: T,
    why:
      '숫자가 왜 그대로인지 알 길이 없다. 토큰이 죽은 경우에 플랫폼으로 보내는 것이 ' +
      '실제로 고치는 유일한 길이고, 누른 사람의 의도("다시 확인")와도 같다.',
  },
  {
    name: '🔄 갱신 라우트가 인증 없이 열린다',
    file: ROUTES,
    find: "seedingRoutes.post('/sns/:platform/refresh', requireAuth(), async (c) => {",
    replace: "seedingRoutes.post('/sns/:platform/refresh', async (c) => {",
    test: T,
    why:
      '`uid(c)` 가 0 이 되어 남의 연동을 건드리거나, 로그인 없이 플랫폼 API 를 대신 때리는 ' +
      '무료 프록시가 된다.',
  },
]
