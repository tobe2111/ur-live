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
    // 🔁 2026-11-02 재조준 — 대표 *"중복도 있고"* 로 '내 이용권'·'쿠폰함' 줄 자체를 뺐다. 다시 서면 같은 문이 두 번이다.
    name: "🔢 한 곳: '내 이용권' 줄이 목록에 돌아온다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "    { Icon: GiftBoxIcon, label: t('shopping.gifticon'",
    replace: "    { Icon: GiftBoxIcon, label: '내 이용권', path: '/my-vouchers' },\n    { Icon: GiftBoxIcon, label: t('shopping.gifticon'",
    test: TEST,
    why: '맨 위 숫자 줄의 이용권과 같은 곳으로 가는 줄이 다시 선다 — 대표가 지적한 중복.',
  },
  {
    name: "🔢 한 곳: '쿠폰함' 줄이 목록에 돌아온다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "    { Icon: GiftBoxIcon, label: t('shopping.gifticon'",
    replace: "    { Icon: GiftBoxIcon, label: '쿠폰함', path: '/my-coupons' },\n    { Icon: GiftBoxIcon, label: t('shopping.gifticon'",
    test: TEST,
    why: '쿠폰함 문이 숫자 줄과 목록에서 두 번 선다.',
  },
  {
    name: "🔢 한 곳(반대 방향): '내 교환권' 줄의 숫자까지 지운다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    // 🔁 2026-10-18 재조준: 0 이면 안 단다(`|| undefined`). 불변식(교환권 숫자의 유일한 자리)은 그대로.
    find: "count: counts.gifticon || undefined, path: '/my-gifticons' },",
    replace: "path: '/my-gifticons' },",
    test: TEST,
    why: '교환권 숫자의 유일한 자리다 — 정리를 이유로 지우면 교환권이 몇 장인지 마이 어디에도 없다.',
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
