/**
 * 🏢 마이 정돈 + 홈 맨 아래 회사 정보 (2026-11-02 대표)
 * 가드: src/tests/unit/my-compact-and-company-info-2026-11-02.test.ts
 *
 * 되돌리려는 사고 — ① 폰 홈의 사업자 표시가 조용히 사라진다(법정 표시) ② 한 항목이 빠진다
 * ③ 한 화면에서만 값을 고쳐 화면끼리 사업자 정보가 갈린다 ④ 마이 맨 아래 잔글씨 뭉치가 돌아온다
 * ⑤ 구역 이름이 '내가 산 것' 으로 돌아간다.
 */
const TEST = 'src/tests/unit/my-compact-and-company-info-2026-11-02.test.ts'

export default [
  {
    name: '🏢 폰 홈에서 회사 정보가 빠진다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '      <CompanyInfoFooter className="mt-8" />\n',
    replace: '',
    test: TEST,
    why: '폰 홈엔 사업자 표시가 이것 하나뿐이다. 빠지면 초기 화면 표시 의무를 어긴 채 빌드는 초록이다.',
  },
  {
    name: '🏢 호스팅 제공자 줄이 빠진다',
    file: 'src/shared/company-info.ts',
    find: '  `호스팅서비스 제공자: ${COMPANY.hosting}`,\n',
    replace: '',
    test: TEST,
    why: '사이버몰 운영자 표시 항목이다. 줄 하나 지우는 것은 리뷰에서 눈에 안 띈다.',
  },
  {
    name: '🏢 SSOT 값만 고치고 다른 화면은 옛 값으로 남는다',
    file: 'src/shared/company-info.ts',
    find: "  bizRegNo: '479-09-02930',",
    replace: "  bizRegNo: '479-09-02931',",
    test: TEST,
    why: '사업자번호가 화면마다 다르면 그 자체가 표시 오류다(메일 템플릿이 이미 다른 번호를 적고 있다).',
  },
  {
    name: '🧹 마이 맨 아래 개인정보 잔글씨 링크가 돌아온다',
    file: 'src/pages/UserProfilePage.tsx',
    find: "        <ListRow icon={rowIcon(InfoIcon)} label={t('userProfile.faq', { defaultValue: '자주 묻는 질문' })} to=\"/faq\" />",
    replace: "        <ListRow icon={rowIcon(InfoIcon)} label={t('userProfile.faq', { defaultValue: '자주 묻는 질문' })} to=\"/faq\" />\n        <button onClick={() => navigate('/privacy')} className=\"text-[12px]\">{t('userProfile.privacy')}</button>",
    test: TEST,
    why: '대표가 "엉성하다" 고 한 것이 그 잔글씨 뭉치다. 정식 줄과 잔글씨가 섞이면 두 문법이 된다.',
  },
  {
    name: "🏷️ 구역 이름이 '내가 산 것' 으로 돌아간다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "{t('shopping.sectionTitle', { defaultValue: '마이 딜' })}",
    replace: "{t('shopping.sectionTitle', { defaultValue: '내가 산 것' })}",
    test: TEST,
    why: '대표 확정 명칭이다.',
  },
  {
    name: '🧹 마이 구역 제목 위 여백이 32px 로 돌아간다',
    file: 'src/pages/user-profile/list-grammar.tsx',
    find: '      <Tag className={`mt-5 mb-1 px-4 ${SECTION_TITLE_CLS}`}>',
    replace: '      <Tag className={`mt-8 mb-1 px-4 ${SECTION_TITLE_CLS}`}>',
    test: TEST,
    why: '대표 "필요없이 공백이 많다". 한 자리만 되돌려도 구역마다 간격이 갈린다.',
  },
]
