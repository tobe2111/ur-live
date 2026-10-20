/**
 * 🏪 히어로 띠 캡션의 **매장 정보** (2026-10-07, 대표 "B안으로 진행") — 주입 매니페스트.
 * 가드: src/tests/unit/hero-deal-strip-2026-09-28.test.tsx ④-B · ⑤
 *
 * ⚠️ 이 사고의 모양은 **에러가 아니라 침묵**이었다 — 매장명이 타일에 이미 와 있는데(`merchant`)
 * `aria-label` 에만 쓰이고 화면엔 안 그려졌다. 빌드도 테스트도 초록이고, 손님만 "어느 가게인지
 * 모르는 예쁜 사진" 을 봤다. 그래서 주입은 **다시 안 그리게 되는 길**들을 겨눈다.
 */
const TEST = 'src/tests/unit/hero-deal-strip-2026-09-28.test.tsx'

export default [
  {
    name: '🏪 매장명이 다시 화면에서 사라진다 (aria-label 에만 남는다)',
    file: 'src/components/home/HeroDealStrip.tsx',
    find: '<div className="text-[15px] font-bold leading-tight truncate">{title}</div>',
    replace: '{null}',
    test: TEST,
    why: '이 사고 그 자체다 — 데이터는 와 있는데 안 그린다. 에러가 안 나서 아무도 모른다.',
  },
  {
    name: '🏪 지역·종류 줄이 사라진다',
    file: 'src/components/home/HeroDealStrip.tsx',
    find: '{sub && <div className="mt-1 text-[12px] text-white/70 truncate">{sub}</div>}',
    replace: '{null}',
    test: TEST,
    why: '"어디 가게인가" 가 다시 사라진다. 매장명만으로는 전국 피드에서 동네를 알 수 없다.',
  },
  {
    name: '🏪 정가 취소선이 사라져 "얼마나 싸게" 를 못 말한다',
    file: 'src/components/home/HeroDealStrip.tsx',
    find: '{tile.origPrice > tile.price && (',
    replace: '{false && (',
    test: TEST,
    why: '할인율만 남으면 기준 금액이 없다 — 20,000 → 10,000 인지 2,000 → 1,000 인지 알 수 없다.',
  },
  {
    name: '🏪 종류 라벨을 SSOT 대신 손으로 적는다',
    file: 'src/components/home/HeroDealStrip.tsx',
    find: "const sub = [tile.region, CATEGORY_META[tile.category]?.label].filter(Boolean).join(' · ')",
    replace: "const sub = [tile.region, tile.category === 'meal_voucher' ? '식사' : ''].filter(Boolean).join(' · ')",
    test: TEST,
    why: '라벨 표가 두 벌이 되면 칩과 띠가 다른 말을 하는 날이 온다(이 레포가 반복해 당한 클래스).',
  },
  {
    name: '🏪 공유 모듈이 아이콘 든 라벨 SSOT 를 import 한다 (워커 번들 오염)',
    file: 'src/shared/home-hero-strip.ts',
    find: "import { priceDisplay } from './price-display'",
    replace: "import { priceDisplay } from './price-display'\nimport { CATEGORY_META } from './deal-category-icon'",
    test: TEST,
    why: '이 모듈은 워커가 import 한다 — lucide 가 딸려 들어가면 워커 번들이 React 아이콘을 싣는다.',
  },
  {
    name: '🏪 캡션이 높아졌는데 스크림이 종전 램프로 돌아간다 (할인율 1.06:1)',
    file: 'src/components/home/HeroDealStrip.tsx',
    find: "linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.84) 78%, rgba(0,0,0,0) 100%)",
    replace: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0) 100%)",
    test: TEST,
    why: '세 줄 캡션의 글자 상단은 76.7% 인데 종전 스톱의 그 지점 알파는 0.436 이다 — 순백 사진 위 할인 빨강이 1.06:1 로 사실상 안 보인다.',
  },
  {
    name: '🏪 지역 추출이 행정 접미사를 안 떼어 타일 밖으로 넘친다',
    file: 'src/shared/home-hero-strip.ts',
    find: "const wide = parts[0].replace(/(특별자치도|특별자치시|광역시|특별시|자치도|자치시)$/, '')",
    replace: "const wide = parts[0]",
    test: TEST,
    why: '"전북특별자치도 전주시" 는 189px 폭에서 잘린다 — 지역을 보여 주는 목적 자체가 사라진다.',
  },
]
