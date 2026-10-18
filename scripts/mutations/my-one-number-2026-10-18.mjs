/**
 * 🔢 2026-10-18 — 마이 같은 숫자 한 곳(대표 *"같은 숫자 하나로 줄여줘"*).
 * 가드: `src/tests/unit/my-one-number-one-place-2026-10-18.test.ts`
 */
const TEST = 'src/tests/unit/my-one-number-one-place-2026-10-18.test.ts'

export default [
  {
    name: '🔢 한 곳: 숫자 줄에 교환권 칸이 돌아온다',
    file: 'src/pages/user-profile/MyStats.tsx',
    find: '      <Cell compact={inline} label="쿠폰" to="/my-coupons" value={coupon} />',
    replace: '      <Cell compact={inline} label="교환권" to="/my-gifticons" value={coupon} />\n      <Cell compact={inline} label="쿠폰" to="/my-coupons" value={coupon} />',
    test: TEST,
    why: '교환권 장수가 숫자 줄과 목록에서 두 번 서고, 폰·PC 칸 수가 다시 갈린다.',
  },
  {
    name: "🔢 한 곳: '내 이용권' 줄이 다시 숫자를 단다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "defaultValue: '내 이용권' }), path: '/my-vouchers' },",
    replace: "defaultValue: '내 이용권' }), count: counts.voucher, path: '/my-vouchers' },",
    test: TEST,
    why: '같은 이용권 장수가 한 화면에 다시 두 번 선다 — 대표가 지적한 그 모양.',
  },
  {
    name: "🔢 한 곳: '쿠폰함' 줄이 다시 숫자를 단다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "defaultValue: '쿠폰함' }), path: '/my-coupons' },",
    replace: "defaultValue: '쿠폰함' }), count: counts.coupon, path: '/my-coupons' },",
    test: TEST,
    why: '쿠폰 장수가 숫자 줄과 목록에서 두 번 선다.',
  },
  {
    name: "🔢 한 곳(반대 방향): '내 교환권' 줄의 숫자까지 지운다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "count: counts.gifticon, path: '/my-gifticons' },",
    replace: "path: '/my-gifticons' },",
    test: TEST,
    why: '교환권 숫자의 유일한 자리다 — 정리를 이유로 지우면 교환권이 몇 장인지 마이 어디에도 없다.',
  },
  {
    name: "🔢 한 곳: 이용권 현황에 '사용가능' 칸이 돌아온다",
    file: 'src/pages/user-profile/OrderStatusBar.tsx',
    find: "    { label: t('voucherStatus.used', { defaultValue: '사용완료' }), key: 'used', path: '/my-vouchers' },",
    replace: "    { label: t('voucherStatus.usable', { defaultValue: '사용가능' }), key: 'usable', path: '/my-vouchers' },\n    { label: t('voucherStatus.used', { defaultValue: '사용완료' }), key: 'used', path: '/my-vouchers' },",
    test: TEST,
    why: '위 숫자 줄의 이용권 장수와 같은 뜻의 숫자가 두 번 서고, 술어가 달라 값까지 갈릴 수 있다.',
  },
  {
    name: "🔢 개발자 표시: 설정에 '현재 OS' 줄이 돌아온다",
    file: 'src/components/settings/ThemeToggleSection.tsx',
    find: '          })}\n        </div>\n      </div>\n    </div>',
    replace: "          })}\n        </div>\n        {mode === 'system' && <p className=\"text-[12px] mt-2\">{t('theme.currentlyFollowing', { defaultValue: '현재 OS' })}</p>}\n      </div>\n    </div>",
    test: TEST,
    why: "'OS' 는 이 서비스의 어느 화면에도 없는 개발자 말이다 — 시스템 테마는 지금 보이는 화면 색이 이미 말한다.",
  },
  {
    name: '🔢 개발자 표시: 맨 아래에 빌드 번호가 다시 찍힌다',
    file: 'src/pages/user-profile/AccountControlsSection.tsx',
    find: "{t('accountSettings.appName', { defaultValue: '유어딜' })} v{APP_VERSION}\n",
    replace: "{t('accountSettings.appName', { defaultValue: '유어딜' })} v{APP_VERSION}\n        {BUILD_HASH && <span className=\"tabular-nums\"> ({BUILD_HASH})</span>}\n",
    test: 'src/tests/unit/app-info-plain-text-2026-09-07.test.ts',
    why: '`v1.0.676 (20261018.0940)` — 괄호 속 빌드 번호는 사람이 읽을 값이 아니다.',
  },
  {
    name: "🔢 개발자 표시: '최신 버전인지 확인' 버튼이 돌아온다",
    file: 'src/pages/user-profile/AccountControlsSection.tsx',
    find: '      {hasUpdate && (',
    replace: "      {!hasUpdate && <button type=\"button\" onClick={() => {}}>{t('accountSettings.checkLatest', { defaultValue: '최신 버전인지 확인' })}</button>}\n      {hasUpdate && (",
    test: 'src/tests/unit/app-info-plain-text-2026-09-07.test.ts',
    why: '이미 자동으로 하는 일(version-check → NewVersionBanner)을 사람에게 시키는 버튼이다.',
  },
]
