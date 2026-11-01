/**
 * 🪪 SNS 연동 목록 = 정보 블록 — 주입 매니페스트 (2026-11-01).
 *   대표 *"이런 식으로 정보들도 나오고 새로고침도 있고 해야하지 않을까"*.
 * 가드: src/tests/unit/sns-link-card-2026-11-01.test.ts · ushop-sns-mono-2026-09-16.test.ts
 */
const LIST = 'src/components/seeding/SnsLinkList.tsx'
const DATE = 'src/utils/date.ts'
const LOGOS = 'src/components/icons/sns-logos.tsx'
const HEADER = 'src/pages/curator-page/CuratorHeader.tsx'
const T = 'src/tests/unit/sns-link-card-2026-11-01.test.ts'
const SNS = 'src/tests/unit/ushop-sns-mono-2026-09-16.test.ts'

export default [
  {
    name: '🪪 연동 목록이 마지막 확인 시각을 다시 감춘다',
    file: LIST,
    find: "{relativeFromNow(l.verified_at) || '확인'} 확인",
    replace: '다시 확인',
    test: T,
    why:
      '이 숫자로 사장님의 팔로워 조건이 판정되는데 **언제 확인한 값인지** 안 보이면 ' +
      '방금 값과 한 달 전 값이 화면에서 구분되지 않는다. 에러가 안 나고 숫자도 맞아 보여서 ' +
      '되돌아가도 아무도 신고하지 않는 종류다(종전이 정확히 그 상태였다).',
  },
  {
    name: '🪪 상대 시간을 화면이 손으로 계산한다 (KST 9시간 어긋남)',
    file: LIST,
    find: '{relativeFromNow(l.verified_at)',
    replace: '{new Date(l.verified_at).toLocaleDateString()',
    test: T,
    why:
      'DB 값은 `Z` 없는 UTC 라 `new Date(x)` 는 브라우저 TZ 로 오해석한다 — 9시간 어긋나고 ' +
      '**에러는 없다**. 이 레포가 2026-07-27 에 네 군데서 같은 사고를 겪어 `utils/date` SSOT 를 만든 이유다.',
  },
  {
    name: '🪪 포매터가 SSOT 파서를 건너뛴다',
    file: DATE,
    find: '  const ms = Date.now() - parseUTCDate(dateStr).getTime()',
    replace: '  const ms = Date.now() - Date.parse(dateStr)',
    test: T,
    why:
      '`Date.parse` 는 `Z` 없는 문자열을 **로컬 시간**으로 읽는다. 이 파일이 존재하는 이유를 ' +
      '이 파일 안에서 어기는 모양이고, UTC 서버에서는 결과가 같아 테스트도 속이기 쉽다.',
  },
  {
    name: '🪪 못 읽은 팔로워를 0 으로 위장한다',
    file: LIST,
    find: "{l.follower_count === null ? '—' : formatNumber(l.follower_count)}",
    replace: '{formatNumber(l.follower_count ?? 0)}',
    test: T,
    why:
      '인스타 비프로페셔널 계정·틱톡 심사 전에는 팔로워가 **안 온다**(null). 0 으로 적으면 ' +
      '"팔로워가 0명인 계정" 이라고 말하는 것이고, 사장님 조건에 왜 걸리는지도 설명되지 않는다.',
  },
  {
    name: '🪪 블록마다 판을 깐다 (카드 안에 카드)',
    file: LIST,
    find: '<li key={p} className="py-4 first:pt-2 last:pb-0">',
    replace: '<li key={p} className="rounded-2xl bg-surface p-4 shadow-lift">',
    test: T,
    why:
      '이 목록은 이미 `SNS 연동` 카드 **안**이고 신청 시트 안이다. 안에 또 판을 깔면 ' +
      '2026-10-12 공유 카드에서 치른 *카드 안에 카드* 가 된다 — 빌드도 화면도 안 깨진다.',
  },
  {
    name: '🪪 연동 목록이 로고 path 를 다시 베껴 온다',
    file: LIST,
    find: '                <Logo size={18} />',
    replace:
      '                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.3 2.2 1.6 3.9 3.8 4.1v2.6Z" /></svg>',
    test: T,
    why:
      'path 가 두 벌이 되는 순간 한쪽만 고치는 날이 온다 — 유어샵 머리와 체험 목록이 서로 다른 ' +
      '로고를 그리는데 **어느 쪽도 에러가 아니다**. 공용 부품을 만든 이유가 그것이다.',
  },
  {
    name: '🪪 (반대 방향) 유어샵 머리가 인라인 svg 로 되돌아간다',
    file: HEADER,
    find: '<InstagramLogo />',
    replace:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /></svg>',
    test: SNS,
    why:
      '공용 부품으로 옮기고도 **한쪽이 제 사본을 되찾는 것**이 두 벌 드리프트의 실제 모양이다. ' +
      '화면은 똑같이 보이므로 리뷰에서도 잘 안 잡힌다.',
  },
  {
    name: '🪪 (반대 방향) 공용 로고가 브랜드 색을 되찾는다',
    file: LOGOS,
    find: '    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">\n      <path d="M23.5 6.2',
    replace: '    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000" className={className} aria-hidden="true">\n      <path d="M23.5 6.2',
    test: SNS,
    why:
      '2026-09-16 대표 *"로고 너무 촌스러운데..??"* 가 지운 바로 그 순수 빨강이다. ' +
      '글리프를 공용 부품으로 옮기면서 그 규칙이 따라오지 않으면, 한 줄에 색 면이 다시 셋이 된다.',
  },
]
