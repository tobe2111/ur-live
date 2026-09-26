/**
 * 🏪 이용권 상세 상품 설명·가게 소개 — 주입 매니페스트 (2026-09-24 등록).
 * 가드: src/tests/unit/store-intro-2026-09-24.test.ts
 *
 * 이 결함들은 **에러가 안 난다.** 문단이 엉뚱한 블록에 붙어도, 서버가 보내는 필드를 아무도
 * 안 그려도 빌드·타입·테스트가 전부 초록이다 — 실제로 `long_description`·`seller_bio` 는
 * 그렇게 **0회 소비** 상태로 살아 있었다. 되돌아오는 길을 하나씩 막는다.
 */
export default [
  {
    name: '설명 문단을 이용 안내 꼬리로 되돌린다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '<UsageGuide voucherExpiry={detail.voucher_expiry} voucherTerms={detail.voucher_terms} />',
    replace: '<UsageGuide voucherExpiry={detail.voucher_expiry} voucherTerms={detail.voucher_terms} />\n          {detail.description && <p>{detail.description}</p>}',
    test: 'src/tests/unit/store-intro-2026-09-24.test.ts',
    why:
      '2026-09-15 `faed018ff` 가 UsageGuide 를 이 앵커로 끌어올리면서 설명 문단이 뒤로 밀렸고, ' +
      '제목·구분선이 없어 **유의사항 불릿의 꼬리**처럼 읽혔다. 대표가 그 자리를 짚어 물었다 — ' +
      '"왜 터무니없이 저 자리에 있는거지??"',
  },
  {
    name: '가게 소개에서 사장님 한마디(seller_bio) 배선을 끊는다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "sellerBio={(detail as { seller_bio?: string | null }).seller_bio}",
    replace: "sellerBio={null}",
    test: 'src/tests/unit/store-intro-2026-09-24.test.ts',
    why:
      '서버는 `seller_bio` 를 **이미 보내고 있었는데** 화면의 사용 횟수가 0이었다(그래서 소개란이 ' +
      '없다고 느껴졌다). 배선이 끊기면 증상이 정확히 그 상태로 되돌아가고, 에러는 안 난다.',
  },
  {
    name: '가게 소개 앵커 id 를 바꾼다(탭이 눌려도 아무 일이 없다)',
    file: 'src/pages/group-buy/StoreIntro.tsx',
    find: 'id="gb-sec-store"',
    replace: 'id="gb-sec-store-x"',
    test: 'src/tests/unit/store-intro-2026-09-24.test.ts',
    why:
      '상단 탭이 스크롤할 대상이 사라진다. **누르면 아무 일도 안 일어나고 에러도 안 난다** — ' +
      '이 레포가 반복해 당한 "실패가 아니라 조용한 부재" 클래스라 id 짝을 시험으로 묶는다.',
  },
  {
    name: '소개 섹션이 갤러리 사진을 다시 그린다(같은 사진 두 번)',
    file: 'src/pages/group-buy/StoreIntro.tsx',
    find: 'const who = (storeName || sellerName || \'\').trim()',
    replace: 'const detail_images = null; void detail_images\n  const who = (storeName || sellerName || \'\').trim()',
    test: 'src/tests/unit/store-intro-2026-09-24.test.ts',
    why:
      '`detail_images` 는 상단 스와이프 갤러리에 **이미 병합**돼 있다. 여기서 또 그리면 같은 사진이 ' +
      '두 번 나오는데, 화면이 길어질 뿐 에러가 없어 리뷰에서 놓치기 쉽다.',
  },
  {
    name: '셀러 카드를 페이지에 다시 인라인한다(두 벌이 갈린다)',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '<SellerCard d={detail}',
    replace: '<span>검증 셀러</span><SellerCard d={detail}',
    test: 'src/tests/unit/store-intro-2026-09-24.test.ts',
    why:
      '추출한 부품과 인라인 마크업이 동시에 존재하면 다음 수정이 한쪽에만 들어가 **두 화면이 갈린다** ' +
      '(이 레포가 홈 섹션↔피드·유어샵에서 이미 겪은 클래스).',
  },
]
