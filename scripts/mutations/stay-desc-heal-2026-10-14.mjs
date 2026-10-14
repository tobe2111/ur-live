/**
 * 🏨 2026-10-14 — 숙소 소개 문구 치유 주입.
 *
 * 근거·실측은 `src/shared/stay-property-type.ts` 의 `STAY_PROPERTY_TYPE_DESCS` 머리말,
 * 못 보는 것은 `src/tests/unit/stay-desc-heal-wired-2026-10-14.test.ts` 머리말.
 *
 * 🔴 **반대 방향이 섞여 있다.** 이 치유는 **프로덕션 DB 에 쓴다** — 대상 조건이 느슨해지면
 *    사장님이 손으로 쓴 소개를 덮고, 그건 되돌릴 수 없다(이득보다 손실이 훨씬 크다).
 */
const SSOT = 'src/shared/stay-property-type.ts'
const HEAL = 'src/features/admin/api/admin-stays/heal-stay-descriptions.ts'
const CRON = 'src/worker/cron/scheduled-cleanup-daily.ts'
const SEED = 'src/features/admin/api/admin-stays.routes.ts'
const TEST = 'src/tests/unit/stay-desc-heal-wired-2026-10-14.test.ts'
const T = '🏨 숙소 문구 — '

export default [
  {
    name: `${T}치유가 도는 경로에서 빠진다 (2026-08-31~10-14 상태)`,
    file: CRON,
    find: '    const n = await healStayDescriptions(DB as never, STAY_TYPE_DESC_LIST);',
    replace: '    const n = 0;',
    test: TEST,
    why:
      '라이브 실측: 색인 대상 표본 79건 중 **74건(93%)**의 meta description 에 줄표가 있었고 숙소 49건은 ' +
      '`춘천의 호텔 — 접근성 좋은 호텔 — …` 그대로였다. 치유 코드는 있었는데 **호출처가 어드민 재시드 ' +
      'POST 하나**뿐이라 한 번도 안 돌았다 — "코드에 있다 ≠ 살아 있다".',
  },
  {
    name: `${T}반대 방향 — 데모 한정 조건을 없앤다 (수기 문구를 덮는다)`,
    file: HEAL,
    find: "        WHERE p.slug LIKE 'demo-stay-%'\n          AND (p.description LIKE '%—%' OR psi.description_full LIKE '%—%')",
    replace: "        WHERE (p.description LIKE '%—%' OR psi.description_full LIKE '%—%')",
    test: TEST,
    why:
      '**이 방향이 훨씬 비싸다.** 이 치유는 프로덕션 DB 에 쓴다 — 데모 한정이 빠지면 사장님이 손으로 ' +
      '쓴 소개를 유형별 기본 문구로 덮고, 그건 되돌릴 수 없다.',
  },
  {
    name: `${T}줄표 지문 조건을 없앤다 (멱등이 깨진다)`,
    file: HEAL,
    find: "          AND (p.description LIKE '%—%' OR psi.description_full LIKE '%—%')",
    replace: '',
    test: TEST,
    why:
      '새 문구엔 줄표가 없으므로 그 지문이 **멱등성의 근거**다. 없애면 매일 모든 데모 숙소를 다시 쓰고, ' +
      '어드민이 데모 문구를 손본 것도 매일 되돌린다.',
  },
  {
    name: `${T}선택이 description 한 칸만 본다 (2026-09-14 사고 재현)`,
    file: HEAL,
    find: "(p.description LIKE '%—%' OR psi.description_full LIKE '%—%')",
    replace: "(p.description LIKE '%—%')",
    test: TEST,
    why:
      '화면의 *숙소 소개* 가 읽는 칸은 `description_full` 이다. 선택이 `description` 하나만 보면 그 칸이 ' +
      '고쳐진 순간 행이 **영영 다시 안 걸려** `description_full` 은 손댈 기회조차 없다 — 라이브가 ' +
      '정확히 그 상태였다(description 빈 문자열 · description_full 옛 문장).',
  },
  {
    name: `${T}화면이 읽는 칸을 안 고친다`,
    file: HEAL,
    find: "        `UPDATE product_stay_info SET description_full = ? WHERE product_id = ?`",
    replace: "        `UPDATE product_stay_info SET description_full = description_full WHERE product_id = ?`",
    test: TEST,
    why: '같은 사고의 다른 얼굴 — *아무도 안 보는 칸*만 고치고 반환값은 "N건 고침" 이라 성공처럼 보인다.',
  },
  {
    name: `${T}문구에 줄표를 되돌린다`,
    file: SSOT,
    find: "  hotel: '역과 시내에서 가까워 이동이 편합니다.",
    replace: "  hotel: '접근성 좋은 호텔 — 역과 시내에서 가까워 이동이 편합니다.",
    test: TEST,
    why:
      '이 문구는 색인 대상 49건의 **meta description** 이 된다. 줄표는 가장 많이 지적되는 AI 티이고 ' +
      '(`anti-slop` 스킬 §1), 대표가 2026-08-31 에 지적한 문장이 정확히 그 모양이었다.',
  },
  {
    name: `${T}문구가 유형 이름을 두 번 말한다`,
    file: SSOT,
    find: "  glamping: '장비를 챙길 필요가 없는 글램핑입니다.",
    replace: "  glamping: '장비 없이 즐기는 글램핑, 편하게 쉬는 글램핑입니다.",
    test: TEST,
    why:
      '대표가 지적한 문장의 다른 반쪽이 **반복**이었다(한 문장에 "호텔" 둘). 서버 메타는 그 앞에 ' +
      '이미 `강원 춘천시 호텔 ·` 을 붙이므로 문구가 또 말하면 검색결과에서 세 번 보인다.',
  },
  {
    name: `${T}시드가 문구를 다시 손으로 적는다 (두 벌)`,
    file: SEED,
    find: "desc: propertyTypeDesc('hotel') },",
    replace: "desc: '역과 시내에서 가까워 이동이 편합니다. 룸 컨디션이 깔끔하고 프런트는 24시간 운영해요.' },",
    test: TEST,
    why:
      '시드와 치유가 **같은 표**를 읽어야 새로 만든 숙소와 고친 숙소의 문구가 같다. 손으로 적으면 ' +
      '한쪽만 바뀌는 날이 오고, 그게 이 결함의 뿌리였다(값이 어드민 라우트에만 있어 cron 이 못 썼다).',
  },
  {
    name: `${T}모르는 유형을 건너뛴다 (옛 문장이 남는다)`,
    file: SSOT,
    find: '  return STAY_PROPERTY_TYPE_DESCS[key] || STAY_PROPERTY_TYPE_DESCS.hotel!',
    replace: "  return STAY_PROPERTY_TYPE_DESCS[key] || ''",
    test: TEST,
    why:
      '빈 문구를 돌려주면 치유가 그 행을 **빈 문자열로** 덮거나(더 나쁨) 건너뛴다. `motel`·`villa`·' +
      '`camping` 은 라벨 표에 있는데 문구 표엔 없으므로 폴백이 실제로 쓰인다.',
  },
  {
    name: `${T}고친 횟수를 버린다`,
    file: CRON,
    find: '    if (n > 0) results.stay_desc_healed = n;',
    replace: '    void n;',
    test: TEST,
    why:
      '횟수를 안 실으면 **"돌았는데 0건"과 "안 돌았음"을 구분할 수 없다** — 그 파일이 `amenityHealed` 에서 ' +
      '실제로 치른 교훈이고, 이 결함이 2026-08-31~10-14 동안 안 보였던 이유도 그 구분이 없었기 때문이다.',
  },
]
