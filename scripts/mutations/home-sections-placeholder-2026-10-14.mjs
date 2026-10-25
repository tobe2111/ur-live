export default [
  {
    name: '[home-placeholder] 자리 분기가 유어쇼츠 레일을 다시 빠뜨린다',
    file: 'src/components/home/HomeSections.tsx',
    find: '        </section>\n        {shortsRail}\n        {midBanner}',
    replace: '        </section>\n        {midBanner}',
    test: 'src/tests/unit/home-sections-placeholder-2026-10-14.test.ts',
    why: '섹션 응답 순간 레일(~240px)이 끼어들어 피드를 민다(하네스 CLS 0.16).',
  },
  {
    name: '[home-placeholder] 자리 카드가 이름을 한 줄로 잡는다',
    file: 'src/components/home/DealCardPlaceholder.tsx',
    find: '          <span className={`${BAR} block w-2/3`}>가</span>\n',
    replace: '',
    test: 'src/tests/unit/home-sections-placeholder-2026-10-14.test.ts',
    why: '두 줄 이름 카드가 오면 줄마다 ~16px 씩 피드가 밀린다.',
  },
  {
    name: '[home-placeholder] 자리 카드가 판매가 줄을 잃는다',
    file: 'src/components/home/DealCardPlaceholder.tsx',
    find: 'text-[17px] font-bold w-1/2',
    replace: 'text-[13px] w-1/2',
    test: 'src/tests/unit/home-sections-placeholder-2026-10-14.test.ts',
    why: '판매가 줄 높이가 달라져 카드마다 높이가 어긋난다.',
  },
  {
    name: '[home-placeholder] 진짜 카드를 invisible 로 빌려 쓴다(가짜 id prefetch)',
    file: 'src/components/home/DealCardPlaceholder.tsx',
    find: "const BAR = 'rounded",
    replace: "import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'\nvoid GroupBuyFeedCard\nconst BAR = 'rounded",
    test: 'src/tests/unit/home-sections-placeholder-2026-10-14.test.ts',
    why: '자리 카드가 화면에 들어오면 없는 상품의 상세를 미리 받는다.',
  },
]
