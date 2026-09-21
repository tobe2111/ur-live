/**
 * 🏪 셀러 가입 화면 — 안 2 + 시각 C 의 되돌려-검증 (2026-09-16 대표 확정)
 * 시험: src/tests/unit/seller-signup-c-2026-09-16.test.ts · 시안: docs/design/seller-signup-documents.md
 */
const TEST = 'src/tests/unit/seller-signup-c-2026-09-16.test.ts'

export default [
  {
    name: '가입C — 남은-것 목록이 사라진다(대표 "다 떠야 하는거 아니야?" 회귀)',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: "t('seller.signup.laterPermit', { defaultValue: '영업신고증' })",
    replace: "t('seller.signup.laterCert', { defaultValue: '사업자등록증' })",
    test: TEST,
    why: '대표가 신고한 바로 그 결함이다 — 영업신고증·정산 계좌가 이름조차 안 뜨면 사장님은 필수 5칸을 다 채우고도 왜 승인이 안 나는지 모른다.',
  },
  {
    name: '가입C — 남은-것이 첨부를 강제한다(당근 모델 회귀)',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    // 🔀 2026-09-16 재조준 — 제출 버튼이 `submit` 대신 확인 시트(`review`)를 연다.
    find: '<button onClick={review} disabled={loading}',
    replace: '<button onClick={review} disabled={loading || !certUrl}',
    test: TEST,
    why: '같은 날 확정한 당근 모델(대기·반려도 들여보낸다)과 정면으로 어긋난다 — 이름만 보여 주고 첨부는 안에서 받는 것이 이 안의 핵심이다.',
  },
  {
    name: '가입C — 입력이 작아진다(채운 칸과 빈 칸이 같은 무게로 회귀)',
    file: 'src/pages/seller-register/RegisterFields.tsx',
    find: "'min-h-[34px] w-full border-0 bg-transparent p-0 text-[17px] font-bold",
    replace: "'min-h-[34px] w-full border-0 bg-transparent p-0 text-[13px] font-bold",
    test: TEST,
    why: '시각 C 의 전부가 "채운 값을 크게" 다 — 작아지면 빈 칸과 채운 칸이 같은 무게라 어디까지 했는지가 안 보인다(대표가 별로라고 한 그 상태).',
  },
  {
    name: '가입C — 포커스 신호가 사라진다(키보드 사용자가 위치를 잃는다)',
    file: 'src/pages/seller-register/RegisterFields.tsx',
    find: 'group-focus-within:opacity-100',
    replace: 'opacity-0',
    test: TEST,
    why: '상자 테두리를 없앴으므로 포커스가 유일한 위치 신호다 — 꺼지면 키보드 사용자가 자기가 어느 칸에 있는지 알 수 없다(접근성 회귀).',
  },
  {
    name: '가입C — 컴포넌트 라벨이 다시 겹친다("(선택)" 이 다른 문으로 되살아난다)',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    // 🔀 2026-09-16 재조준 — OCR 로 `onRead` 가 붙었다. `hideLabel` 만 떼는 형태로 좁힌다.
    find: 'hideLabel onRead={applyOcr} />',
    replace: 'onRead={applyOcr} />',
    test: TEST,
    why: '렌더 실측으로 잡은 결함이다 — Field 라벨 아래 컴포넌트 라벨이 또 떠서 대표가 빼라고 한 "(선택)" 이 다른 문으로 되살아난다.',
  },
  {
    name: '가입C — 손 타이핑으로 회귀(대표 "자동으로 API로 입력")',
    file: 'src/pages/SellerRegisterSupplierPage.tsx',
    find: '<AddressPickerField id="f-address" value={form.address} onChange={set(\'address\')} />',
    replace: '<input id="f-address" value={form.address} onChange={e => set(\'address\')(e.target.value)} className={cls(\'address\')} />',
    test: TEST,
    why: '대표 지시 "주소지는 자동으로 API로 입력하게끔" 의 회귀 — 그리고 매장 등록 모달은 이미 검색으로 채우므로 두 문이 다시 갈린다.',
  },
  {
    name: '가입C — 지도를 상시 로드(폼에 카카오 SDK 를 싣는다)',
    file: 'src/pages/seller-register/AddressPickerField.tsx',
    find: "const KakaoMapPicker = lazy(() => import('@/components/KakaoMapPicker'))",
    replace: "import KakaoMapPicker from '@/components/KakaoMapPicker'",
    test: TEST,
    why: '이 화면은 폼이지 지도가 아니다 — 상시 로드면 가입하러 온 모든 사장님이 카카오 지도 SDK 를 내려받는다.',
  },
]
