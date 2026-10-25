/**
 * 🏪 2026-10-14 — `/s/:username` 크롤러 본문의 주입.
 *
 * 근거·실측·구조(왜 2건이 아니라 모든 신규 매장의 기본 경로인지)는
 * `src/worker/utils/seller-noscript.ts` 머리말, 가드는
 * `src/tests/unit/seller-shop-noscript-2026-10-14.test.ts`.
 *
 * 🔴 **반대 방향도 잠근다** — 이 처방은 "더 담는" 쪽으로 틀리면 `/u/` 사업자 HTML 에 같은 상품이
 *    **두 벌** 실리고(curator 가 `linked_seller_products` 를 따로 동봉한다), 화면에 없는 말을
 *    요약에 넣으면 클로킹이 된다.
 *
 * 🧭 이름에 `유어샵 본문` 을 공유한다 — 러너의 `--only` 는 정규식이 아니라 **부분일치**다.
 */
const B = 'src/worker/utils/seller-noscript.ts'
const PAY = 'src/worker/utils/seller-public-payload.ts'
const TEST = 'src/tests/unit/seller-shop-noscript-2026-10-14.test.ts'

export default [
  {
    name: '🏪 유어샵 본문 — 이름만으로 본문을 낸다 (글자수만 늘린다)',
    file: B,
    find: "  if (!bio && !rows.length) return ''",
    replace: "  if (false) return ''",
    test: TEST,
    why:
      '그 이름은 `<title>`·`og:title` 이 이미 말한다. 이름만 넣으면 본문 글자수는 늘지만 페이지가 ' +
      'thin 인 사실은 그대로다 — **측정만 좋아 보인다.** `buildCuratorNoscript` 가 같은 판단을 ' +
      '적어 둔 그 규율이고, 재료 없는 유어샵은 sitemap 게이트가 빼는 쪽으로 짝이 맞춰져 있다.',
  },
  {
    name: '🏪 유어샵 본문 — 행이 가게 이름을 되풀이한다 (수리 전 상태)',
    file: B,
    find: "    const line = rowLine({ ...(p as RegionSeedRow), restaurant_name: null, brand_name: null })",
    replace: "    const line = rowLine(p as RegionSeedRow)",
    test: TEST,
    why:
      '빌더를 돌려 눈으로 보고 잡은 결함이다 — `rowLine` 은 목록·지역 표면용이라 행 머리에 ' +
      '`restaurant_name` 을 붙이는데 **이 페이지는 그 가게 자신**이다. 실측 출력: ' +
      '`홍대돈까스 유어샵 홍대돈까스 — 홍대 돈가스 …`. 이 레포가 `storeNameParts` 를 둔 이유 ' +
      '("같은 말을 두 번 안 한다")와 정면으로 어긋난다.',
  },
  {
    name: '🏪 유어샵 본문 — 행 조립을 직접 베낀다 (링크·가격이 갈린다)',
    file: B,
    find: "import { esc, capRowImages, liOf, rowLine, type RegionSeedRow, type Row } from './crawler-noscript-rows'",
    replace: "import { esc, capRowImages, liOf, rowLine as _rowLine, type RegionSeedRow, type Row } from './crawler-noscript-rows'\nconst rowLine = (p: RegionSeedRow): Row | null => (p?.name ? { text: String(p.name) } : null)",
    test: TEST,
    why:
      '손으로 베끼면 **링크 주소(정본 SSOT)·사진 상한·가격 표기·가게명 중복 제거**가 전부 사라지고, ' +
      '그 넷은 각각 이 레포가 값을 치르고 만든 규율이다(상대 URL·noindex 링크·그림 상한). ' +
      '시험 ⑤-1 이 *조립 함수를 공유하는가*를 본다.',
  },
  {
    name: '🏪 유어샵 본문 — 상한 8 을 없앤다 (전량 덤프)',
    file: B,
    find: "    if (rows.length >= ROW_MAX) break",
    replace: '',
    test: TEST,
    why:
      '`<noscript>` 는 **사람이 받는 응답에도 그대로 실린다**(크롤러에게만 주는 것은 구글 가이드 ' +
      '위반이다). 요약이지 전량 덤프가 아니고, 목록·지역 표면이 같은 상한 8 을 쓴다.',
  },
  {
    name: '🏪 유어샵 본문 — 탈출을 뺀다',
    file: B,
    find: "${bio ? `<p>${esc(bio)}</p>` : ''}",
    replace: "${bio ? `<p>${bio}</p>` : ''}",
    test: TEST,
    why:
      '소개는 매장이 직접 쓰는 자유 입력이다 — 탈출을 빼면 `</script><b>` 가 서버 HTML 에 그대로 ' +
      '실린다. 탐침 값으로 **동작**을 재는 이유다(한글 상수만 싸는 검사는 탈출을 판정할 수 없다 — ' +
      '2026-10-11 에 값을 치르고 배운 자리).',
  },
  {
    name: '🏪 유어샵 본문 — 시드 파싱 실패에 던진다 (워커가 깨진다)',
    file: B,
    find: "  } catch {\n    return ''\n  }",
    replace: "  } catch (e) {\n    throw e\n  }",
    test: TEST,
    why:
      '이 빌더는 HTMLRewriter 안에서 불린다 — 던지면 **응답 자체가 깨진다.** 재료가 없으면 `\'\'` 를 ' +
      '주고 워커가 종전처럼 로더만 두는 것이 무회귀 경로다.',
  },
  {
    name: '🏪 유어샵 본문 — 페이로드가 상품을 안 담는다 (수리 전 상태)',
    file: PAY,
    find: "  if (opts.withProducts) {",
    replace: "  if (false) {",
    test: TEST,
    why:
      '라이브 실측에서 이 페이로드엔 재료가 **아예 없었다**(`bio`·주소·사진·SNS 전부 null). ' +
      '상품이 유일한 재료이고, 담지 않으면 본문이 6자로 돌아간다.',
  },
  {
    name: '🏪 유어샵 본문 — 반대 방향: 상품을 기본으로 담는다 (/u/ 에 두 벌)',
    file: PAY,
    find: "  opts: { withProducts?: boolean } = {},",
    replace: "  opts: { withProducts?: boolean } = { withProducts: true },",
    test: TEST,
    why:
      '**이 방향이 조용히 나쁘다** — `curator.routes` 는 `linked_seller_products` 를 따로 동봉하므로 ' +
      '`/u/` 사업자 HTML 에 같은 상품이 두 벌 실린다(에러 0 · 바이트만 늘고 아무도 모른다). ' +
      '시험 ⑦-1 이 기본값이 꺼졌는지를 본다.',
  },
  {
    name: '🏪 유어샵 본문 — 상한 인자 기본값을 바꾼다 (curator 동봉이 8개로 줄어든다)',
    file: 'src/worker/utils/linkshop-seller-products.ts',
    find: "sellerId: number, limit = 100)",
    replace: "sellerId: number, limit = 8)",
    test: TEST,
    why:
      '기본값 100 이라 **기존 호출(curator 동봉)이 byte-불변**인 것이 이 추가의 전제다. 8 로 바꾸면 ' +
      '`/u/` 사업자 유어샵의 진열이 8개로 잘리는데 **화면이 그걸 신고하지 않는다**(나머지는 클라 ' +
      '폴백 fetch 로 뒤늦게 온다).',
  },
  {
    name: '🏪 유어샵 본문 — 워커 배선을 끊는다',
    file: 'src/worker/index.ts',
    // 2026-10-25 재조준 — 같은 `||` 항에 LIFESHARE 분기가 이어 붙어 앵커가 낡았다(불변식 그대로: SELLER 배선 끊기).
    find: "(ssrSlot === 'SELLER' ? buildSellerNoscript(ssrPayload) : ",
    replace: "(false ? buildSellerNoscript(ssrPayload) : ",
    test: TEST,
    why:
      '`/s/:username` 은 위 분기(`DETAIL`·`CURATOR`·`STAYDETAIL`·`VOUCHERS`)에 안 걸려 catch-all 로 ' +
      '떨어진다. 그 자리에서 이어 주지 않으면 빌더가 있어도 **한 번도 안 불린다** — 이 레포가 ' +
      '반복해 당한 *조용한 부재*(2026-10-11 `#organization` 과 같은 자리)다.',
  },
  {
    name: '🏪 유어샵 본문 — sitemap 의 셀러 상품 EXISTS 를 되돌린다 (짝 주장)',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: "          WHERE s.status = 'approved'${sellerScope}\n            AND ( EXISTS (SELECT 1 FROM products p WHERE p.seller_id = s.id AND p.is_active = 1\n                            AND ${consumerVisibleProductSql('p')})",
    replace: "          WHERE s.status = 'approved'${sellerScope}\n            AND ( EXISTS (SELECT 1 FROM products p WHERE p.seller_id = s.id AND p.is_active = 1)",
    test: TEST,
    why:
      '핀 분기는 2026-10-12 에 같은 이유로 좁혔는데 **상품 분기만 빠져 있었다.** 도매 원본처럼 ' +
      '소비자에게 안 보이는 상품만 가진 매장이 통과하면 빌더가 `\'\'` 를 주므로 **제출한 URL 에 ' +
      '본문이 없다** — 그 짝 주장이 깨지는 세 번째 자리다.',
  },
  // 🚫 **주입을 하나 뺐다(2026-10-14)** — "①-4 의 개수 단언을 약화한다" 를 두 모양으로 시도했는데
  //    둘 다 **통과**했다. 이유는 가드 결함이 아니라 주입 모델이다: 시험 단언을 *약하게* 만드는 것은
  //    **결함이 아니다**(코드가 멀쩡하면 약한 단언도 통과한다). 그 모양이 빨간불을 내는 것은
  //    `⑤-2` 처럼 **자기검사(탐침)** 가 있을 때뿐이다 — robots 묶음의 "정규식을 무력화한다" 가
  //    빨간불이 된 이유가 그것이다.
  //    여기서는 바로 위 `toBe` 가 정확 출력을 잠그므로 개수 단언은 **더 약한 재진술**이고,
  //    실제 결함 방향은 `🏪 유어샵 본문 — 행이 가게 이름을 되풀이한다` 가 이미 빨간불로 덮는다.
  //    ⇒ 중복 잠금을 주입으로 증명하려 들지 말 것. 재진술은 읽기용으로 남기고 주입은 걸지 않는다.
]
