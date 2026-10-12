/**
 * 🛍️ 유어샵 공유를 **SDK 경로**로 (2026-10-12 대표 *"이거 아니야, 유어샵 공유 카드 다른 방법 없니?"*
 *   → *"응 그게 가장 이상적이야?"* → *"가장 이상적으로 진행해줘"*) — 주입 매니페스트.
 *
 * 가드: src/tests/unit/ushop-share-card-2026-10-12.test.ts
 *
 * 🔄 **2026-10-12 설계가 한 번 바뀌었다** — 대표 *"차라리 유어샵 프로필 유저 프로필 사진이 뜨면
 * 좋을 것 같은데? 없으면 유달이 사진이 뜨고?"*. 첫 판은 *"쓸 수 있는 첫 핀"* 을 얼굴로 썼고,
 * 그래서 비활성 핀·`deal_only` '원' 표기·거짓 할인율을 **각각 막는** 주입 다섯이 있었다.
 * 얼굴이 프로필/유달이가 되면서 그 결함들은 **생길 자리가 없어졌고**, 주입도 함께 옮겼다 —
 * 이제 막는 것은 *"핀을 다시 간판으로 세우는 것"* 하나다(아래 🔙).
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
    name: '🔙 카드 얼굴을 다시 핀 사진으로 (결함 셋이 한꺼번에 돌아온다)',
    file: CARD,
    find: '    imageUrl: h ? ushopOgCardUrl(h, origin) : fallbackImage,',
    replace: "    imageUrl: (Array.isArray(pins) && pins.find(isShareImagePin) ? pinPhoto(pins.find(isShareImagePin)) : '') || fallbackImage,",
    test: TEST,
    why:
      '대표가 되돌린 바로 그 설계다. 핀을 간판으로 세우면 **셋이 한꺼번에** 돌아온다 — ' +
      '비활성 핀(라이브 10개 중 4개, 대표 계정 1번 핀이 "프리미엄 백팩") · `deal_only` 의 ' +
      '`600딜`→"600원" 거짓 가격 · 선언 `discount_rate=90` vs 실제 11%. 그리고 핀 순서가 바뀌면 ' +
      '간판도 바뀐다.',
  },
  {
    name: '🔙 og:image 만 핀 사진으로 되돌린다 (두 경로가 갈린다)',
    file: CARD,
    find: 'export function ushopOgImage(_ssrPayload: string, origin: string, handle: string): string {\n  return ushopOgCardUrl(handle, origin)',
    replace:
      'export function ushopOgImage(_ssrPayload: string, origin: string, handle: string): string {\n' +
      "  try { const pins = (JSON.parse(_ssrPayload) as { pins?: UShopSharePin[] })?.pins; const p = pins?.find(isShareImagePin); if (p) return pinPhoto(p) } catch { /* */ }\n" +
      '  return ushopOgCardUrl(handle, origin)',
    test: TEST,
    why:
      '한쪽만 되돌리는 게 더 고약하다 — 카톡 SDK 로 받은 사람과 주소를 복사해 받은 사람이 ' +
      '**다른 카드**를 본다. 에러는 0 이고 둘을 나란히 놓고 봐야만 안다.',
  },
  {
    name: '🦦 프로필이 없을 때 유달이 대신 다시 이니셜',
    file: 'src/worker/utils/og-curator-card.ts',
    find: '    const face = profileUri || udalUri',
    replace: '    const face = profileUri',
    test: TEST,
    why:
      '라이브 유어샵 17곳 중 **9곳이 프로필 없음**이라 되돌리면 절반이 다시 **파란 원 + 이름 ' +
      '첫 글자**로 공유된다(브랜드가 하나도 안 보인다). 카드는 멀쩡히 나오므로 에러가 없다.',
  },
  {
    name: '🦦 유달이를 `cover` 로 받는다 (몸이 잘린다)',
    file: 'src/worker/routes/og-image.routes.ts',
    find: "{ fit: 'contain', background: OG_AVATAR_TINT }",
    replace: 'undefined',
    test: TEST,
    why:
      '`cover` 는 칸을 꽉 채우려고 **넘치는 부분을 자른다** — 유달이는 전신 포즈라 몸이 잘려 ' +
      '원 안에 몸통만 남는다. 그리고 `contain` 이어도 배경을 안 주면 **jpeg 가 투명을 못 담아** ' +
      '원 안에 검정 상자가 생긴다(2026-10-12 실측: contain+배경 6,971B 로 이음매 없음).',
  },
  {
    name: '🦦 유달이를 번들 자산 경로로 (워커는 해시를 모른다)',
    file: 'src/worker/utils/og-curator-card.ts',
    find: "export const OG_UDAL_SRC = '/assets/mascot/udal-loader-v2.webp'",
    replace: "export const OG_UDAL_SRC = '/src/assets/mascot/udal-curious.webp'",
    test: TEST,
    why:
      '번들 마스코트는 파일명에 **빌드 해시**가 붙어 워커가 주소를 모른다 — 404 가 나고 얼굴이 ' +
      '빈다. 해시 없는 `public/assets/mascot/` 만 워커가 가리킬 수 있다.',
  },
  {
    name: '🦦 프로필이 있어도 유달이를 받아 온다 (쓸모없는 subrequest)',
    file: 'src/worker/routes/og-image.routes.ts',
    find: '      hasProfile\n        ? Promise.resolve(null)\n        : inlineImage(OG_UDAL_SRC',
    replace: '      inlineImage(OG_UDAL_SRC',
    test: TEST,
    why:
      '서브리퀘스트는 무료 50/인보케이션이고 이 라우트는 타일까지 최대 5장을 받는다. 쓰지도 ' +
      '않을 그림을 매번 받으면 예산이 줄고, 그 손해는 **에러 없이** 다른 요청의 실패로 나타난다.',
  },
  {
    name: '🔢 카드 그림을 바꾸고 판 번호를 안 올린다',
    file: CARD,
    find: 'export const USHOP_OG_CARD_V = 5',
    replace: 'export const USHOP_OG_CARD_V = 4',
    test: TEST,
    why:
      '카카오는 **주소 단위**로 스크랩 결과를 캐시한다. 번호가 그대로면 얼굴을 프로필/유달이로 ' +
      '바꿔 배포해도 **옛 카드가 계속 나가고**, 잘못 나간 카드는 회수할 방법이 우리에게 없다.',
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
