/**
 * 🔧 2026-09-28 (대표 확정 **s3 밀도형** — "2단계 진행해줘. 끝까지해줘") 주입.
 *
 * 지키는 것 넷: **줄 SSOT · 주인 순서 번호 · 리뷰 0 별점 없음 · 정렬은 보기만**.
 * 아래 결함을 심으면 `ushop-s3-list-2026-09-28.test.ts` 가 빨간불이어야 한다.
 */
export default [
  {
    name: 's3 — 순번을 화면 순서로 매긴다(소개비가 새는 자리)',
    file: 'src/pages/CuratorPage.tsx',
    find: 'order={(orderOf.get(pin.id) ?? 0) + 1}',
    replace: 'order={0 + 1}',
    test: 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts',
    why:
      '순번은 SNS 에서 "3번 이용권 사세요" 로 부르는 **주소**다(2026-08-31 대표). 화면 순서로 매기면 ' +
      '할인율순으로 들어온 손님에게 3번이 다른 상품을 가리켜 소개비가 엉뚱한 상품으로 귀속된다. ' +
      '에러가 안 나고 화면도 멀쩡해 보이는 — 돈이 조용히 새는 유일한 항목이라 제일 센 단언이다.',
  },
  {
    name: 's3 — 주인 순서 맵이 사라진다',
    file: 'src/pages/CuratorPage.tsx',
    find: 'const orderOf = useMemo(() => new Map(homePins.map((p, i) => [p.id, i]))',
    replace: 'const orderOf = useMemo(() => new Map<number, number>()',
    test: 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts',
    why: '번호의 출처가 주인 순서(homePins)가 아니게 되면 위와 같은 귀속 사고로 이어진다.',
  },
  {
    name: 's3 — 줄 카드를 SSOT 없이 새로 그린다',
    file: 'src/pages/curator-page/PinRow.tsx',
    find: "import DealRow from '@/components/deal/DealRow'",
    replace: "const DealRow = (p: Record<string, unknown>) => null as unknown as JSX.Element; void p",
    test: 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts',
    why:
      '`DealRow` 는 2026-09-03 에 만들어진 줄 한 벌 SSOT 다 — 그 전엔 화면마다 따로 그려 같은 딜이 ' +
      '자리마다 다른 그림이었다. 유어샵만 자기 줄을 그리기 시작하면 그 분열이 재발한다.',
  },
  {
    // 🔧 2026-09-28 재조준(대표 결재 `2026-09-28-ushop-star-rating.md` 3번 확정): 종전엔 *"리뷰 0 이면
    //   별을 안 그린다"* 를 지켰다(조건부 별점). 대표가 **아예 끄는 쪽**을 골라 `meta` 자체가 사라졌고
    //   앵커도 함께 사라졌다 — 지키려던 것(없는 신뢰를 지어내지 않는다)을 새 구조의 말로 옮긴다.
    name: 's3 — 시드 별점이 되살아난다',
    file: 'src/pages/curator-page/PinRow.tsx',
    find: "      unit={pin.deal_only === 1 ? '딜' : '원'}",
    replace: "      unit={pin.deal_only === 1 ? '딜' : '원'}\n      meta={<span>{pin.avg_rating}</span>}",
    test: 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts',
    why:
      '라이브 실측(2026-09-27): 유어샵 핀은 전부 데모·플랫폼 상품이라 별점(4.6~4.7)도 구매수(54~140)도 ' +
      '**시드값**이다. 되살리면 데모는 화려하고 진짜 매장만 초라해 보인다 — 없는 신뢰를 지어내는 쪽이다.',
  },
  {
    name: 's3 — 정렬이 주인 순서 배열을 제자리에서 뒤집는다',
    file: 'src/pages/CuratorPage.tsx',
    find: 'const copy = [...list]',
    replace: 'const copy = list',
    test: 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts',
    why:
      '사본 없이 정렬하면 `homePins` 원본이 흔들리고, 그러면 같은 렌더 안에서 순번 맵까지 어긋난다 ' +
      '(정렬 한 번으로 번호가 바뀌는 것 — ①과 같은 귀속 사고).',
  },
  {
    /**
     * 🎯 2026-09-30 재조준 — 앵커가 `space-y-2` 였는데 안 A 로 `grid gap-2 ur-ushop-rows` 가 됐다.
     * **지키려던 것은 그대로 살아 있다**: *폰에서 한 열*. 안 A 의 2열은 `.ur-ushop-main
     * .ur-ushop-rows`(lg+ CSS)라 폰에 안 닿는다. 되살아나면 안 되는 것은 **폭 무관 2열**이다.
     */
    name: 's3 — 목록이 폰에서도 2열 격자가 된다',
    file: 'src/pages/CuratorPage.tsx',
    find: 'className="max-w-3xl mx-auto px-4 pb-4 grid gap-2 ur-ushop-rows"',
    replace: 'className="max-w-3xl mx-auto px-4 pb-4 grid grid-cols-2 gap-2 ur-ushop-rows"',
    test: 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts',
    why:
      '유어샵은 3곳·최다 5개다. 2열 격자는 그 수에서 첫 화면에 1.5개만 보여 줬고 ' +
      '헤더 chrome 이 화면의 76%를 먹었다 — s3 로 바꾼 이유가 그 밀도다. ' +
      'PC 2열(안 A)은 폰에 안 닿는 CSS 로 하므로 이 단언과 충돌하지 않는다.',
  },
  {
    name: 's3 — 칩 게이트가 되살아난다',
    file: 'src/pages/curator-page/PinCategoryChips.tsx',
    find: 'if (pins.length === 0) return null',
    replace: 'const CHIPS_MIN_PINS = 7\n  if (pins.length < CHIPS_MIN_PINS) return null',
    test: 'src/tests/unit/ushop-a3-p1.test.ts',
    why:
      '그 게이트는 한 번도 열린 적이 없다 — 라이브 유어샵은 최다 5개라 칩이 **존재하지 않는 기능**이었다. ' +
      's3 는 칩을 정렬 줄과 한 쌍으로 쓴다.',
  },
  {
    name: 's3 — 헤더가 칩과 같은 숫자를 또 말한다',
    file: 'src/pages/CuratorPage.tsx',
    find: '          canEdit={isOwner}\n          onCopyLink={shareShop}',
    replace: '          canEdit={isOwner}\n          counts={{ pins: pins.length }}\n          onCopyLink={shareShop}',
    test: 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts',
    why:
      '칩이 `전체 6` 이라 적는 90px 위에서 헤더가 `담은 이용권 6` 이라 또 적는다. 렌더 실측으로 잡은 ' +
      '중복이고, 칩 게이트를 연 이번 단계가 스스로 만든 것이다(2026-09-01 지갑과 같은 자리).',
  },
  {
    name: 's3 — 목록 개수를 상시 적는다',
    file: 'src/pages/CuratorPage.tsx',
    find: '                  {query.trim() && (',
    replace: '                  {true && (',
    test: 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts',
    why: '칩이 이미 분류별 개수를 들고 있어, 검색이 더 거르지 않는 한 이 숫자는 새 정보가 아니다.',
  },
  {
    name: 's3 — 줄에 안 보이는 찜 하트가 되돌아온다',
    file: 'src/pages/curator-page/PinRow.tsx',
    // 🔧 2026-09-28 재조준: 별점 제거로 `meta={meta}` 가 사라져 앵커가 낡았다(주입이 적용조차 안 됐다).
    find: "      unit={pin.deal_only === 1 ? '딜' : '원'}\n    />",
    replace: "      unit={pin.deal_only === 1 ? '딜' : '원'}\n      trailing={<WishlistHeart productId={pin.product_id} />}\n    />",
    test: 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts',
    why:
      '`WishlistHeart` 는 `.ur-appear`(기본 opacity:0)라 사진 위 `group` 안을 전제로 만들어졌다. ' +
      '`DealRow` 루트엔 group 이 없어 **PC 에선 영영 안 보이고 폰에서만 보인다** — 기기마다 다른 기능.',
  },
]
