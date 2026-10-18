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
    find: "  if (vouchers !== undefined && !((vouchers ?? []) as MyVoucher[]).some(isStoreVoucher)) return null\n",
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
    name: '👤 마이 점검: 쓰이는 줄(쿠폰함)까지 같이 감춘다',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "    { Icon: CouponIcon, label: t('shopping.coupons', { defaultValue: '쿠폰함' }), count: counts.coupon, path: '/my-coupons' },",
    replace: "    ...(SHOPPING_TAB_HIDDEN ? [] : [{ Icon: CouponIcon, label: t('shopping.coupons', { defaultValue: '쿠폰함' }), count: counts.coupon, path: '/my-coupons' }]),",
    test: TEST,
    why: '반대 방향 — 쿠폰은 라이브에 활성 쿠폰이 있어 살아 있다. 정리를 이유로 쓰이는 줄을 같이 지우면 안 된다.',
  },
]
