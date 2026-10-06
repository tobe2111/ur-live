/**
 * 🏪 주입 — 가입 앞문 "가게부터"(안 B, 2026-09-21 대표 확정).
 *
 * `src/tests/unit/seller-signup-store-pick-2026-09-21.test.ts` 가 **실패할 수 있는지** 확인한다.
 * 이 레포가 반복해 당한 사고는 "검사가 실패한다" 가 아니라 **"검사가 실패할 수 없다"** 였다.
 * 여기 주입은 전부 **실제로 일어났던 결함의 복원**이다 — ①은 어제까지의 라이브 코드다.
 */
const TEST = 'src/tests/unit/seller-signup-store-pick-2026-09-21.test.tsx'
const PICKER = 'src/pages/seller-register/AddressPickerField.tsx'
const PAGE = 'src/pages/SellerRegisterSupplierPage.tsx'
const SECTION = 'src/pages/seller-register/StoreSection.tsx'
const META = 'src/features/seller/api/seller-signup-meta.ts'
const ROUTE = 'src/features/seller/api/seller-registration.routes.ts'

export default [
  {
    name: '가게고르기 — picker 가 주소 문자열만 꺼낸다(2026-09-20 까지의 라이브 코드)',
    file: PICKER,
    find: `                  onChange(address, {
                    name: p.place_name || '',`,
    replace: `                  onChange(address, {
                    name: '',`,
    test: TEST,
    why: '방금 고른 가게의 상호가 사라진다 — 사장님이 바로 위 칸에 손으로 다시 친다.',
  },
  {
    name: '가게고르기 — 좌표를 안 올려보낸다',
    file: PICKER,
    find: `                    lat: p.y || '',
                    lng: p.x || '',`,
    replace: `                    lat: '',
                    lng: '',`,
    test: TEST,
    why: '가입 문으로 들어온 매장이 지도에 안 뜬다(라이브에서 실제로 그랬다).',
  },
  {
    name: '가게고르기 — payload 에서 place 를 뺀다',
    file: PAGE,
    find: `        ...(place ? {
          store_phone: place.phone || undefined,`,
    replace: `        ...(false ? {
          store_phone: place?.phone || undefined,`,
    test: TEST,
    why: '화면은 카드를 보여 주는데 서버는 아무것도 못 받는다 — 에러 없이 데이터만 없다.',
  },
  {
    name: '가게고르기 — `[주소: …]` 문자열 조립 부활(읽는 코드 0건이었다)',
    file: PAGE,
    find: `        address: form.address || undefined,`,
    replace: `        address: undefined, description2: \`[주소: \${form.address}]\`,`,
    test: TEST,
    why: '주소가 다시 아무도 안 읽는 텍스트로 돌아간다.',
  },
  {
    name: '가게고르기 — 서버가 place 를 버린다(호출만 남기고 인자 제거)',
    file: ROUTE,
    find: `      kakao_place_id: body.kakao_place_id,`,
    replace: `      kakao_place_id: undefined,`,
    test: TEST,
    why: 'place_id 가 없으면 매장 등록 문의 중복 검사가 같은 가게를 못 알아본다.',
  },
  {
    name: '가게고르기 — 가게 대표번호로 담당자 휴대폰을 덮는다',
    file: META,
    find: `  if (address) {
    await db.prepare("UPDATE sellers SET address = ? WHERE id = ? AND COALESCE(address, '') = ''")`,
    replace: `  if (address) {
    await db.prepare("UPDATE sellers SET address = ?, phone = ? WHERE id = ? AND COALESCE(address, '') = ''")`,
    test: TEST,
    why: '주문·정산 알림톡이 가게 유선번호로 간다 — 사장님은 아무 알림도 못 받는다.',
  },
  {
    name: '가게고르기 — 주소를 덮어쓴다',
    file: META,
    find: `WHERE id = ? AND COALESCE(address, '') = ''"`,
    replace: `WHERE id = ?"`,
    test: TEST,
    why: '사장님이 고쳐 놓은 주소를 나중 호출이 되돌린다.',
  },
  {
    name: '가게고르기 — 좌표를 검사 없이 넣는다',
    file: META,
    find: `    const n = Number(String(v ?? '').trim())
    return Number.isFinite(n) && n !== 0 ? String(n) : undefined`,
    replace: `    const t = String(v ?? '').trim()
    return t || undefined`,
    test: TEST,
    why: '숫자가 아닌 값이 들어가면 지도가 엉뚱한 곳을 가리킨다.',
  },
  {
    name: '가게고르기 — 고른 뒤에도 가게명 칸이 남는다',
    file: SECTION,
    find: `        {!place && (
          <Field id="f-business_name"`,
    replace: `        {true && (
          <Field id="f-business_name"`,
    test: TEST,
    why: '카드가 이미 말한 상호를 또 묻는다 — 안 B 가 없앤 바로 그 중복이다.',
  },
  {
    name: '가게고르기 — 되돌릴 길을 없앤다',
    file: SECTION,
    find: `<PickedStoreCard place={place} onClear={clearPlace} />`,
    replace: `<PickedStoreCard place={place} onClear={() => {}} />`,
    test: TEST,
    why: '잘못 고른 사장님이 가입을 처음부터 다시 하거나 떠난다.',
  },
  {
    name: '가게고르기 — 매핑되면 칩을 숨긴다',
    file: SECTION,
    find: `        <Field id="f-store_category" label="매장 종류">`,
    replace: `        {!form.store_category && <Field id="f-store_category" label="매장 종류">`,
    test: TEST,
    why: '업종 매핑은 추측이다 — 숨기면 틀렸을 때 고칠 길이 없다.',
  },
  {
    name: '가게고르기 — 업종 매핑 순서를 뒤집는다(음식점이 카페를 먹는다)',
    file: 'src/shared/store-place.ts',
    find: `  [/카페|베이커리|제과|디저트|커피/, 'cafe'],`,
    replace: `  [/베이커리|제과/, 'cafe'],`,
    test: TEST,
    why: "카카오는 카페를 `음식점 > 카페 …` 로 단다 — 모든 카페가 '음식점' 이 된다.",
  },
  {
    name: '가게고르기 — 카드가 가게 전화를 안 보여 준다',
    file: 'src/pages/seller-register/PickedStoreCard.tsx',
    find: '          {place.phone && (',
    replace: '          {false && (',
    test: TEST,
    why: '카드가 대신하는 값 중 하나가 화면에서 사라진다 — 사장님이 맞는지 확인할 길이 없다.',
  },
  {
    name: '가게고르기 — 고른 뒤 담당자 연락처 칸이 사라진다',
    file: SECTION,
    find: `        <Field id="f-phone" label="연락처 (담당자 휴대폰)" required`,
    replace: `        {!place && <Field id="f-phone" label="연락처 (담당자 휴대폰)" required`,
    test: TEST,
    why: '주문·정산 알림톡을 받을 번호를 아무도 안 묻게 된다.',
  },
  {
    name: '가게고르기 — 상호를 빈 칸일 때만 채운다(카드와 제출값이 갈린다)',
    file: PAGE,
    find: `      business_name: p.name || f.business_name,`,
    replace: `      business_name: f.business_name || p.name,`,
    test: TEST,
    why: '사장님이 보는 카드는 새 가게인데 제출되는 상호는 옛 값이다 — 아무도 모른다.',
  },
]
