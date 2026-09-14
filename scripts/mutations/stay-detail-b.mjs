/**
 * 🧬 주입 매니페스트 — 숙소 이용권 상세 안 B (2026-09-14)
 *
 * 대표 확정: *"안 B로 해주고, 고칠 것 다 고쳐줘. 두 상세가 같은 부품을 쓰도록 해줘."*
 * 지키려는 성질마다 "그걸 깨는 가장 그럴듯한 되돌림"을 하나씩 심는다.
 * 초록이 뜨면 그 가드는 헛돌고 있는 것이다.
 */
const TEST = 'src/tests/unit/stay-detail-b.test.ts'
const ADDR = 'src/shared/stay-address.ts'
const STAY = 'src/pages/StayDetailPage.tsx'
const PICKER = 'src/pages/stay-detail/StayDateGuestPicker.tsx'
const BOX = 'src/pages/group-buy/DealPurchaseBox.tsx'
const CSS = 'src/index.css'
const HEAL = 'src/features/admin/api/admin-stays/heal-stay-descriptions.ts'

export default [
  {
    name: '📍 주소에 지역을 다시 이어 붙인다 (대표 스크린샷의 중복)',
    file: ADDR,
    find: `  const a = (address || '').trim()
  if (a) return a
  return [sido, sigungu].map((s) => (s || '').trim()).filter(Boolean).join(' ')`,
    replace: `  const a = (address || '').trim()
  return [sido, sigungu, a].map((s) => (s || '').trim()).filter(Boolean).join(' ')`,
    test: TEST,
    why: '주소 항목이 이미 지역을 담고 있다(라이브 50/50). 이어 붙이면 중복이고, 12건은 지역이 아예 달라 틀린 주소가 된다.',
  },
  {
    name: '📍 상세가 SSOT 를 안 거치고 직접 이어 붙인다',
    file: STAY,
    find: '<span>{stayAddressLine(stay.region_sido, stay.region_sigungu, stay.address)}</span>',
    replace: '<span>{stay.region_sido} {stay.region_sigungu} · {stay.address}</span>',
    test: TEST,
    why: '판정을 화면마다 손으로 다시 쓰면 한 곳만 고쳐지고 카드와 상세가 다른 지역을 말한다.',
  },
  {
    name: '🎫 안 B 가 옛 테두리 트리거로 되돌아간다',
    file: PICKER,
    find: '      <FieldCard>',
    replace: '      <div className="h-12 rounded-xl border">',
    test: TEST,
    why: '테두리 세 겹으로 되돌아간다 — 대표가 지적한 바로 그 모습이다.',
  },
  {
    name: '🎫 가운데 배지가 박수를 말하지 않는다',
    file: PICKER,
    find: 'badge={`${nightsBetween(checkIn, checkOut)}박`}',
    replace: 'badge={"숙박"}',
    test: TEST,
    why: '배지가 박수를 말하므로 다른 줄에서 또 말할 필요가 없다. 고정 문구가 되면 그 근거가 사라진다.',
  },
  {
    name: '🎫 카드 바깥에 테두리 상자가 되돌아온다 (판정에서 잡힌 결함)',
    file: STAY,
    find: `    <div className={isVoucherMode
      ? 'bg-white dark:bg-[#1D1F29] rounded-2xl p-4 shadow-lift'
      : ''}>`,
    replace: '    <div className="bg-white dark:bg-[#11141C] border border-gray-200 dark:border-[#2C2F35] rounded-xl p-4 shadow-sm">',
    test: TEST,
    why: '트리거 테두리만 걷고 바깥 래퍼를 남기면 화면엔 여전히 상자가 두 겹이다 — 유닛은 초록인데 눈에는 보인다.',
  },
  {
    name: '🎫 시각 각주가 값 없이도 그려진다 (모르는 값을 지어낸다)',
    file: PICKER,
    find: '{checkInTime && checkOutTime ? (',
    replace: '{true ? (',
    test: TEST,
    why: '값이 없으면 "체크인 undefined" 가 찍힌다. 모르는 값은 안 쓰는 것이 이 레포의 규칙이다.',
  },
  {
    name: '🔁 박수·시각을 카드 밖에서 또 말한다',
    file: STAY,
    find: '            checkInTime={stay.check_in_time}',
    replace: '            data-dup={`${nights}박 · 체크인 ${stay.check_in_time}`}\n            checkInTime={stay.check_in_time}',
    test: TEST,
    why: '같은 값을 두 자리에서 말하면 나중에 한쪽만 고쳐져 서로 어긋난다.',
  },
  {
    name: '🧩 공구 상세가 공유 부품을 버린다',
    file: BOX,
    find: '          <FieldRow',
    replace: '          <div data-was="FieldRow"',
    test: TEST,
    why: '두 상세가 같은 부품을 쓰는 것이 이번 변경의 요지다 — 갈라지면 다음에 또 따로 논다.',
  },
  {
    name: '🧩 .gbd 가 다시 자기 hex 를 갖는다 (두 번째 토큰 세트 부활)',
    file: CSS,
    find: '  --gbd-card: var(--surface);',
    replace: '  --gbd-card: #141517;',
    test: TEST,
    why: '두 번째 토큰 세트가 부활하면 다크에서 두 상세가 다시 다른 앱처럼 보인다.',
  },
  {
    name: '🧩 정의된 적 없던 --gbd-line 이 다시 사라진다',
    file: CSS,
    find: '  --gbd-line: var(--rule);\n',
    replace: '',
    test: TEST,
    why: '값이 없으면 border 선언이 통째로 무효가 되어 헤어라인이 글자색 진한 선으로 그려진다.',
  },
  {
    name: '🧩 옅은 면 토큰이 라이트에만 남는다',
    file: CSS,
    find: '    --wash: rgb(255 255 255 / 0.06);',
    replace: '    /* wash 다크 제거됨 */',
    test: TEST,
    why: '다크에만 없으면 카드 위 칩이 안 보인다 — 한쪽 테마만 깨지는 전형이다.',
  },
  {
    name: '📝 치유가 다시 보이지 않는 칸만 고친다',
    file: HEAL,
    find: '        `UPDATE product_stay_info SET description_full = ? WHERE product_id = ?`',
    replace: '        `UPDATE product_stay_info SET amenities = amenities WHERE product_id = ?`',
    test: TEST,
    why: '화면의 숙소 소개가 읽는 칸은 description_full 이다. 다른 칸만 고치면 성공을 보고하고도 화면은 그대로다.',
  },
  {
    name: '📝 치유 대상이 다시 description 한 칸으로 좁아진다',
    file: HEAL,
    find: "          AND (p.description LIKE '%—%' OR psi.description_full LIKE '%—%')",
    replace: "          AND p.description LIKE '%—%'",
    test: TEST,
    why: 'description 이 고쳐진 순간 그 행이 영영 다시 안 뽑힌다 — description_full 은 손댈 기회조차 없다.',
  },
]
