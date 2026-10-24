/**
 * 💸 매장 후보 upsert 조건부화 (2026-10-24) — 주입 매니페스트.
 *
 * 이 조가 막는 것은 **쓰기 예산을 새 리드 0건인 재기록이 다시 먹는 것**이다(라이브 실측: 그날
 * 유어애즈 쓰기의 35%). 그리고 반대 방향 — 쓰기를 아끼려다 **변화를 조용히 놓치는 것** — 도 함께 막는다.
 *
 * 가드: src/tests/unit/prospect-upsert-conditional-2026-10-24.test.ts
 */
const TEST = 'src/tests/unit/prospect-upsert-conditional-2026-10-24.test.ts'
const SRC = 'src/features/marketing/api/store-prospects.ts'

export default [
  {
    name: '매장후보upsert 💸 조건 없는 DO UPDATE 로 되돌아간다(값이 같아도 매 회차 전량 재기록)',
    file: SRC,
    find: "         WHERE store_prospects.biz_name IS NOT excluded.biz_name",
    replace: "         WHERE 1=1 -- (조건 제거)\n            AND store_prospects.biz_name IS NOT excluded.biz_name",
    test: TEST,
    why: '라이브에서 이 조건이 없어 `collect-neis` 가 하루 328,794 쓰기(예산의 35%)를 태우고 신규 리드는 0건이었다. 그 예산은 대표 확정 "$5 이상 넘으면 절대 안돼" 에 묶여 월 포함분에서 역산되므로, 재기록은 이메일 보강처럼 값을 만드는 레인의 몫을 빼앗는다.',
  },
  {
    name: '매장후보upsert 🕳️ WHERE 가 SET 을 덜 덮는다(biz_name 변화를 조용히 놓친다)',
    file: SRC,
    find: "         WHERE store_prospects.biz_name IS NOT excluded.biz_name\n            OR store_prospects.trd_state IS NOT excluded.trd_state",
    replace: "         WHERE store_prospects.trd_state IS NOT excluded.trd_state",
    test: TEST,
    why: '이 수리의 가장 위험한 회귀다 — 한 컬럼이 WHERE 에서 빠지면 그 변화가 **에러 없이** 반영되지 않는다. 상호가 바뀐 가게가 옛 이름으로 영구히 남는다.',
  },
  {
    name: '매장후보upsert 🗓️ 하루 1회 재검증 도장이 사라진다(is_new_open 이 날짜가 지나도 안 갱신된다)',
    file: SRC,
    find: "            OR store_prospects.last_verified_at < datetime('now', '-1 day')",
    replace: '',
    test: TEST,
    why: '`is_new_open` 은 `todayYmd` 기준이라 날이 지나면 1 → 0 으로 바뀌어야 한다. 이 항이 없으면 값이 같은 행은 영영 UPDATE 되지 않아 **한 달 전 개업이 계속 신규 개업으로 뜬다**.',
  },
  {
    name: '매장후보upsert 🔢 반환값이 다시 "보낸 개수"가 된다(total_saved 가 32배 부풀어 신규 0건을 가린다)',
    file: SRC,
    find: "    if (res) saved += res.reduce((n, r) => n + (r?.meta?.changes ?? 0), 0)",
    replace: "    if (res) saved += slice.length",
    test: TEST,
    why: '라이브 `total_saved` 가 4,549,277 인데 실제 행은 140,635 였다(32배). 그 숫자가 "수집이 잘 된다"고 말해서, 하루 쓰기 328,794 를 태우고 **신규가 0건인 것을 아무도 못 봤다** — 이 조사에서 32배 격차가 유일한 단서였다.',
  },
  {
    name: '매장후보upsert 📉 이메일 보강 1단계가 홈페이지 없는 34.7만 건까지 크롤한다',
    file: 'src/features/marketing/api/prospect-enrich.ts',
    find: "WHERE active = 1 AND website IS NOT NULL AND website != '' AND (email IS NULL OR email = '')",
    replace: "WHERE active = 1 AND (email IS NULL OR email = '')",
    test: TEST,
    why: '라이브 실측 — 매장 353,228건 중 홈페이지 보유가 6,784(1.9%)뿐이다. 조건이 빠지면 크롤할 대상이 **아예 없는** 34.7만 건을 돌며 회차 예산을 통째로 태운다(수율 0). 그리고 에러가 안 난다.',
  },
  {
    // ⚠️ 주입 대상이 **가드 자신**이다 — 지키려는 것은 "파싱이 깨지면 조용히 통과하지 않는다" 이고,
    //   그걸 재려면 파싱을 깨뜨려야 한다. 하한(`toBeGreaterThanOrEqual(10)`)만 지우는 주입은
    //   **행동을 안 바꾼다**(파싱이 여전히 안 비므로 결과가 같다 — 실제로 그렇게 써서 한 번 헛돌았다).
    name: '매장후보upsert 🚪 SET 컬럼 파싱이 깨져도 ① 이 통과한다(측정 0 = 통과)',
    file: TEST,
    find: "  const cols = [...set.matchAll(/^\\s*([a-z_]+)\\s*=/gm)].map(m => m[1]!)",
    replace: "  const cols = [...set.matchAll(/^__never__([a-z_]+)=/gm)].map(m => m[1]!)",
    test: TEST,
    why: '①은 파싱한 컬럼 목록을 순회한다. 목록이 비면 루프가 아무것도 안 보고 초록이 뜬다 — 이 레포가 반복해 만난 "측정 0 = 통과" 클래스. 하한이 그걸 잡아야 한다.',
  },
]
