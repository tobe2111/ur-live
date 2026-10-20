/**
 * 🎫 2026-09-29 (대표 확정 **B안 — 통장형**) 소개 콘솔 주입 매니페스트.
 *
 * 지키는 것: **서버 무변경 · 없는 숫자 금지 · 옛 판 부활 금지 · 막대 30칸 · 정직한 비율 ·
 * 매장 줄이 곧 동작**. 아래 결함을 심으면 `curator-console-b-2026-09-29.test.ts` 가 빨간불이어야 한다.
 */
const T = 'src/tests/unit/curator-console-b-2026-09-29.test.ts'
const EARN = 'src/pages/curator-earnings/EarningsPanel.tsx'
const PERF = 'src/pages/curator-earnings/PerformancePanel.tsx'
const PAGE = 'src/pages/CuratorEarningsPage.tsx'

export default [
  {
    name: '콘솔B — 막대를 다시 "적립 있는 날만" 그린다 (30일 추이가 막대 5개가 된다)',
    file: EARN,
    find: '  const slots = fillDays(stats.earnings_daily_30d || [])',
    replace: '  const slots = (stats.earnings_daily_30d || []).map((d) => ({ date: d.date, amount: d.amount }))',
    test: T,
    why:
      '이게 대표가 말한 *"차트가 밋밋하다"* 의 진짜 원인이었다. 서버는 `GROUP BY date(created_at)` 이라 ' +
      '**적립이 있는 날만** 내려주는데 종전 차트가 그걸 그대로 `map` 해서, 적립이 5일이면 막대가 5개였다 — ' +
      '30일 추이가 아니라 그냥 막대 5개다. 에러가 안 나서 몇 달간 아무도 몰랐다.',
  },
  {
    name: '콘솔B — 날짜 키를 KST 로 만든다 (오늘 적립이 내일 칸에 꽂힌다)',
    file: EARN,
    find: "  new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10)",
    replace: "  new Date(Date.now() - offsetDays * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })",
    test: T,
    why:
      '서버 `date(created_at)` 는 **UTC** 다. 화면이 KST 로 키를 만들면 09:00 KST 이전 적립이 ' +
      '전날 칸으로, 이후 적립이 다음 칸으로 밀린다 — 막대는 그려지는데 **날짜가 틀린다**. ' +
      '이 레포가 `check-utc-date-parse` 를 만들게 한 바로 그 9시간 사고 클래스다.',
  },
  {
    name: '콘솔B — 앞 절반이 0이어도 비율을 만든다 (∞% 를 화면에 띄운다)',
    file: EARN,
    find: '  if (prev <= 0) return null',
    replace: '  if (prev < 0) return null',
    test: T,
    why:
      '0 에서 늘어난 것의 증가율은 정의되지 않는다. 가드를 풀면 `Infinity%` 또는 거대한 수가 뜨고, ' +
      '첫 적립을 받은 사람(= 가장 격려가 필요한 사람)에게 하필 그 화면이 간다.',
  },
  {
    name: '콘솔B — 상품 순위의 근거(최근 30건)를 지운다 (30일 전체인 척한다)',
    file: PERF,
    find: "'최근 30건 기준'",
    replace: "'최근 30일'",
    test: T,
    why:
      '서버 `recent_earnings` 는 **LIMIT 30** 이다. 그 합산을 "30일 전체" 라고 부르면 30건을 넘긴 ' +
      '사람에게는 **틀린 합계**를 자신 있게 말하는 셈이다. 없는 정확도를 주장하지 않는다.',
  },
  {
    name: '콘솔B — 환불된 적립을 순위에 포함한다',
    file: PERF,
    find: "    if (e.status === 'refunded') continue",
    replace: "    if (e.status === 'never') continue",
    test: T,
    why:
      '환불분을 세면 순위표 합계가 위 요약(`month_earnings`, 서버가 refunded 를 뺀 값)과 **갈린다**. ' +
      '같은 화면이 두 숫자를 말하면 어느 쪽도 못 믿는다(2026-06-12 감사가 같은 이유로 서버를 고쳤다).',
  },
  {
    name: '콘솔B — 매장 줄에 공구 대행 버튼을 되살린다',
    file: PERF,
    find: "            onClick={() => onProxy({ id: s.id, name: s.business_name || `매장 #${s.id}` })}",
    replace: "            onClick={undefined}\n            value2={<button type=\"button\">공구 대행 등록</button>}",
    test: T,
    why:
      '2026-09-29 대표 확정 — 목록에 버튼을 두지 않고 **줄 전체가 그 동작**이다. ' +
      '⚠️ 다만 **동작이 사라지는 것**이 더 나쁘다(매장을 영입해 놓고 대신 올릴 길이 없어진다) — ' +
      '그래서 시험은 "버튼이 없다" 와 "onProxy 를 부른다" 를 **둘 다** 본다.',
  },
  {
    name: '콘솔B — 마이의 목록 문법으로 되돌린다',
    file: PAGE,
    find: "import EarningsPanel from './curator-earnings/EarningsPanel'",
    replace: "import { ListRow } from './user-profile/list-grammar'\nimport EarningsPanel from './curator-earnings/EarningsPanel'",
    test: T,
    why:
      '대표가 *"목록 문법 자체가 안 맞는다"* 를 직접 골랐다. 그 문법은 **마이의 메뉴**용이고 ' +
      '(아이콘 원 + 화살표) 콘솔은 **성적표**라 필요한 것이 다르다. 통일이 좋아 보여 다시 끌어오기 쉬운 자리다.',
  },
  {
    name: '콘솔B — 옛 출금 카드의 검정 그라디언트를 되살린다',
    file: EARN,
    find: '        <div className="bg-brand text-white px-4 py-4 flex items-center justify-between gap-3">',
    replace: '        <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white px-4 py-4 flex items-center justify-between gap-3">',
    test: T,
    why:
      '종전 출금 카드가 그랬다 — 팔레트 밖 값이고 확정 시스템의 **티켓 은유**(브랜드 면)를 깬다. ' +
      '`check-design-slop` 의 평면 그라디언트 클래스이기도 하다.',
  },
  {
    name: '콘솔B — 전월 비교용 새 엔드포인트를 만든다 (서버 무변경 계약 위반)',
    file: EARN,
    find: "import type { DashboardStats } from '@/features/curator/api/curator-api'",
    replace: "import { curatorApi } from '@/features/curator/api/curator-api'\nimport type { DashboardStats } from '@/features/curator/api/curator-api'\nconst _prev = () => curatorApi.getPrevMonth()",
    test: T,
    why:
      '시안의 *"지난달 대비"* 는 서버에 없는 값이다. 쿼리를 늘리는 대신 30일치를 반으로 갈라 말하기로 ' +
      '했고, 그 선택이 이 PR 을 **머니 경로 무접촉**으로 유지한다. 새 호출이 끼면 그 전제가 깨진다.',
  },
]
