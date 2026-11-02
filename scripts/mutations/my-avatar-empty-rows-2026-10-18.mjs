// 👤 마이 점검 — 프로필 폴백 유달이 · PC 빈 카드 · 쇼핑 숨김 동안 빈 화면 두 줄 (2026-10-18)
const TEST = 'src/tests/unit/my-avatar-empty-rows-2026-10-18.test.ts'

export default [
  {
    name: '👤 마이 점검: 프로필 폴백이 다시 외부 ui-avatars 로',
    file: 'src/pages/user-profile/profile-avatar.ts',
    find: "  return image ? cfImage(image, { width }) : PROFILE_FALLBACK_SRC",
    replace: "  return image ? cfImage(image, { width }) : `https://ui-avatars.com/api/?name=u&size=${width}`",
    test: TEST,
    why: '외부 요청이 실패하면 이름 왼쪽이 빈 칸이 되고, 요청 주소에 사용자 이름이 실려 외부로 나간다.',
  },
  {
    name: '👤 마이 점검: 사진 실패 시 유달이 대신 숨긴다',
    file: 'src/pages/user-profile/profile-avatar.ts',
    find: "    img.src = PROFILE_FALLBACK_SRC\n    img.style.objectFit = 'contain'",
    replace: "    img.style.visibility = 'hidden'",
    test: TEST,
    why: '숨기면 그 자리가 빈 칸이 된다 — 하네스 실측으로 폰·PC 둘 다 그랬다.',
  },
  {
    name: '👤 마이 점검: PC 빈 카드 접기를 지운다',
    file: 'src/pages/user-profile/AccountPcPane.tsx',
    // 🔁 2026-10-19 재조준: 접는 판정이 '곧 쓸 이용권 0줄' 로 바뀌었다(이용권 현황 제거). 불변식 그대로.
    find: "  if (soon.length === 0) return null\n",
    replace: "",
    test: TEST,
    why: '이용권을 안 산 사람(대부분)에게 PC 오른쪽 위에 내용 없는 흰 카드가 뜬다.',
  },
  {
    name: '👤 마이 점검: 관심 맛집 줄이 쇼핑 숨김과 무관하게 다시 뜬다',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "    ...(SHOPPING_TAB_HIDDEN ? [] : [{ Icon: BellIcon, label: t('shopping.interestList', { defaultValue: '관심 맛집' }), path: '/interest-list' }]),",
    replace: "    { Icon: BellIcon, label: t('shopping.interestList', { defaultValue: '관심 맛집' }), path: '/interest-list' },",
    test: TEST,
    why: '관심 등록 버튼은 숨겨진 쇼핑 목록에만 있다 — 줄을 누르면 늘 빈 화면이다.',
  },
  {
    name: '👤 마이 점검: 쓰이는 줄(숙소 예약)까지 같이 감춘다',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    // 🔁 2026-11-02 재조준: 쿠폰함 줄은 대표 지시(중복)로 뺐다 — 같은 불변식을 쓰이는 다른 줄로 본다.
    find: "    { Icon: StayLineIcon, label: t('shopping.myStays', { defaultValue: '내 숙소 예약' }), path: '/my-stays' },",
    replace: "    ...(SHOPPING_TAB_HIDDEN ? [] : [{ Icon: StayLineIcon, label: t('shopping.myStays', { defaultValue: '내 숙소 예약' }), path: '/my-stays' }]),",
    test: TEST,
    why: '반대 방향 — 쿠폰은 라이브에 활성 쿠폰이 있어 살아 있다. 정리를 이유로 쓰이는 줄을 같이 지우면 안 된다.',
  },
  {
    name: '👤 마이 점검: PC "가게 열기" 가 다시 카드 밖으로',
    file: 'src/pages/user-profile/RoleCtaGrid.tsx',
    find: '    <section className="w-full min-w-0 ur-content-medium lg:px-4 ur-pc-card">',
    replace: '    <section className="w-full min-w-0 ur-content-medium lg:px-4">',
    test: TEST,
    why: 'PC 마이 B 는 모든 블록이 카드다 — 이 구역만 바탕에 떠 있었다.',
  },
  {
    name: "👤 마이 점검: 상품 주문이 있는 사람의 '상품' 칸까지 감춘다",
    file: 'src/components/mypage/OrdersTab.tsx',
    find: "    ...(SHOPPING_TAB_HIDDEN && counts.product === 0 ? [] : [{ key: 'product' as const,",
    replace: "    ...(SHOPPING_TAB_HIDDEN ? [] : [{ key: 'product' as const,",
    test: TEST,
    why: '예전에 배송 상품을 산 사람은 그 주문만 걸러 볼 길을 잃는다 — 감추는 건 늘 0건일 때만.',
  },
]
