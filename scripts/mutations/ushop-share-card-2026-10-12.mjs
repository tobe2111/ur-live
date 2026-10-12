/**
 * 🛍️ 유어샵 공유를 **SDK 경로**로 (2026-10-12 대표 *"이거 아니야, 유어샵 공유 카드 다른 방법 없니?"*
 *   → *"응 그게 가장 이상적이야?"* → *"가장 이상적으로 진행해줘"*) — 주입 매니페스트.
 *
 * 가드: src/tests/unit/ushop-share-card-2026-10-12.test.ts
 *
 * 이 주입들이 지키는 것은 **디자인이 아니라 경로**다. 유어샵 카드가 투박했던 원인은 SVG 가 아니라
 * `navigator.share({url})` → 카톡 **스크래퍼**가 카드를 자기가 조립하는 것이었다(우리 글자 + 카톡
 * 텍스트 블록 **중복** · **버튼 없음**). 아래를 되돌리면 그 화면으로 돌아가고 **에러는 안 난다.**
 */
const TEST = 'src/tests/unit/ushop-share-card-2026-10-12.test.ts'
const CARD = 'src/shared/ushop-share-card.ts'
const SEND = 'src/lib/kakao-share.ts'
const PAGE = 'src/pages/CuratorPage.tsx'

export default [
  {
    name: '🛍️ 공유가 다시 네이티브 시트부터 — 스크래퍼가 카드를 조립한다',
    file: PAGE,
    find: 'if (await shareViaKakao(ushopCardPayload(card))) return',
    replace: 'void card',
    test: TEST,
    why:
      '이게 대표가 신고한 그 화면이다. `navigator.share({url})` 로 가면 카톡이 og 로 카드를 **자기가** ' +
      '조립해 우리 글자 + 카톡 텍스트가 **중복**되고 **버튼이 사라진다**. 링크는 멀쩡히 열려서 ' +
      '공유해 본 사람만 안다.',
  },
  {
    name: '🛍️ 카카오를 네이티브 시트 **뒤로** 보낸다',
    file: PAGE,
    // 🩸 첫 판은 `if (typeof nav.share === 'function' || true)` 였는데 **가드가 통과했고 그게 맞았다** —
    //   그 변경은 네이티브를 *무조건* 시도하게 만들 뿐 **여전히 카카오 다음**이라, 순서를 안 뒤집는다.
    //   순서를 깨려면 네이티브 시도를 카카오 **위**에 끼워야 한다.
    find: '      if (await shareViaKakao(ushopCardPayload(card))) return',
    replace:
      '      if (typeof (navigator as { share?: unknown }).share === \'function\') {\n' +
      '        await (navigator as unknown as { share: (d: ShareData) => Promise<void> }).share({ url: fullUrl }); return\n' +
      '      }\n' +
      '      if (await shareViaKakao(ushopCardPayload(card))) return',
    test: TEST,
    why:
      '폴백 계단은 **순서가 곧 동작**이다. 네이티브가 먼저면 폰에서는 거의 항상 그쪽이 성공해 ' +
      '카드 지정이 **영원히 안 쓰이는 코드**가 되고, 파일에는 멀쩡히 남아 있어 다음 세션이 ' +
      '"이미 했다" 고 읽는다(대표가 신고한 중복 카드가 그대로 나간다).',
  },
  {
    name: '🛍️ 비활성 핀을 카드 얼굴로 쓴다',
    file: CARD,
    find: 'return isShareImagePin(p) && Number(p?.deal_only) !== 1 && Number(p?.price) > 0',
    replace: 'return Number(p?.price) > 0',
    test: TEST,
    why:
      '라이브 실측: 핀 10개 중 4개가 `is_active=0` 이고 **대표 계정의 첫 핀이 그중 하나**였다 ' +
      '("프리미엄 백팩" — 지금 팔지 않는다). 되돌리면 카드가 못 사는 물건을 간판으로 내건다.',
  },
  {
    name: '🛍️ 딜 결제 상품을 커머스 카드에 올린다 (`600딜` → "600원")',
    file: CARD,
    find: 'Number(p?.deal_only) !== 1 && ',
    replace: '',
    test: TEST,
    why:
      '카카오 `commerce` 템플릿은 **원 표기 전용**이다. `deal_only=1`(딜 결제) 상품을 올리면 ' +
      '`600딜` 이 **"600원"** 으로 뜬다 — 거짓 가격이고 그대로 카톡방에 박제된다. 그림으로는 써도 된다.',
  },
  {
    name: '🛍️ 버튼이 유어샵 입구로만 간다 (미끼가 된다)',
    file: CARD,
    find: '`${shopLink}/p/${face.product_id}`',
    replace: 'shopLink',
    test: TEST,
    why:
      '카드가 그 물건을 보여 줬으면 눌렀을 때 **그 물건**에 닿아야 한다. 입구로 보내면 사진·가격이 ' +
      '미끼가 되고, 게다가 `/p/:id` 는 **소개비 귀속 경로**라 클릭 기록까지 잃는다.',
  },
  {
    name: '🛍️ 할인율을 선언값 그대로 믿는다',
    file: CARD,
    find: 'const rate = Math.round((1 - price / orig) * 100)',
    replace: 'const rate = Math.round(Number(face.discount_rate) || 0)',
    test: TEST,
    why:
      '라이브에 `discount_rate=90` 인데 정가·판매가로는 11% 인 핀이 있다. 선언값을 쓰면 카드가 ' +
      '"90% 할인" 이라고 **거짓말**을 하고 그게 공유로 퍼진다.',
  },
  {
    name: '🛍️ og:image 를 다시 글자 박힌 합성 카드로',
    file: CARD,
    find: 'if (photo) return shareCardPhoto(photo, origin) || ushopOgCardUrl(handle, origin)',
    replace: 'void photo',
    test: TEST,
    why:
      '글자는 카톡·슬랙이 **제목·설명으로 이미** 쓴다. 그림에 또 넣으면 그게 대표가 신고한 **중복**이다. ' +
      '실사진이 있으면 실사진을 준다(없을 때만 합성 카드).',
  },
  {
    name: '🛍️ 공유 사진을 원본 그대로 넘긴다',
    file: CARD,
    find: 'return `${origin}/cdn-cgi/image/${opts}/${inner}`',
    replace: 'return abs',
    test: TEST,
    why:
      '원본은 비율이 제각각이라 1200×630 자리에서 피사체가 잘리고(세로 사진이 라이브의 37%), ' +
      '**실측 3,152,465B** 짜리는 스크래퍼가 포기해 카드가 아예 안 뜬다(cdn-cgi 경유 196,260B).',
  },
  {
    name: '🛍️ 공유 사진을 `cfImage` 에 맡긴다 (절반이 3MB 원본으로 나간다)',
    file: CARD,
    find: 'const opts = `width=${SHARE_CARD_W},height=${SHARE_CARD_H},fit=cover,gravity=auto,quality=85,format=jpeg,onerror=redirect`',
    replace: "const opts = `width=${SHARE_CARD_W},quality=85,format=auto`",
    test: TEST,
    why:
      '크롭 인자(`height`·`fit`·`gravity`)가 빠지면 비율이 안 맞고, `format=auto` 는 Accept 를 보고 ' +
      'AVIF/WebP 를 준다 — 이 그림을 굽는 건 우리 화면이 아니라 **남의 렌더러**다.',
  },
  {
    name: '🛍️ 상대 경로를 그대로 og:image 로 (구글·카톡이 조용히 버린다)',
    file: CARD,
    find: 'const abs = src.startsWith(\'/\') ? `${origin}${src}` : src',
    replace: 'const abs = src',
    test: TEST,
    why:
      '`/cdn-cgi/image/...` 는 상대 경로다. og:image 는 **절대 URL** 이어야 하고, 상대면 그 필드를 ' +
      '버리면서 **에러를 안 낸다**(2026-10-11 에 유어샵 ItemList 에서 같은 자리를 밟았다).',
  },
  {
    name: '🛍️ 전송을 다시 사본으로 — `sendDefault` 가 두 곳이 된다',
    file: SEND,
    find: 'kakao()!.Share!.sendDefault(payload)',
    replace: 'void payload',
    test: TEST,
    why:
      '보내는 자리가 둘이 되면 반드시 갈리고, **갈려도 에러가 안 나고 카드만 조용히 달라진다**' +
      '(버튼이 빠지거나 폴백 그림이 한쪽에만 있거나). 가드는 전수로 센다.',
  },
  {
    name: '🎁 선물 공유를 비동기로 바꾼다 (폰 브라우저가 공유창을 막는다)',
    file: 'src/pages/my-vouchers/GiftVoucherSheet.tsx',
    find: 'return sendKakaoShare(feedPayload({',
    replace: 'return void shareViaKakao(feedPayload({',
    test: TEST,
    why:
      '공유창은 **누른 순간**에 열어야 한다 — `await` 를 끼우면 일부 폰 브라우저가 "사용자가 누르지 ' +
      '않은 이동" 으로 보고 막는다(그 파일 머리말이 적어 둔 그 이유). 선물은 그래서 동기다.',
  },
  {
    name: '🛍️ SDK 로더를 정적 import 로 끌어올린다 (첫 페인트가 무거워진다)',
    file: SEND,
    find: "await import('./kakao-sdk')",
    replace: "await Promise.resolve({ ensureKakaoSdk: async () => {} })",
    test: TEST,
    why:
      '정적으로 끌어오면 `app-kakao-sdk` 청크가 첫 페인트 봉투에 실린다(2026-10-11 에 그래서 ' +
      '`check-critical-chunks` 가 빨간불을 냈다). 공유는 **누른 사람만** 받으면 된다.',
  },
]
