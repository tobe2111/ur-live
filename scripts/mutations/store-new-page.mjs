/**
 * 🧬 매장 등록 화면(`/store/new`) 안 B — 되돌려-검증 주입 (2026-09-23).
 *
 * 지키는 계약은 `src/tests/unit/store-new-page-2026-09-23.test.ts` 머리말에 있다.
 * 여기서 확인하는 것은 **그 테스트가 실제로 실패할 수 있는가** 다.
 */
const T = 'src/tests/unit/store-new-page-2026-09-23.test.ts'
const PAGE = 'src/pages/StoreClaimPage.tsx'
const MODAL = 'src/components/seller/StoreRegisterModal.tsx'

export default [
  {
    name: '🏪 페이지가 다시 폼만 남는다 (설명 블록 소실)',
    file: PAGE,
    find: `  { Icon: TicketStubIcon, title: '이용권을 올립니다', desc: '가격과 조건은 사장님이 정합니다' },`,
    replace: ``,
    test: T,
    why:
      '대표가 신고한 바로 그 상태로 돌아간다 — 도착한 사장님이 무엇을 등록하는 곳인지 모른 채 ' +
      '카카오맵 검색창만 본다. 에러가 안 나고 화면은 "깔끔"해 보여서 아무도 신고하지 않는다.',
  },
  {
    name: '🏪 PC 2단이 무너져 다시 한 칸이 된다 (안 B 의 요지 소실)',
    file: PAGE,
    find: `lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-16`,
    replace: `lg:block`,
    test: T,
    why:
      '2026-09-21 액자 해제로 생긴 1440px 을 다시 안 쓰게 된다. 폰에서는 멀쩡해 보이므로 ' +
      '폰만 확인하고 넘어가면 못 잡는다 — 이 PR 이 고친 문제의 절반이 그대로 돌아온다.',
  },
  {
    name: '🏪 약관 보기 링크가 버튼 아래에서 사라진다 (안내문 동의의 전제)',
    file: `src/pages/store-new/StoreConfirmStep.tsx`,
    find: `{' '}<a href="/terms/seller" target="_blank" rel="noopener noreferrer" className="underline">약관 보기</a>`,
    replace: ``,
    test: T,
    why:
      '기본값 overlay 로 떨어져 `fixed inset-0 bg-black/40` 이 돌아온다. 1440px 어두운 빈 들판에 ' +
      '512px 카드 — 대표가 본 그 화면이다. 게다가 왼쪽 설명이 오버레이 뒤로 가려 읽히지 않는다.',
  },
  {
    name: '🏪 대시보드 모달이 오버레이를 잃는다 (overlay 가지 파손)',
    file: MODAL,
    find: `    : 'fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4'`,
    replace: `    : 'w-full'`,
    test: T,
    why:
      'page 만 고치려다 overlay 까지 건드리는 실수. `MyStoresPanel` 에서 열던 모달이 겹쳐 뜨지 않고 ' +
      '목록 사이에 끼어 들어간다 — 이 PR 과 무관한 화면이 조용히 깨진다.',
  },
  {
    // 🔁 2026-11-03 재조준: 이제 페이지가 화면 높이를 잡는 게 **정답**이다(하단 탭을 숨겼으므로). 결함은 탭이 돌아오는 것.
    name: '🏪 하단 탭이 위저드 위로 돌아온다 (버튼이 탭 뒤로 · 화면 높이가 탭만큼 잘린다)',
    file: 'src/lib/consumer-chrome.ts',
    find: `export const fullScreenExactPaths = ['/influencer', '/store/new', '/store/first-voucher']`,
    replace: `export const fullScreenExactPaths = ['/influencer', '/store/first-voucher']`,
    test: T,
    why:
      '페이지는 `h-dvh` 로 화면 높이를 잡는데 그 위에 탭(57px)이 다시 덮이면 [다음] 버튼이 탭 뒤로 숨는다 — ' +
      '대표가 2026-11-03 신고한 바로 그 화면이다.',
  },
  {
    name: '🏪 등록 카드가 높이 바운드를 잃는다 (지도가 0px 로 접힌다)',
    file: MODAL,
    find: `flex flex-col flex-1 min-h-0 lg:flex-none lg:h-[min(760px,88dvh)]`,
    replace: `flex flex-col`,
    test: T,
    why:
      '`KakaoMapPicker fill` 은 `flex-1 min-h-0` 사슬로 높이를 받는데, 조상 어디에도 바운드가 없으면 ' +
      '0px 이 된다 — 1단계에서 **지도가 아예 안 보인다**. 콘솔 에러는 없다.',
  },
  {
    name: '🏪 ✕ 가 다시 둘이 된다 (페이지 하나, 카드 하나)',
    file: PAGE,
    find: `      <SEO title="매장 이용권 판매 등록 - 유어딜"`,
    replace: `      <button type="button" onClick={goBack} aria-label="닫기">x</button>\n      <SEO title="매장 이용권 판매 등록 - 유어딜"`,
    test: T,
    why:
      '같은 일을 하는 닫기 버튼이 한 화면에 둘이 뜬다. 레이아웃이 안 깨져서 소스만 보면 못 잡고, ' +
      '렌더해야 보인다(실제로 그렇게 발견했다).',
  },
  {
    name: '🏪 수수료율을 숫자로 약속한다 (실측 안 한 값)',
    file: PAGE,
    find: `  { value: '0원', label: '등록 비용' },`,
    replace: `  { value: '수수료 5%', label: '판매 수수료' },`,
    test: T,
    why:
      '채널별 요율(직접 10% / 중개 5%)을 라이브 실측하지 않았다. 틀린 숫자는 사장님에게 한 **약속**이 ' +
      '되고, 등록 화면에 적힌 요율은 나중에 분쟁 근거가 된다.',
  },
  {
    name: '🏪 페이지가 4단계 문구를 스스로 갖기 시작한다 (부품 포크의 첫 걸음)',
    file: PAGE,
    find: `  { Icon: ReceiptIcon, title: '주문과 정산을 한 곳에서 봅니다', desc: '누가 언제 썼는지, 얼마가 들어오는지' },`,
    replace: `  { Icon: ReceiptIcon, title: '내 매장을 찾아주세요', desc: '누가 언제 썼는지, 얼마가 들어오는지' },`,
    test: T,
    why:
      '단계 문구가 페이지와 모달 두 곳에 생기는 순간부터 갈린다. 이 파일 안에서 이미 한 번 그렇게 ' +
      '갈렸다(2026-09-07 `taken` 화면이 같은 날 수리 둘을 못 받았다).',
  },
  {
    name: '🏪 입력칸에 흰 바탕이 돌아온다 (다크에서 흰 바탕 위 흰 글자) (force-light-theme 소실)',
    file: `src/pages/store-new/StoreFindStep.tsx`,
    find: `className="flex-1 min-w-0 bg-transparent border-0 outline-none focus-visible:outline-none text-[16px] text-gray-900 dark:text-white placeholder:text-ink-faint" />`,
    replace: `className="flex-1 min-w-0 bg-white border-0 outline-none focus-visible:outline-none text-[16px] text-gray-900 dark:text-white placeholder:text-ink-faint" />`,
    test: `src/tests/unit/store-register-wizard.test.ts`,
    why:
      '전역 `.dark input`(특이도 0,5,1)이 `text-gray-900`(0,1,0)을 이겨 흰 배경 위 흰 글자가 된다 ' +
      '(2026-09-07 실측 1.09:1). 하필 매장 유치 퍼널의 첫 입력칸이다.',
  },
]
