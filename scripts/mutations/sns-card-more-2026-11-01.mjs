/**
 * 🪪 SNS 연동 카드에 정보를 더 — 주입 매니페스트 (2026-11-01, 대표 확정 안 C).
 *   시안: docs/design/sns-link-card-more-2026-11-01.md
 * 가드: src/tests/unit/sns-card-more-2026-11-01.test.ts
 *
 * 절반은 **반대 방향**이다 — "정보를 더하다가 지키던 것을 깨는" 쪽.
 */
const LINK = 'src/features/seeding/api/sns-link.ts'
const LIST = 'src/components/seeding/SnsLinkList.tsx'
const ACC = 'src/shared/sns-account.ts'
const DB = 'src/features/seeding/api/seeding-db.ts'
const ROUTES = 'src/features/seeding/api/seeding.routes.ts'
const T = 'src/tests/unit/sns-card-more-2026-11-01.test.ts'

export default [
  // ── 못 읽은 값을 0 으로 위장하는 쪽 ────────────────────────────────
  {
    name: '📈 못 읽은 팔로워를 0 으로 기록한다',
    file: LINK,
    find: "  if (followers === null || !Number.isFinite(followers)) return",
    replace: "  const _f = followers === null ? 0 : followers\n  if (!Number.isFinite(_f)) return\n  followers = _f",
    test: T,
    why:
      '모르는 날을 0 으로 적으면 **다음 주 추이가 "+9,283" 같은 거짓 성장**이 된다. ' +
      '사장님의 최소 팔로워 조건이 이 숫자로 자동 판정되므로 거짓 성장은 그대로 심사 통과가 된다. ' +
      '에러는 어디에도 안 난다 — 숫자가 그럴듯해서 사람도 못 본다.',
  },
  {
    name: '📈 스냅샷이 같은 날 값을 덮어쓴다',
    file: LINK,
    find: '`INSERT OR IGNORE INTO user_sns_follower_snapshots',
    replace: '`INSERT OR REPLACE INTO user_sns_follower_snapshots',
    test: T,
    why:
      '하루에 여러 번 ⟳ 를 누르면 **기준선이 계속 최신으로 밀린다** — 그러면 일주일 뒤 추이가 ' +
      '언제나 "거의 0" 으로 수렴한다(성장하고 있는데 안 보인다). 기준은 움직이지 않아야 한다.',
  },

  // ── 다른 계정과 비교하는 쪽 ────────────────────────────────────────
  {
    name: '📈 추이가 다른 계정의 지난 숫자와 비교한다',
    file: LINK,
    find: 'WHERE user_id = ? AND platform = ? AND external_id = ? AND taken_on <= ? AND taken_on >= ?',
    replace: 'WHERE user_id = ? AND platform = ? AND (? IS NOT NULL) AND taken_on <= ? AND taken_on >= ?',
    test: T,
    why:
      '플랫폼에서 계정을 갈아탄 사람에게 **거짓 성장**이 찍힌다(이전 계정 9,283 → 새 계정 120 이면 ' +
      '"−9,163"). bind 개수가 같아 SQL 은 멀쩡히 돌고 **에러가 안 난다**.',
  },
  {
    name: '📈 해제해도 지난 기록을 남긴다',
    file: ROUTES,
    find: '  await c.env.DB.prepare(`DELETE FROM user_sns_follower_snapshots WHERE user_id = ? AND platform = ?`).bind(uid(c), p).run().catch(() => null)',
    replace: '',
    test: T,
    why:
      '해제는 "이 계정을 떼겠다" 는 뜻인데 성장 기록이 남는다. 게다가 **다른 계정으로 다시 연동하면** ' +
      '남은 기록이 기준이 될 수 있다(조회가 external_id 로 한 번 더 거르지만, 두 겹 중 하나가 사라진다).',
  },

  // ── 기다리라는 자리표시자를 되살리는 쪽 (대표 지시 위반) ────────────
  {
    name: '📈 추이 자리에 "다음 주부터" 를 적는다',
    file: ACC,
    find: "  if (!trend || !Number.isFinite(trend.delta) || trend.delta === 0) return null",
    replace: "  if (!trend || !Number.isFinite(trend.delta) || trend.delta === 0) return '추이는 다음 주부터'",
    test: T,
    why:
      '대표가 명시로 **빼라고 한 것**이다(*"추이는 다음 주부터는 굳이 안넣어도 돼"*). ' +
      '기다리라는 문구는 아무 행동도 못 하게 하면서 자리만 차지한다.',
  },
  {
    name: '📈 날짜를 지어낸다 — 12일 전을 "이번 주" 라고 부른다',
    file: ACC,
    find: '  return `${trend.days}일 전보다 ${sign} ${Math.abs(trend.delta).toLocaleString(\'ko-KR\')}`',
    replace: '  return `이번 주 ${sign} ${Math.abs(trend.delta).toLocaleString(\'ko-KR\')}`',
    test: T,
    why:
      '스냅샷은 사람이 ⟳ 를 누를 때 쌓이므로 "정확히 7일 전" 은 대개 없다. 12일 전 값을 ' +
      '"이번 주" 라고 부르면 **틀린 말**이고, 사장님이 그 숫자로 사람을 고른다.',
  },

  // ── 사진 ───────────────────────────────────────────────────────────
  {
    name: '🖼️ 플랫폼이 준 사진 주소를 그대로 저장한다',
    file: LINK,
    find: '  if (!raw || !env.MEDIA_BUCKET) return null\n  return rehostImageToR2(env, raw, \'sns-avatar\', \'uploads/sns\')',
    replace: '  if (!raw) return null\n  return Promise.resolve(raw)',
    test: T,
    why:
      '실측: 인스타가 준 사진 주소는 서명돼 있고 **4일 뒤 만료**다(틱톡 avatar_url 도 임시). ' +
      '연동 직후엔 사진이 보이다가 며칠 뒤 **조용히 사라진다** — 사람 눈엔 고장인데 로그엔 아무것도 안 남는다.',
  },
  {
    name: '🖼️ 이관 실패가 멀쩡한 예전 사진을 지운다',
    file: LINK,
    find: '       post_count = ?, profile_image_url = COALESCE(?, profile_image_url),',
    replace: '       post_count = ?, profile_image_url = ?,',
    test: T,
    why:
      '일시적 네트워크 실패 한 번에 사진이 지워지고, 다시 확인을 누를 때마다 **사진이 깜빡인다**. ' +
      '읽기 실패는 *모름*이지 *없음*이 아니다(이 레포가 연동 삭제에서 이미 지키는 규칙).',
  },
  {
    name: '🖼️ 사진이 죽으면 빈 동그라미가 남는다',
    file: LIST,
    find: '    if (el.dataset.cfFallback === \'2\') setDeadPhoto((d) => ({ ...d, [p]: true }))',
    replace: '',
    test: T,
    why:
      '`cfImageOnError` 는 [리사이저 → 원본 → 숨김] 까지만 한다. 숨기고 끝내면 그 자리에 ' +
      '**아무것도 없는 40px 동그라미**가 남는다(로고로 되돌아가야 한다). 2026-09-02 카드에서 치른 교훈과 같은 자리.',
  },

  // ── 유튜브는 공짜다 ────────────────────────────────────────────────
  {
    name: '📺 유튜브가 이미 받은 값을 또 요청한다',
    file: LINK,
    find: "channels?part=snippet,statistics&mine=true",
    replace: "channels?part=snippet,statistics,contentDetails,brandingSettings&mine=true",
    test: T,
    why:
      '영상 수·썸네일은 **이미 이 응답 안에 있다**. part 를 늘리면 쿼터만 더 쓰고 얻는 게 없다 ' +
      '(이 변화의 전제가 "유튜브는 비용 0" 이었다).',
  },

  // ── 반대 방향: 정보를 더하다 지키던 것을 깬다 ──────────────────────
  {
    name: '🔁 보조 숫자를 팔로워만큼 굵게 만든다',
    file: LIST,
    find: '<span className="font-medium text-gray-600 dark:text-gray-300">{formatNumber(l.post_count)}</span>',
    replace: '<span className="font-bold text-gray-600 dark:text-gray-300">{formatNumber(l.post_count)}</span>',
    test: T,
    why:
      '굵기 체계 ⑨ — **12·13px 의 700+ 는 금지**이고 한 덩어리의 굵은 글자는 하나다. ' +
      '보조 숫자를 굵게 하면 팔로워(주인공)와 경쟁해서 어느 것이 조건 판정 숫자인지 흐려진다.',
  },
  {
    name: '🔗 계정 주소를 화면이 손으로 조립한다',
    file: LIST,
    find: '{l?.profile_url ? (',
    replace: '{(l?.profile_url || (l && `https://instagram.com/${l.username}`)) ? (',
    test: T,
    why:
      '서버가 플랫폼 응답으로 만든 주소와 **두 벌**이 된다(유튜브·틱톡인데 인스타 주소로 보낸다). ' +
      '링크가 열리긴 해서 에러가 안 나고, 엉뚱한 계정으로 가는 것만 남는다.',
  },
  {
    name: '🗄️ 이미 있는 표에 컬럼이 안 생긴다',
    file: DB,
    find: '  `ALTER TABLE user_sns_links ADD COLUMN profile_image_url TEXT`,',
    replace: '',
    test: T,
    why:
      '`CREATE TABLE IF NOT EXISTS` 는 **이미 있는 표에 닿지 않는다**. 라이브에 표가 이미 있으므로 ' +
      'ALTER 가 없으면 새 컬럼이 영영 안 생기고, 쓰기는 조용히 실패한다(`.catch(() => null)` 뒤).',
  },
  {
    name: '🔒 플랫폼 내부 식별자를 화면으로 내보낸다',
    file: LINK,
    find: '  return Promise.all(rows.map(async ({ external_id, ...x }) => ({\n    ...x,',
    replace: '  return Promise.all(rows.map(async ({ ...x }) => ({\n    ...x,',
    test: T,
    why:
      '`external_id` 는 추이를 고르는 데만 쓰는 플랫폼 내부 식별자다. 공개 응답에 실으면 ' +
      '필요 없는 것이 밖으로 나가고, 한 번 나간 필드는 화면이 의존하기 시작해 되돌리기 어려워진다.',
  },
]
