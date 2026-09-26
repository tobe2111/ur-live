/**
 * 🧬 내 가게 찾기(`/store/find`) PC 2단 — 되돌려-검증 주입 (2026-09-24).
 *
 * 지키는 계약은 `src/tests/unit/store-find-pc-2026-09-24.test.ts` 머리말에 있다.
 * 여기서 확인하는 것은 **그 테스트가 실제로 실패할 수 있는가** 다.
 */
const T = 'src/tests/unit/store-find-pc-2026-09-24.test.ts'
const PAGE = 'src/pages/StoreOwnerClaimPage.tsx'
const SIBLING = 'src/pages/StoreClaimPage.tsx'
const FULLBLEED = 'src/shared/pc-fullbleed.ts'

export default [
  {
    name: '🙋 PC 2단이 다시 한 칸으로 무너진다',
    file: PAGE,
    find: `        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-16">`,
    replace: `        <div className="lg:block">`,
    test: T,
    why:
      '09-21 액자 해제로 열린 1440px 을 다시 안 쓰게 된다. 폰에서는 멀쩡해 보이므로 폰만 확인하고 ' +
      '넘어가면 못 잡는다 — 이 PR 이 고친 것이 그대로 돌아간다.',
  },
  {
    name: '🙋 두 형제 문의 폭 토큰이 갈린다 (store/new ↔ store/find)',
    file: SIBLING,
    find: `lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-16`,
    replace: `lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16`,
    test: T,
    why:
      '매장 등록 문과 소유권 신청 문이 나란히 놓이면 같은 제품으로 읽혀야 한다. 한쪽만 바꾸면 ' +
      '두 문의 카드 폭이 40px 어긋나는데, 각 페이지만 열어 보면 둘 다 정상으로 보인다.',
  },
  {
    name: '🙋 설명 블록이 폰까지 펴진다 (입력 칸이 첫 화면에서 사라진다)',
    file: PAGE,
    find: `            <ol className="hidden lg:flex mt-8 flex-col gap-3.5 lg:max-w-[460px]">`,
    replace: `            <ol className="flex mt-8 flex-col gap-3.5 lg:max-w-[460px]">`,
    test: T,
    why:
      '09-23 에 store/new 에서 실측으로 배운 것 — 폰은 세로가 귀해서 단계 셋을 다 펴면 정작 ' +
      '코드·사업자번호 입력 칸이 접힌 화면 밖으로 밀린다. 에러는 안 난다.',
  },
  {
    name: '🙋 페이지가 뷰포트 높이를 잡는다 (하단 네비에 잘린다)',
    file: PAGE,
    find: `    <div className="force-light-theme min-h-[100dvh] bg-gray-50">`,
    replace: `    <div className="force-light-theme h-[100dvh] overflow-hidden bg-gray-50">`,
    test: T,
    why:
      '`main` 이 이미 `padding-bottom:56px` 로 하단 네비 자리를 예약하는데 거기에 뷰포트 높이를 또 ' +
      '얹는다 ⇒ 마지막 블록이 네비 밑으로 들어간다(09-23 에 store/new 에서 렌더로 잡은 그 결함).',
  },
  {
    name: '🙋 제목이 두 층에 겹친다 (헤더 + h1 동시)',
    file: PAGE,
    find: `      <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-gray-100">`,
    replace: `      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">`,
    test: T,
    why:
      'PC 에서 "내 가게 찾기" 가 헤더와 h1 두 곳에 동시에 뜬다. 레이아웃이 안 깨져서 소스만 보면 ' +
      '놓치기 쉽고, 우리 표면 규칙(같은 말을 두 층에 두지 않는다)에 정면으로 걸린다.',
  },
  {
    name: '🙋 PC 에서 뒤로 갈 수단이 사라진다',
    file: PAGE,
    find: `        <button onClick={() => navigate(-1)} aria-label="뒤로"\n          className="hidden lg:flex`,
    replace: `        <button onClick={() => navigate(-1)} aria-label="__gone"\n          className="hidden lg:flex`,
    test: T,
    why:
      '헤더를 lg:hidden 으로 만든 대가로 PC 뒤로가기를 왼쪽 칸이 맡는다. 그 짝이 깨지면 PC 방문자는 ' +
      '브라우저 뒤로 말고는 나갈 길이 없다 — 화면은 멀쩡해 보인다.',
  },
  {
    name: '🙋 심사를 숨기고 "바로 된다" 로 바뀐다',
    file: PAGE,
    find: `바로 넘겨드릴 수 없어요`,
    replace: `바로 넘겨드려요`,
    test: T,
    why:
      '번호 일치는 증명이 아니다(사업자번호는 공개돼 있다). 2026-08-26 에 번호만으로 자동 승인되던 ' +
      '매장 등록 경로를 이미 한 번 막았고, 이 화면이 그 사실을 숨기면 기다리는 사장님이 화를 낸다.',
  },
  {
    name: '🙋 다크 입력 글자 방어가 사라진다 (force-light-theme 소실)',
    file: PAGE,
    find: `force-light-theme min-h-[100dvh] bg-gray-50`,
    replace: `min-h-[100dvh] bg-gray-50`,
    test: T,
    why:
      '전역 `.dark input`(특이도 0,5,1)이 text-gray-900(0,1,0)을 이겨 흰 배경 위 흰 글자가 된다. ' +
      '하필 사업자번호·등록증을 넣는 칸이다.',
  },
  {
    name: '🙋 2단의 전제가 사라진다 (store/find 가 액자 안으로 되돌아감)',
    file: FULLBLEED,
    find: `'/partnership', '/store/new', '/store/find',`,
    replace: `'/partnership', '/store/new',`,
    test: T,
    why:
      '액자(430px) 안이면 2열이 펴질 자리가 없다 — 이 PR 의 레이아웃이 통째로 죽는데, 해제 목록을 ' +
      '건드린 사람은 이 페이지를 볼 이유가 없어서 조용히 지나간다.',
  },
]
