/**
 * 📱 폰 부팅 다이어트(2026-10-13) — 주입 매니페스트.
 * 가드: src/tests/unit/phone-boot-trims-2026-10-13.test.tsx
 */
const TEST = 'src/tests/unit/phone-boot-trims-2026-10-13.test.tsx'

export default [
  {
    name: '📱 PC 상단 네비를 폰에서도 다시 렌더한다',
    file: 'src/components/main/ConsumerTopChrome.tsx',
    find: '      {wide && <DesktopTopNav />}',
    replace: '      <DesktopTopNav />',
    test: TEST,
    why: '안 보이는 헤더를 매 하드로드 렌더 — 폰 부팅 75ms(CPU 4배). 에러 없이 느려지기만 한다.',
  },
  {
    name: '📱 정수 쉼표가 한 자리 어긋난다',
    file: 'src/utils/format.ts',
    find: '    if (i > 0 && (s.length - i) % 3 === 0) out += \',\'',
    replace: '    if (i > 0 && (s.length - i) % 3 === 1) out += \',\'',
    test: TEST,
    why: '31,000 이 310,00 으로 — 가격이 틀리게 보이는데 빌드는 초록이다.',
  },
  {
    name: '📱 음수 부호를 잃는다',
    file: 'src/utils/format.ts',
    find: "  return n < 0 ? '-' + out : out",
    replace: '  return out',
    test: TEST,
    why: '환불·차감 금액이 양수로 보인다.',
  },
  {
    name: '📱 정수 빠른 경로가 꺼진다(Intl 생성 65ms 복귀)',
    file: 'src/utils/format.ts',
    find: "  if (locale === 'ko-KR' && Number.isSafeInteger(n) && !Object.is(n, -0)) return groupInt(n)\n",
    replace: '',
    test: TEST,
    why: '출력은 같아 아무도 모른다 — 첫 카드 렌더에 로캘 데이터 적재가 되돌아온다.',
  },
  {
    name: '📱 셀러 하위 트리가 /seller 접두를 안 뗀다',
    file: 'src/routes/seller.routes.tsx',
    find: "{ path: path.slice('/seller'.length) || '/', key: path }",
    replace: '{ path, key: path }',
    test: 'src/tests/unit/seller-route-tree-2026-10-13.test.tsx',
    why: '하위 Routes 는 남은 경로로 맞춘다 — 절대 경로 그대로면 셀러 화면이 전부 404 가 된다(빌드 초록).',
  },
  {
    name: '📱 공개 가게 경로가 손님 Routes 에서 빠진다',
    file: 'src/routes/seller.routes.tsx',
    find: "      top.push(cloneElement(r, { key: path ?? `seller-top-${top.length}` }))",
    replace: '      void r',
    test: 'src/tests/unit/seller-route-tree-2026-10-13.test.tsx',
    why: '/s/:id·/profile/:id 가 404 — 공유된 가게 링크가 전부 깨진다.',
  },
  {
    name: '📱 셀러 하위 트리에 404 가 없다',
    file: 'src/routes/seller.routes.tsx',
    find: '      <Route path="*" element={<NotFoundPage />} />\n    </Routes>',
    replace: '    </Routes>',
    test: 'src/tests/unit/seller-route-tree-2026-10-13.test.tsx',
    why: '없는 셀러 주소에서 빈 화면이 뜬다(종전엔 App 의 404 가 받았다).',
  },
]
